// The Glimmerdeep's art: the whole cave painted in one piece (lit, with a
// normal map and a glow layer), and the things that grow and stand in it.
//
// A cave of cold blue-violet rock that has never seen the sun, lit only by
// what lives in it. The explorers' stair comes down into the Lantern
// Descent, where a worn path of flagstones leads on past old bones. In the
// Glowcap Forest the humus is threaded with glowing mycelium, mossy and
// sprouting little luminous mushrooms; the Moonwell's pale limestone rings a
// pool ringed in glowing algae. River pebbles and wet slate line the
// underground river, bridged by natural stone. The Sporemother's Hollow is a
// spongy carpet of fungus veined with magenta light round a fairy ring. Past
// it the rock turns violet, shot with amethyst: the Galleries, the cracked
// rim of a chasm whose depths glimmer, the Throat, and the Geode Heart, a
// vast geode of agate bands and crystal teeth round a dais where a wyrm's
// coil is carved in light. The north walls show their faces, rock strata
// grown with bracket fungi or jutting crystals; past their tops the rock
// runs into darkness, pricked with glowworms like stars.

import { mix } from './bitmap';
import { hash2, rng, valueNoise } from './env';
import { KEY_LIGHT, PixelCanvas, cyl, hex, sphere, FLAT, type Material, type RGB } from './pixel';
import {
  DEEP_H,
  DEEP_SPAWN,
  DEEP_W,
  DEEP_WALL_H,
  GROTTO_POOL,
  HEART,
  HOLLOW,
  RIVER_HW,
  WELL_POOL,
  ZONES,
  deepDepth,
  deepWet,
  deepZone,
  onBridge,
  type Zone,
} from '../world/deepLayout';

const ramp = (...c: string[]): RGB[] => c.map(hex);

// ---------------------------------------------------------------- Palette

const FACE = ramp('#0a0911', '#12101b', '#1a1726', '#231f33', '#2d2841', '#38324f', '#453e60');
const CAP = ramp('#0c0a12', '#14111c', '#1c1827', '#252032', '#2f293e', '#3a334b');
const MASS: RGB = hex('#040308');

/** Each part of the cave's floor stone, darkest first. */
const FLOOR: Record<Zone, RGB[]> = {
  lantern: ramp('#141011', '#1e1819', '#2a2222', '#372d2b', '#453834', '#54443e', '#665349'),
  forest: ramp('#0b100f', '#111a18', '#172421', '#1e2f2a', '#263a33', '#30473e', '#3b554a'),
  well: ramp('#10141a', '#171d25', '#202833', '#2a3441', '#35414f', '#424f5f', '#516072'),
  river: ramp('#0b0f14', '#11171e', '#182029', '#202a35', '#293542', '#334150', '#3f4e5f'),
  hollow: ramp('#130b14', '#1c111d', '#271828', '#332034', '#402941', '#4e334f', '#5e3e5e'),
  crystal: ramp('#0f0d15', '#17141f', '#201c2b', '#2a2538', '#352f46', '#423a55', '#504766'),
  abyss: ramp('#0a0a0f', '#101017', '#171720', '#1f1f2a', '#282835', '#323241', '#3d3d4e'),
  throat: ramp('#110c18', '#1a1224', '#241a31', '#2f223f', '#3b2b4e', '#48355e', '#574070'),
  heart: ramp('#100b16', '#181020', '#21172c', '#2b1f39', '#362847', '#433157', '#523c69'),
};

const PATH = ramp('#1e1817', '#2c2421', '#3b302b', '#4b3d35', '#5c4b40', '#6e5a4c');
const MOSS = ramp('#0a1a16', '#10281f', '#173a2a', '#1f4c34');
const PEBBLE = ramp('#161b22', '#232a33', '#323b46', '#434e5a', '#566270', '#6c7a88');
const WATER = ramp('#031014', '#062028', '#0a3440', '#0f5060', '#1a7a86', '#3ab6b8', '#9ef0e4', '#e8fffa');
const ABYSS_DARK = ramp('#010103', '#040309', '#08050f', '#0e0918');
const QUARTZ = ramp('#2a2440', '#4a4068', '#7a6ea0', '#b4a8d8', '#e6deff');
const AGATE = ramp('#1c1030', '#2e1a4a', '#46286c', '#623a92', '#8656bc', '#a87ad8');
const BONE = ramp('#4e493f', '#7a7362', '#a8a08a', '#d2cab2', '#efe8d4');

export const CYAN: RGB = hex('#5ae4ff');
export const MAGENTA: RGB = hex('#ff6ad8');
export const AMETHYST: RGB = hex('#b37aff');
const AMETHYST_HOT: RGB = hex('#ead8ff');
const TURQ: RGB = hex('#3ad8d0');
const LICHEN: RGB = hex('#9cff7a');
const WORM: RGB = hex('#9ef4ff');

/** Particle tints for the cave: spores cyan and magenta, amethyst sparks, turquoise water. */
export const DEEP_TINTS = [0x5ae4ff, 0xff6ad8, 0xb37aff, 0x3ad8d0, 0xe8fffa];

export interface DeepArt {
  diffuse: Uint8ClampedArray;
  normal: Uint8ClampedArray;
  emissive: Uint8ClampedArray;
}

type N3 = [number, number, number];
const UP: N3 = [0, 0, 1];
const FACE_N: N3 = [0, -0.5, 0.86];

/** The explorers' stair down into the Lantern Descent, cut into the rock south of the spawn. */
const STAIR = { x0: DEEP_SPAWN.x - 34, x1: DEEP_SPAWN.x + 34 };
/** The worn path of flagstones from the stair toward the forest. */
const TRAIL: [number, number][] = [
  [DEEP_SPAWN.x, DEEP_SPAWN.y + 40],
  [DEEP_SPAWN.x + 10, DEEP_SPAWN.y - 20],
  [290, 1420],
  [360, 1380],
  [430, 1318],
  [500, 1284],
];

/** Where old bones lie: explorers who never came back up. */
const BONES: [number, number, boolean][] = [
  [128, 1432, false],
  [352, 1528, true],
  [140, 270, false],
  [214, 232, true],
  [446, 548, false],
  [986, 704, true],
  [1318, 660, false],
];

function segDist(x: number, y: number, a: [number, number], b: [number, number]): number {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (y - a[1]) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(x - a[0] - vx * t, y - a[1] - vy * t);
}

/**
 * The cave in one image: diffuse, a normal map for the lights, and a glow
 * layer. Built a few rows at a time.
 */
export function* deepArt(): Generator<void, DeepArt, void> {
  const W = DEEP_W;
  const H = DEEP_H;
  const N = W * H;
  const diffuse = new Uint8ClampedArray(N * 4);
  const normal = new Uint8ClampedArray(N * 4);
  const emissive = new Uint8ClampedArray(N * 4);
  const L = KEY_LIGHT;
  const Ll = Math.hypot(L.x, L.y, L.z);

  // 1. The cave's shape on coarse grids (every 2 px), read back smoothly.
  const G = 2;
  const GW = Math.ceil(W / G) + 2;
  const GH = Math.ceil(H / G) + 2;
  const gDepth = new Float32Array(GW * GH);
  const gWet = new Float32Array(GW * GH);
  const gChasm = new Uint8Array(GW * GH);
  for (let gy = 0; gy < GH; gy++) {
    if (gy % 16 === 0) yield;
    for (let gx = 0; gx < GW; gx++) {
      const i = gy * GW + gx;
      const d = deepDepth(gx * G, gy * G);
      gDepth[i] = d;
      if (d > -6) {
        const w = deepWet(gx * G, gy * G);
        gWet[i] = w.d;
        gChasm[i] = w.kind === 'chasm' ? 1 : 0;
      } else gWet[i] = -99;
    }
  }
  const lerpGrid = (g: Float32Array, x: number, y: number) => {
    const fx = x / G;
    const fy = y / G;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const i = y0 * GW + x0;
    const a = g[i];
    const b = g[i + 1];
    const c = g[i + GW];
    const d = g[i + GW + 1];
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
  // Zones every 4 px: each pixel reads a nearby cell, jittered, so seams dither.
  const Z = 4;
  const ZW = Math.ceil(W / Z) + 2;
  const ZH = Math.ceil(H / Z) + 2;
  const gZone = new Uint8Array(ZW * ZH);
  for (let zy = 0; zy < ZH; zy++) {
    if (zy % 24 === 0) yield;
    for (let zx = 0; zx < ZW; zx++) {
      if (gDepth[Math.min(GH - 1, zy * 2) * GW + Math.min(GW - 1, zx * 2)] < -26) continue;
      gZone[zy * ZW + zx] = ZONES.indexOf(deepZone(zx * Z, zy * Z));
    }
  }
  const zoneAt = (x: number, y: number): Zone => {
    const jx = Math.floor((hash2(x, y, 3001) - 0.5) * 6);
    const jy = Math.floor((hash2(x, y, 3003) - 0.5) * 6);
    const zx = Math.max(0, Math.min(ZW - 1, Math.round((x + jx) / Z)));
    const zy = Math.max(0, Math.min(ZH - 1, Math.round((y + jy) / Z)));
    return ZONES[gZone[zy * ZW + zx]];
  };

  // 2. What each pixel is: 1 floor, 2 bridge deck, 3 water, 4 chasm, or 0 rock.
  const open = new Uint8Array(N);
  for (let y = 0; y < H; y++) {
    if (y % 64 === 0) yield;
    for (let x = 0; x < W; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      if (lerpGrid(gDepth, px, py) <= 0) continue;
      const i = y * W + x;
      const wet = lerpGrid(gWet, px, py);
      if (wet > 0) {
        if (onBridge(px, py) > 0) open[i] = 2;
        else open[i] = gChasm[Math.round(py / G) * GW + Math.round(px / G)] ? 4 : 3;
      } else open[i] = 1;
    }
  }
  // 3. Wall faces: the rock just north of floor or water; and how far into the chasm each chasm pixel lies below its lip.
  const face = new Uint8Array(N);
  const chasmDown = new Uint8Array(N);
  for (let x = 0; x < W; x++) {
    let below = -1;
    for (let y = H - 1; y >= 0; y--) {
      const i = y * W + x;
      const o = open[i];
      if (o) {
        below = o === 4 ? -1 : y;
        continue;
      }
      if (below >= 0 && below - y <= DEEP_WALL_H) face[i] = below - y;
      else below = -1;
    }
    let lip = -1;
    for (let y = 0; y < H; y++) {
      const i = y * W + x;
      if (open[i] === 4) {
        if (lip < 0) lip = y;
        chasmDown[i] = Math.min(255, y - lip + 1);
      } else lip = -1;
    }
  }
  // The stair starts where the floor ends, below the spawn.
  let stairTop = DEEP_SPAWN.y;
  while (stairTop < H - 1 && open[(stairTop + 1) * W + DEEP_SPAWN.x]) stairTop++;
  yield;

  const put = (i: number, c: RGB, n: N3, glow?: RGB, gk = 1) => {
    const o = i * 4;
    diffuse[o] = c[0];
    diffuse[o + 1] = c[1];
    diffuse[o + 2] = c[2];
    diffuse[o + 3] = 255;
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    normal[o] = Math.round((n[0] / l) * 127.5 + 127.5);
    normal[o + 1] = Math.round((n[1] / l) * 127.5 + 127.5);
    normal[o + 2] = Math.round((n[2] / l) * 127.5 + 127.5);
    normal[o + 3] = 255;
    if (glow && gk > 0) {
      emissive[o] = Math.min(255, emissive[o] + glow[0] * gk);
      emissive[o + 1] = Math.min(255, emissive[o + 1] + glow[1] * gk);
      emissive[o + 2] = Math.min(255, emissive[o + 2] + glow[2] * gk);
      emissive[o + 3] = 255;
    }
  };
  const shadeOf = (n: N3) => (n[0] * L.x + n[1] * L.y + n[2] * L.z) / ((Math.hypot(n[0], n[1], n[2]) || 1) * Ll);
  const pick = (r: RGB[], idx: number) => r[Math.max(0, Math.min(r.length - 1, Math.round(idx)))];

  // The floor's relief, three rows at a time, for its normals.
  const heightAt = (x: number, y: number) => valueNoise(x, y, 7, 3011) * 0.65 + valueNoise(x, y, 2.6, 3013) * 0.35;
  let hU = new Float32Array(W);
  let hC = new Float32Array(W);
  let hD = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    hC[x] = heightAt(x, 0);
    hD[x] = heightAt(x, 1);
  }

  for (let y = 0; y < H; y++) {
    if (y % 8 === 0) yield;
    if (y > 0) {
      const t = hU;
      hU = hC;
      hC = hD;
      hD = t;
      for (let x = 0; x < W; x++) hD[x] = heightAt(x, y + 1);
    }
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const o = open[i];
      const px = x + 0.5;
      const py = y + 0.5;

      // ---- The chasm: its far wall dropping away, then glimmering dark.
      if (o === 4) {
        const dn = chasmDown[i];
        const wet = lerpGrid(gWet, px, py);
        if (dn <= 26) {
          // The inner north wall: strata falling away into the dark.
          const k = dn / 26;
          const row = Math.floor((dn + valueNoise(x, 0, 5, 3021) * 4) / 4);
          let idx = 3.2 - k * 3.2 + (hash2(Math.floor(x / 7), row, 3023) - 0.5) * 0.8;
          if (dn % 4 === 0) idx -= 0.6;
          if (dn <= 1) idx += 1;
          const c = mix(pick(FACE, idx), MASS, k * 0.7);
          // Crystals glinting on the way down.
          if (hash2(x, y, 3025) > 0.992) {
            put(i, mix(c, AMETHYST, 0.6), FACE_N, AMETHYST, 0.5 * (1 - k));
            continue;
          }
          put(i, c, FACE_N, AMETHYST, Math.max(0, 0.05 - k * 0.05));
          continue;
        }
        // The depths: nearly black, a violet haze deep down, and far-off specks of light.
        const deep = Math.min(1, wet / 60);
        const haze = deep * (0.5 + valueNoise(x, y, 18, 3027) * 0.5);
        let c = pick(ABYSS_DARK, haze * 3);
        if (hash2(x, y, 3029) > 0.9965) {
          const g = hash2(x, y, 3031) > 0.5 ? AMETHYST : AMETHYST_HOT;
          put(i, mix(c, g, 0.5), UP, g, 0.35 + hash2(x, y, 3033) * 0.35);
          continue;
        }
        c = mix(c, hex('#1a0e2c'), haze * 0.35);
        put(i, c, UP, hex('#3a1a6a'), haze * 0.35);
        continue;
      }

      // ---- Water: the river running, the pools still, all of it glowing.
      if (o === 3) {
        const wet = lerpGrid(gWet, px, py);
        const zone = zoneAt(x, y);
        const pool = zone === 'well' ? (Math.hypot((px - WELL_POOL.cx) / WELL_POOL.rx, (py - WELL_POOL.cy) / WELL_POOL.ry) < 1.6 ? WELL_POOL : GROTTO_POOL) : null;
        let idx: number;
        if (pool) {
          const r = Math.hypot((px - pool.cx) / pool.rx, (py - pool.cy) / pool.ry);
          const ripple = Math.sin(r * 26 - valueNoise(x, y, 9, 3041) * 4) * 0.5 + 0.5;
          idx = 2.2 + (1 - r) * 3 + (ripple > 0.8 ? 0.9 : 0);
        } else {
          // Streaks drawn out along the current.
          const streak = valueNoise(x * 1.1, y * 0.22, 5, 3043);
          const deep = Math.min(1, wet / RIVER_HW);
          idx = 2 + deep * 2 + (streak > 0.72 ? 1.3 : streak < 0.25 ? -0.6 : 0);
        }
        // Foam and glow at the banks; the north bank's rock shades the water under it.
        if (wet < 2.2) idx = 5.6;
        else if (wet < 4) idx += 0.8;
        if (y > 2 && open[i - 2 * W] === 0) idx -= 1.6;
        else if (y > 5 && open[i - 5 * W] === 0) idx -= 0.8;
        // A bridge's shadow on the water below it.
        let shade = 0;
        for (let k = 1; k <= 8; k++) {
          if (y - k >= 0 && open[i - k * W] === 2) {
            shade = k;
            break;
          }
        }
        if (shade > 0 && shade <= 3) {
          // The bridge's own side: rough rock over the water.
          const c = pick(FACE, 2.5 - shade * 0.6 + (hash2(x, y, 3045) - 0.5));
          put(i, c, FACE_N);
          continue;
        }
        if (shade > 3) idx -= 1.5;
        if (hash2(x, y, 3047) > 0.994) idx = 7;
        const c = pick(WATER, idx);
        put(i, c, UP, c, Math.max(0.15, 0.3 + idx * 0.07));
        continue;
      }

      // ---- The bridges: natural arches of stone, worn smooth.
      if (o === 2) {
        const b = onBridge(px, py);
        const edge = b < 2.2;
        let idx = 3.4 + (heightAt(x * 2, y * 2) - 0.5) * 1.4 + (edge ? -1 : 0);
        const n: N3 = edge ? [0, b < 1.2 ? -0.4 : 0.4, 0.9] : [(hC[Math.max(0, x - 1)] - hC[Math.min(W - 1, x + 1)]) * 2, (hD[x] - hU[x]) * 2, 1];
        idx += shadeOf(n) * 0.7;
        if (hash2(x, y, 3051) > 0.97) idx -= 0.8;
        put(i, pick(FLOOR.river, idx + 0.6), n);
        continue;
      }

      // ---- Rock: the faces of north walls, their tops, and the dark beyond.
      if (o === 0) {
        const hgt = face[i];
        if (hgt) {
          this_face: {
            const yy = DEEP_WALL_H - hgt;
            const zone = zoneAt(x, y + hgt + 3);
            // Strata: bands of rock, their seams wavering.
            const sy = yy + (valueNoise(x, 0, 11, 3061) - 0.5) * 5;
            const band = Math.floor(sy / 5);
            let idx = 2.8 + (hash2(Math.floor(x / 9), band, 3063) - 0.5) * 1.1 + (valueNoise(x, y, 4, 3065) - 0.5) * 1.2;
            let n: N3 = FACE_N;
            if (Math.abs(sy - band * 5) < 0.7) {
              idx -= 1.2;
              n = [0, 0.3, 0.95];
            }
            // Vertical fissures.
            if (Math.abs(valueNoise(x * 3, band, 6, 3067) - 0.5) < 0.03) idx -= 1.4;
            // Mineral drips streaking down the face.
            const drip = hash2(Math.floor(x / 3), 0, 3069);
            if (drip > 0.9 && yy > hash2(Math.floor(x / 3), 1, 3071) * 12) idx += 0.7;
            if (yy < 2) {
              idx += 1.2;
              n = [0, 0.5, 0.86];
            }
            if (hgt <= 2) idx -= 2;
            else if (hgt <= 5) idx -= 1;
            let c = pick(FACE, idx + shadeOf(n) * 0.5);

            if (zone === 'forest' || zone === 'hollow' || zone === 'well' || zone === 'lantern') {
              // Bracket fungi, shelf on shelf, glowing on their rims.
              const cell = Math.floor(x / 12);
              if (hash2(cell, 7, 3081) < (zone === 'lantern' ? 0.2 : 0.62)) {
                const cx = cell * 12 + 2 + hash2(cell, 8, 3083) * 8;
                const cy = 7 + hash2(cell, 9, 3085) * 15;
                const rx = 3 + hash2(cell, 10, 3087) * 3;
                const u = (px - cx) / rx;
                const v = (yy + 0.5 - cy) / 2.6;
                if (v > -1 && v <= 0.6 && u * u + v * v < 1) {
                  const g = zone === 'hollow' || hash2(cell, 11, 3089) > 0.6 ? MAGENTA : CYAN;
                  const rim = v > 0.1;
                  put(i, mix(pick(FACE, 3 - v), g, rim ? 0.55 : 0.25), [u * 0.4, 0.5 - v * 0.4, 0.8], g, rim ? 0.75 : 0.3);
                  break this_face;
                }
                if (v > 0.6 && v < 1.4 && Math.abs(u) < 0.9) c = pick(FACE, 0);
              }
            } else if (zone === 'crystal' || zone === 'throat' || zone === 'heart' || zone === 'abyss') {
              // Amethyst jutting out of the rock, growing up from the foot of the wall.
              const cell = Math.floor(x / 10);
              if (hash2(cell, 3, 3091) < (zone === 'abyss' ? 0.25 : 0.5)) {
                const cx = cell * 10 + 2 + hash2(cell, 4, 3093) * 6;
                const ht = 6 + hash2(cell, 5, 3095) * (zone === 'heart' ? 16 : 11);
                const hw = 1.6 + hash2(cell, 6, 3097) * 1.8;
                const up = DEEP_WALL_H - yy;
                const w = hw * Math.min(1, (ht - up + 1) / (ht * 0.6));
                if (up <= ht && Math.abs(px - cx) < w) {
                  const t = (px - cx) / Math.max(0.5, w);
                  const k = 1 - up / ht;
                  put(i, mix(pick(AGATE, 3 + (t < 0 ? 1.5 : -0.5) + (1 - k) * 1.2), AMETHYST_HOT, t < -0.3 ? 0.25 : 0), [t * 0.6, 0.1, 0.8], AMETHYST, 0.45 + (1 - k) * 0.3);
                  break this_face;
                }
              }
            } else if (zone === 'river' && yy > DEEP_WALL_H - 9 && hash2(x, y, 3099) > 0.8) {
              // Glowing algae where the river splashes.
              put(i, mix(c, TURQ, 0.4), FACE_N, TURQ, 0.4);
              break this_face;
            }
            // Glowworms on the rock.
            if (hash2(x, y, 3101) > 0.995) {
              put(i, mix(c, WORM, 0.6), FACE_N, WORM, 0.7);
              break this_face;
            }
            put(i, c, n);
          }
          continue;
        }

        // The explorers' stair, cut down into the rock from the south.
        const d = lerpGrid(gDepth, px, py);
        const od = -d;
        if (x >= STAIR.x0 && x < STAIR.x1 && y > stairTop - 6) {
          const lx = x - STAIR.x0;
          const side = Math.min(lx, STAIR.x1 - 1 - x);
          const down = y - (stairTop - 6);
          const step = Math.floor(down / 7);
          const ly = down % 7;
          if (side < 4) {
            put(i, pick(CAP, 3 - side * 0.3 - step * 0.2 + (hash2(x, y, 3111) - 0.5)), side < 2 ? [-0.4, 0, 0.9] : UP);
            continue;
          }
          const fade = step * 0.45;
          if (ly >= 5) put(i, pick(PATH, 1.2 - fade), FACE_N);
          else put(i, pick(PATH, 3.4 - fade - (ly === 0 ? -0.6 : 0) + (hash2(Math.floor(x / 9), step, 3113) - 0.5) * 0.8), ly === 0 ? [0, 0.4, 0.9] : UP);
          continue;
        }
        if (od <= 6) {
          const edge = od < 1.6;
          let idx = 2.4 + (valueNoise(x, y, 4, 3121) - 0.5) * 1.6 + (edge ? 1.1 : 0) - (od > 4.4 ? 1.1 : 0);
          if (Math.abs(valueNoise(x, y, 9, 3123) - 0.5) < 0.03 && !edge) idx -= 1;
          put(i, pick(CAP, idx), edge ? [0, 0.45, 0.9] : UP);
          continue;
        }
        const t = valueNoise(x, y, 14, 3125);
        const k = Math.max(0, 1 - (od - 6) / 6) * 0.5;
        const c = mix(MASS, pick(CAP, 0), k + (t - 0.5) * 0.3);
        // Glowworms in the dark, like a sky full of stars.
        if (od > 10 && hash2(x, y, 3127) > 0.9978) {
          const g = hash2(x, y, 3129) > 0.7 ? CYAN : WORM;
          put(i, mix(c, g, 0.5), UP, g, 0.25 + hash2(x, y, 3131) * 0.45);
          continue;
        }
        put(i, c, UP);
        continue;
      }

      // ---- The floor.
      const d = lerpGrid(gDepth, px, py);
      const zone = zoneAt(x, y);
      const base = FLOOR[zone];
      let n: N3 = [(hC[Math.max(0, x - 1)] - hC[Math.min(W - 1, x + 1)]) * 2.4, (hD[x] - hU[x]) * 2.4, 1];
      let idx = 3 + (hC[x] - 0.5) * 1.8;
      let glow: RGB | undefined;
      let gk = 0;
      let tint: RGB | null = null;
      let tk = 0;
      const wet = open[i] === 1 ? lerpGrid(gWet, px, py) : -99;

      if (zone === 'lantern') {
        // The explorers' path: flagstones, broken and half buried.
        let pd = 99;
        for (let k = 1; k < TRAIL.length; k++) pd = Math.min(pd, segDist(px, py, TRAIL[k - 1], TRAIL[k]));
        const pw = 10 + (valueNoise(x, y, 12, 3141) - 0.5) * 6;
        if (pd < pw) {
          const row = Math.floor(y / 7);
          const off = (row % 2) * 5;
          const col = Math.floor((x + off) / 10);
          const lx = (x + off) % 10;
          const ly = y % 7;
          const id = hash2(col, row, 3143);
          const missing = id < 0.18 || (pd > pw - 3 && id < 0.5);
          if (!missing) {
            if (lx === 0 || ly === 0) {
              put(i, pick(PATH, 0), UP);
              continue;
            }
            let fi = 2.6 + (id - 0.5) * 1.4 + (valueNoise(x, y, 5, 3145) - 0.5) * 0.8;
            let fn: N3 = UP;
            if (lx === 1 || ly === 1) {
              fn = [-0.3, 0.35, 0.88];
              fi += 0.6;
            } else if (lx === 9 || ly === 6) {
              fn = [0.3, -0.35, 0.88];
              fi -= 0.5;
            }
            put(i, pick(PATH, fi + shadeOf(fn) * 0.5), fn);
            continue;
          }
          idx -= 0.4;
        }
        // Warm dust.
        if (valueNoise(x, y, 16, 3147) > 0.62) {
          tint = hex('#4a3a2c');
          tk = 0.25;
        }
      } else if (zone === 'forest' || zone === 'hollow' || zone === 'well') {
        if (zone === 'hollow') {
          const u = (px - HOLLOW.cx) / HOLLOW.rx;
          const v = (py - HOLLOW.cy) / HOLLOW.ry;
          const r = Math.hypot(u, v);
          const a = Math.atan2(v, u);
          // The fairy ring: little glowing mushrooms all the way round, on a ring of trampled dark.
          const ring = 0.64;
          const step = (Math.PI * 2) / 44;
          const k = Math.round(a / step);
          const ma = k * step;
          const mx = HOLLOW.cx + Math.cos(ma) * HOLLOW.rx * ring + (hash2(k, 1, 3151) - 0.5) * 3;
          const my = HOLLOW.cy + Math.sin(ma) * HOLLOW.ry * ring + (hash2(k, 2, 3153) - 0.5) * 3;
          const dx = Math.floor(px - mx);
          const dy = Math.floor(py - my);
          const g = k % 2 ? MAGENTA : CYAN;
          if ((dy === -3 && Math.abs(dx) <= 1) || (dy === -2 && Math.abs(dx) <= 2)) {
            put(i, mix(pick(base, 5 - (dx > 0 ? 1 : 0)), g, 0.55), [dx * 0.25, 0.5, 0.8], g, 0.8);
            continue;
          }
          if ((dy === -1 || dy === 0) && dx === 0) {
            put(i, pick(BONE, 3 - dy), UP);
            continue;
          }
          if (dy === 1 && (dx === 0 || dx === 1)) idx -= 1.4;
          if (Math.abs(r - ring) < 0.05) idx -= 1 - Math.abs(r - ring) * 12;
          // Veins of her mycelium, glowing magenta, spreading from the root bed.
          if (r > 0.12 && r < 1.05) {
            const vein = Math.abs(Math.sin(a * 7 + valueNoise(x, y, 22, 3155) * 3.2 + r * 2));
            if (vein < 0.05 + 0.03 * (1 - r)) {
              const s = (1 - r) * 0.8 + 0.2;
              put(i, mix(pick(base, 2), MAGENTA, 0.35 * s + 0.1), UP, MAGENTA, 0.5 * s);
              continue;
            }
          }
          // The root bed at the heart of the ring: knotted roots with glowing nodules.
          if (r < 0.2) {
            const root = valueNoise(x * 1.6, y, 5, 3157);
            idx = 2 + root * 3 - r * 2;
            n = [(root - 0.5) * 0.8, 0.3, 0.9];
            if (hash2(x, y, 3159) > 0.985) {
              put(i, mix(pick(base, 4), MAGENTA, 0.6), UP, MAGENTA, 0.8);
              continue;
            }
          }
          // Spongy blotches.
          if (valueNoise(x, y, 5, 3161) > 0.66) idx += 0.7;
        }
        // Mycelium threads in the humus, faintly glowing.
        if (zone !== 'well' && valueNoise(x, y, 60, 3171) > 0.42 && Math.abs(valueNoise(x, y, 13, 3173) - 0.5) < 0.014) {
          put(i, mix(pick(base, 3), CYAN, 0.3), UP, CYAN, 0.28);
          continue;
        }
        // Moss, pricked with glowing lichen.
        const moss = valueNoise(x, y, 19, 3175) + (d < 12 ? (12 - d) * 0.02 : 0);
        if (moss > (zone === 'well' ? 0.7 : 0.6)) {
          if (hash2(x, y, 3177) > 0.982) {
            put(i, mix(pick(MOSS, 3), LICHEN, 0.5), UP, LICHEN, 0.55);
            continue;
          }
          tint = pick(MOSS, 1 + (moss - 0.6) * 6);
          tk = 0.6;
        }
        if (zone === 'well') {
          // Pale flowstone in terraces round the pool, algae glowing at its edge.
          if (wet > -14) {
            const k = 1 - Math.max(0, -wet) / 14;
            if (hash2(x, y, 3179) > 0.9 - k * 0.3) {
              put(i, mix(pick(base, 4), TURQ, 0.4), UP, TURQ, 0.3 + k * 0.4);
              continue;
            }
            idx += k * 1.2;
          }
          const terrace = Math.sin(d * 0.5 + valueNoise(x, y, 10, 3181) * 5);
          if (terrace > 0.92) idx -= 0.9;
        }
      } else if (zone === 'river') {
        // River pebbles along the banks, wet slate further off, with puddles.
        if (wet > -26) {
          const cs = 6;
          const cx = Math.floor(x / cs);
          const cy = Math.floor(y / cs);
          const ox = cx * cs + 1 + hash2(cx, cy, 3191) * (cs - 2);
          const oy = cy * cs + 1 + hash2(cx, cy, 3193) * (cs - 2);
          const pr = 1.4 + hash2(cx, cy, 3195) * 1.6;
          const u = (px - ox) / pr;
          const v = (py - oy) / (pr * 0.75);
          if (u * u + v * v < 1 && hash2(cx, cy, 3197) > 0.2 + Math.max(0, -wet) / 40) {
            const pn = sphere(u, v, 0.8);
            put(i, pick(PEBBLE, 2.2 + hash2(cx, cy, 3199) * 1.8 + shadeOf([pn.x, pn.y, pn.z]) * 1.2), [pn.x, pn.y, pn.z]);
            continue;
          }
          idx -= 0.4;
        }
        if (valueNoise(x, y, 13, 3201) > 0.74) {
          put(i, mix(pick(base, 3), pick(WATER, 3), 0.45), UP, TURQ, 0.08);
          continue;
        }
      } else if (zone === 'abyss') {
        // Cracked slate; toward the chasm the cracks glow violet.
        const near = Math.max(0, 1 - Math.max(0, -wet) / 60);
        if (Math.abs(valueNoise(x, y, 12, 3211) - 0.5) < 0.016) {
          if (near > 0.2) {
            put(i, mix(pick(base, 1), AMETHYST, 0.4 * near), UP, AMETHYST, 0.45 * near);
            continue;
          }
          idx = 0.8;
        }
        // The lip of the chasm.
        if (wet > -3.5 && wet < 0) {
          put(i, pick(base, 5 + wet * 0.5), [0, 0.4, 0.9]);
          continue;
        }
      } else if (zone === 'heart') {
        const u = (px - HEART.cx) / HEART.rx;
        const v = (py - HEART.cy - 14) / HEART.ry;
        const r = Math.hypot(u, v);
        const a = Math.atan2(v, u);
        const ou: N3 = [u / (r || 1), -v / (r || 1), 0];
        const wob = (valueNoise(x, y, 14, 3221) - 0.5) * 0.03;
        const rr = r + wob;
        if (rr > 0.8 && rr < 0.86) {
          // A band of white quartz round the geode.
          put(i, pick(QUARTZ, 2.5 + (hash2(x, y, 3223) - 0.5) * 1.4 + (rr > 0.83 ? 0.6 : -0.3)), UP, QUARTZ[3], 0.12);
          continue;
        }
        if (rr > 0.66 && rr <= 0.8) {
          // Agate: fine bands of violet and lavender.
          const b = Math.sin(rr * 140 + valueNoise(x, y, 8, 3225) * 3);
          put(i, pick(AGATE, 2.6 + b * 1.5), UP, AMETHYST, b > 0.8 ? 0.12 : 0);
          continue;
        }
        if (rr > 0.62 && rr <= 0.66) {
          put(i, mix(pick(AGATE, 5), AMETHYST_HOT, 0.3), UP, AMETHYST, 0.5);
          continue;
        }
        if (rr > 0.24 && rr <= 0.62) {
          // Crystal teeth pointing in toward the heart, dark between them.
          const segs = 56;
          const seg = (Math.PI * 2) / segs;
          const sa = ((a % seg) + seg) % seg;
          const off = Math.abs(sa / seg - 0.5) * 2;
          const len = 0.3 + hash2(Math.floor((a + Math.PI) / seg), 0, 3227) * 0.32;
          const t = (0.62 - rr) / len;
          if (t < 1 && off < 1 - t) {
            const side = sa / seg - 0.5;
            const fn: N3 = [ou[0] * 0.3 + (side < 0 ? -0.4 : 0.4) * -ou[1], ou[1] * 0.3 + (side < 0 ? -0.4 : 0.4) * ou[0], 0.8];
            const s = shadeOf(fn);
            put(i, mix(pick(AGATE, 3 + s * 2 + (1 - t)), AMETHYST_HOT, t > 0.8 ? 0.3 : 0), fn, AMETHYST, 0.3 + t * 0.35);
            continue;
          }
          put(i, pick(AGATE, 0.6 + (1 - rr) * 0.8), UP);
          continue;
        }
        if (rr > 0.2 && rr <= 0.24) {
          // The rim of the dais.
          const rim: N3 = [ou[0] * 0.5, ou[1] * 0.5, 0.85];
          put(i, pick(base, 4 + shadeOf(rim) * 1.5), rim);
          continue;
        }
        if (rr <= 0.2) {
          // The dais: polished dark stone, a wyrm's coil carved in light.
          const sr = r / 0.2;
          const turn = (a + Math.PI) / (Math.PI * 2);
          const coil = ((sr * 3.2 - turn) % 1 + 1) % 1;
          const onCoil = sr > 0.18 && sr < 0.92 && Math.abs(coil - 0.5) < 0.09;
          if (onCoil) {
            put(i, mix(pick(base, 3), AMETHYST, 0.55), UP, AMETHYST, 0.7 + (1 - sr) * 0.3);
            continue;
          }
          if (sr <= 0.18) {
            put(i, mix(pick(base, 4), AMETHYST_HOT, 0.4), UP, AMETHYST_HOT, 0.55);
            continue;
          }
          put(i, pick(base, 2 + (hash2(x, y, 3229) > 0.97 ? 1.5 : 0) + (valueNoise(x, y, 6, 3231) - 0.5) * 0.6), UP);
          continue;
        }
      }

      if (zone === 'crystal' || zone === 'throat' || zone === 'heart') {
        // Shards of amethyst set in the stone, thicker by the walls.
        const cs = zone === 'throat' ? 8 : 10;
        const cx = Math.floor(x / cs);
        const cy = Math.floor(y / cs);
        const odds = (zone === 'throat' ? 0.16 : 0.1) + (d < 18 ? 0.12 : 0);
        if (hash2(cx, cy, 3241) < odds) {
          const sx = cx * cs + 2 + hash2(cx, cy, 3243) * (cs - 4);
          const sy = cy * cs + 3 + hash2(cx, cy, 3245) * (cs - 5);
          const ht = 3 + Math.floor(hash2(cx, cy, 3247) * 3);
          const lean = hash2(cx, cy, 3249) > 0.5 ? 1 : -1;
          const dy = Math.floor(sy - py);
          if (dy >= 0 && dy < ht) {
            const cxr = sx + (dy / ht) * lean;
            const w = dy === ht - 1 ? 0.6 : 1.3;
            if (Math.abs(px - cxr) < w) {
              const left = px < cxr;
              put(i, left ? pick(AGATE, 5) : mix(pick(AGATE, 3), AMETHYST_HOT, dy === ht - 1 ? 0.5 : 0), [left ? -0.5 : 0.4, 0.2, 0.8], AMETHYST, 0.45 + dy * 0.08);
              continue;
            }
          }
          if (dy === -1 && Math.abs(px - sx) < 2) idx -= 1.3;
        }
        // Geode patches: rings of lavender in the stone.
        if (zone !== 'heart') {
          const gp = valueNoise(x, y, 34, 3251);
          if (gp > 0.72) {
            const b = Math.sin(gp * 90);
            tint = pick(AGATE, 2 + b * 1.2);
            tk = 0.4 * Math.min(1, (gp - 0.72) * 12);
          }
          if (zone === 'throat' && Math.abs(valueNoise(x, y, 17, 3253) - 0.5) < 0.012) {
            put(i, mix(pick(base, 2), AMETHYST, 0.45), UP, AMETHYST, 0.4);
            continue;
          }
        }
      }

      // Little glowing mushrooms sprouting on the floor, thickest by the walls.
      if (zone !== 'heart' && zone !== 'abyss') {
        const cs = 11;
        const cx = Math.floor(x / cs);
        const cy = Math.floor(y / cs);
        const odds = (zone === 'forest' || zone === 'hollow' ? 0.07 : zone === 'lantern' || zone === 'well' ? 0.035 : 0.015) + (d < 16 ? 0.14 : 0);
        if (hash2(cx, cy, 3261) < odds) {
          const sx = Math.floor(cx * cs + 2 + hash2(cx, cy, 3263) * (cs - 4));
          const sy = Math.floor(cy * cs + 3 + hash2(cx, cy, 3265) * (cs - 5));
          const dx = x - sx;
          const dy = y - sy;
          const g = zone === 'crystal' || zone === 'throat' ? AMETHYST : hash2(cx, cy, 3267) > 0.55 ? MAGENTA : CYAN;
          if (dy === -2 && Math.abs(dx) <= 1) {
            put(i, mix(pick(base, 5), g, 0.5), [dx * 0.3, 0.5, 0.8], g, 0.7);
            continue;
          }
          if (dy === -1 && dx === 0) {
            put(i, pick(BONE, 2), UP);
            continue;
          }
          if (dy === 0 && (dx === 0 || dx === 1)) idx -= 1.3;
        }
      }

      // Grime toward the walls; the north walls cast a shadow down onto the floor.
      if (d < 9) idx -= (9 - d) * 0.28;
      if (y > 0 && open[i - W] === 0) idx -= 1.6;
      else if (y > 3 && open[i - 3 * W] === 0 && face[i - 3 * W]) idx -= 0.8;
      // Grit.
      const gr = hash2(x, y, 3271);
      if (gr > 0.94) idx += 0.7;
      else if (gr < 0.05) idx -= 0.8;
      let c = pick(base, idx + shadeOf(n) * 0.9);
      if (tint) c = mix(c, tint, tk);
      put(i, c, n, glow, gk);
    }
  }

  // Old bones: explorers who never came back up.
  for (const [bx, by, flip] of BONES) stampBones(Math.round(bx), Math.round(by), flip, (x, y) => open[y * W + x] === 1, (x, y, c, n) => put(y * W + x, c, n));
  return { diffuse, normal, emissive };
}

/** A skull and a scatter of bones, stamped onto the floor. */
function stampBones(bx: number, by: number, flip: boolean, floor: (x: number, y: number) => boolean, put: (x: number, y: number, c: RGB, n: N3) => void): void {
  const skull = ['.###.', '#####', '#o#o#', '.###.', '.#.#.'];
  const f = flip ? -1 : 1;
  const at = (x: number, y: number, c: RGB, n: N3 = UP) => {
    if (x < 0 || y < 0 || x >= DEEP_W || y >= DEEP_H || !floor(x, y)) return;
    put(x, y, c, n);
  };
  skull.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      const lit = x < 2 && y < 2;
      at(bx + (x - 2) * f, by + y - 4, ch === 'o' ? BONE[0] : BONE[lit ? 4 : y > 2 ? 2 : 3], ch === 'o' ? UP : [(x - 2) * 0.2 * f, (2 - y) * 0.2, 0.9]);
    }),
  );
  // Ribs and a long bone beside it.
  for (let k = 0; k < 4; k++) {
    const x0 = bx + (5 + k * 2) * f;
    for (let y = 0; y < 3; y++) at(x0 + (y === 1 ? f : 0), by - 1 + y, BONE[y === 0 ? 3 : 2]);
  }
  for (let k = 0; k < 7; k++) at(bx - (4 + k) * f, by + 3 + Math.floor(k / 3), BONE[k === 0 || k === 6 ? 4 : 3]);
  at(bx - 3 * f, by + 2, BONE[4]);
  at(bx - 11 * f, by + 5, BONE[4]);
}

// ---------------------------------------------------------------- Props

const INK = hex('#07050c');
const STEM: Material = { ramp: ramp('#2a3040', '#3e4658', '#566076', '#728098', '#96a4bc', '#c0ccdc'), outline: INK, outlineLit: hex('#1a2030') };
const GILL = (g: string): Material => ({ ramp: ramp('#0c0a14', '#18142a', g), outline: INK, emissive: 0.35, noAO: true });
const CAPS: { cap: Material; spot: Material; glow: RGB }[] = [
  {
    cap: { ramp: ramp('#0a1a3a', '#10305a', '#16508a', '#1e74b8', '#34a0dc', '#6ad0f4'), outline: hex('#050c1c'), outlineLit: hex('#0e2448'), emissive: 0.28, shine: true },
    spot: { ramp: ramp('#7ae8ff', '#c8f8ff', '#ffffff'), outline: INK, emissive: 1, noAO: true, noOutline: true },
    glow: CYAN,
  },
  {
    cap: { ramp: ramp('#2a0a34', '#46105a', '#6a1a84', '#9028a8', '#c044c8', '#f07ae0'), outline: hex('#14041c'), outlineLit: hex('#360c44'), emissive: 0.28, shine: true },
    spot: { ramp: ramp('#ff9ae8', '#ffd0f4', '#ffffff'), outline: INK, emissive: 1, noAO: true, noOutline: true },
    glow: MAGENTA,
  },
];
const ROCK: Material = { ramp: ramp('#100e18', '#1a1726', '#262236', '#332e48', '#433c5a', '#554d6e', '#6a6284'), outline: INK, outlineLit: hex('#1e1a2c') };
const CRYSTAL_M: Material = { ramp: ramp('#2a1450', '#4a2484', '#7240bc', '#9c68e8', '#c8a0ff', '#f0e2ff'), outline: hex('#12062a'), emissive: 0.55, shine: true, noAO: true };
const CRYSTAL_DARK: Material = { ramp: ramp('#1c0c38', '#321660', '#4e2890'), outline: hex('#12062a'), emissive: 0.35, noAO: true };
const WOOD: Material = { ramp: ramp('#1e140e', '#2e2016', '#44301e', '#5c4228', '#765636'), outline: INK };
const IRON: Material = { ramp: ramp('#14141c', '#22222e', '#343444', '#4c4c5e', '#6a6a7e'), outline: INK, shine: true };
const FLAME: Material = { ramp: ramp('#c0460c', '#ff8a24', '#ffc050', '#ffe89a', '#fffbe8'), outline: INK, emissive: 1, noAO: true, noOutline: true };
const HOT = hex('#fff0c0');
const WHITE = hex('#ffffff');

export const SHROOM_W = 46;
export const SHROOM_H = 66;
export const SHROOM_OY = 63;

/** A giant glowing mushroom: a pale stem with a ring, a broad cap with glowing spots, its gills alight underneath. */
export function giantShroom(v: number): PixelCanvas {
  const c = new PixelCanvas(SHROOM_W, SHROOM_H);
  const S = CAPS[v % 2];
  const cx = 23;
  const R = rng(v * 131 + 17);
  // Roots spreading at the foot.
  c.part();
  for (const [dx, len] of [[-1, 7], [1, 8], [-1, 4], [1, 5]] as const) {
    const y0 = 60 + (len > 6 ? 1 : 0);
    c.capsule(cx + dx * 3, y0, cx + dx * (3 + len), y0 + 2, 1.6, 0.8, STEM);
  }
  // The stem, leaning a little and thickening at the foot.
  c.part();
  const lean = v % 2 ? 1.5 : -1.5;
  c.shape(24, 62, (y) => {
    const u = (y - 24) / 38;
    const hw = 3.6 + u * u * 2.6;
    const x = cx + lean * (1 - u);
    return [x - hw, x + hw];
  }, STEM, (_x, _y, t) => cyl(t, 0.1));
  for (let y = 30; y < 60; y += 3) c.shade(cx + lean * (1 - (y - 24) / 38) + (R() - 0.5) * 4, y, -1);
  // The ring, a skirt round the stem.
  c.part();
  c.shape(34, 37, (y) => {
    const hw = 5.4 + (y - 34) * 0.6;
    const x = cx + lean * 0.65;
    return [x - hw, x + hw];
  }, STEM, (_x, _y, t, u) => cyl(t, 0.5 - u));
  // Gills: the underside of the cap, glowing between dark ribs.
  c.part();
  c.shape(20, 26, (y) => {
    const u = (y - 20) / 6;
    const hw = 20 - u * 11;
    return [cx + lean - hw, cx + lean + hw];
  }, GILL(v % 2 ? '#c048b0' : '#3aa0d0'), (x) => ((x - cx) % 3 === 0 ? { x: 0, y: -0.2, z: 0.6 } : { x: 0, y: -0.6, z: 0.8 }));
  for (let x = -18; x <= 18; x += 3) for (let y = 21; y < 25; y++) c.spark(cx + lean + x + (y - 21) * Math.sign(x) * -0.6, y, S.glow, 0.35);
  // The cap: a broad dome.
  c.part();
  c.shape(2, 22, (y) => {
    const u = (y - 2) / 20;
    const hw = 3 + Math.sin(Math.min(1, u * 1.15) * Math.PI * 0.5) * 19.5;
    return [cx + lean - hw, cx + lean + hw];
  }, S.cap, (_x, y, t) => sphere(t * 0.95, ((y - 2) / 20) * 1.3 - 0.9, 0.9));
  // Its rim curls under.
  for (let x = -20; x <= 20; x++) c.shade(cx + lean + x, 21, -1);
  // Spots glowing on the cap.
  c.part();
  const spots: [number, number, number][] = [[-9, 9, 2.2], [6, 7, 2.6], [-2, 4, 1.6], [13, 14, 1.8], [-15, 16, 1.5], [1, 14, 2], [-7, 17, 1.3], [9, 18, 1.2]];
  for (const [dx, y, r] of spots) c.ellipse(cx + lean + dx, y, r, r * 0.8, S.spot);
  c.spark(cx + lean - 8, 5, WHITE, 0.5);
  return c;
}

export const CAPS_W = 20;
export const CAPS_H = 18;
export const CAPS_OY = 16;

/** A cluster of little glowing mushrooms. */
export function capCluster(v: number): PixelCanvas {
  const c = new PixelCanvas(CAPS_W, CAPS_H);
  const S = CAPS[v % 2];
  const R = rng(v * 71 + 5);
  const caps: [number, number, number][] = [[6, 16, 3.4], [11, 16, 4.6], [15, 16, 2.6], [3, 16, 2], [9, 16, 2.4]];
  caps.forEach(([x, foot, r], k) => {
    const h = 4 + r * 1.3 + R() * 2;
    const top = foot - h;
    c.part();
    c.shape(Math.round(top + r * 0.5), foot, () => [x - 0.9, x + 0.9], STEM, (_x, _y, t) => cyl(t));
    c.part();
    c.shape(Math.round(top - r * 0.5), Math.round(top + r * 0.5), (y) => {
      const u = (y - (top - r * 0.5)) / r;
      const hw = 0.6 + Math.sin(Math.min(1, u * 1.2) * Math.PI * 0.5) * r;
      return [x - hw, x + hw];
    }, S.cap, (_x, y, t) => sphere(t, (y - top) / r, 0.9));
    if (r > 3) c.px(x - 1, top - 1, S.spot);
    c.spark(x, top + r * 0.5 + 1, S.glow, 0.5);
    if (k === 1) c.px(x + 1, top, S.spot);
  });
  return c;
}

export const STALAG_W = 22;
export const STALAG_H = 42;
export const STALAG_OY = 39;

/** A stalagmite of cave rock, ringed where it grew, glowworms at its foot. */
export function stalagmite(v: number): PixelCanvas {
  const c = new PixelCanvas(STALAG_W, STALAG_H);
  const R = rng(v * 37 + 11);
  const spike = (cx: number, top: number, base: number, hw: number) => {
    c.part();
    c.shape(top, base, (y) => {
      const u = (y - top) / (base - top);
      const w = 0.5 + Math.pow(u, 0.8) * hw + Math.sin(y * 0.9) * 0.3;
      return [cx - w, cx + w];
    }, ROCK, (_x, _y, t) => cyl(t, 0.25));
    for (let y = top + 3; y < base; y += 4) for (let x = -hw; x <= hw; x++) if (R() < 0.5) c.shade(cx + x, y, -1);
  };
  if (v % 2) {
    spike(8, 14, 39, 6);
    spike(15, 6, 39, 5.5);
  } else spike(11, 3, 39, 8);
  c.part();
  c.ellipse(11, 38.5, 9, 2.2, ROCK, { flatten: 0.4 });
  for (let k = 0; k < 4; k++) c.spark(4 + R() * 14, 33 + R() * 5, WORM, 0.5 + R() * 0.4);
  return c;
}

export const CRYS_W = 26;
export const CRYS_H = 32;
export const CRYS_OY = 29;

/** A cluster of amethyst growing out of a rock. */
export function amethystCluster(v: number): PixelCanvas {
  const c = new PixelCanvas(CRYS_W, CRYS_H);
  c.part();
  c.ellipse(13, 26, 9, 4.5, ROCK);
  const shards: [number, number, number, number, number][] = v % 2
    ? [[13, 28, 11, 3, 3], [8, 28, 4, 11, 2.2], [18, 28, 22, 12, 2.2], [11, 28, 8, 16, 1.8], [16, 28, 17, 17, 1.6]]
    : [[12, 28, 13, 4, 3.2], [7, 28, 3, 14, 2.2], [17, 28, 21, 9, 2.4], [15, 28, 16, 15, 1.7], [9, 28, 9, 18, 1.5]];
  shards.forEach(([bx, by, tx, ty, r], k) => {
    c.part();
    c.shape(ty, by, (y) => {
      const u = (y - ty) / (by - ty);
      const hw = 0.3 + Math.min(1, u * 3) * r;
      const x = tx + (bx - tx) * u;
      return [x - hw, x + hw];
    }, k === 0 ? CRYSTAL_M : k % 2 ? CRYSTAL_DARK : CRYSTAL_M, (_x, _y, t) => ({ x: t < 0 ? -0.6 : 0.5, y: 0.3, z: 0.7 }));
    c.spark(tx, ty + 1, AMETHYST_HOT, 0.7);
  });
  return c;
}

export const SPIRE_W = 32;
export const SPIRE_H = 72;
export const SPIRE_OY = 68;

/** A great spire of amethyst, a six-sided column coming to a point, lesser crystals at its foot. */
export function amethystSpire(v: number): PixelCanvas {
  const c = new PixelCanvas(SPIRE_W, SPIRE_H);
  const cx = 16 + (v % 2 ? 1 : -1);
  c.part();
  c.ellipse(16, 66, 12, 4.5, ROCK);
  // The column: three visible facets, darker on the right.
  c.part();
  const lean = v % 2 ? -2 : 2;
  c.shape(4, 66, (y) => {
    const u = (y - 4) / 62;
    const hw = u < 0.2 ? 0.8 + (u / 0.2) * 5.6 : 6.4;
    const x = cx + lean * (1 - u);
    return [x - hw, x + hw];
  }, CRYSTAL_M, (x, y) => {
    const u = (y - 4) / 62;
    const t = (x + 0.5 - (cx + lean * (1 - u))) / 6.4;
    return t < -0.33 ? { x: -0.7, y: 0.2, z: 0.7 } : t < 0.33 ? { x: 0, y: 0.25, z: 0.95 } : { x: 0.75, y: 0.1, z: 0.6 };
  });
  // Bright edges between the facets, and cloud inside.
  for (let y = 14; y < 64; y++) {
    const u = (y - 4) / 62;
    const x = cx + lean * (1 - u);
    c.spark(x - 2, y, AMETHYST_HOT, 0.25);
    c.spark(x + 2, y, AMETHYST, 0.2);
  }
  c.spark(cx + lean, 5, WHITE, 1);
  c.spark(cx + lean, 6, AMETHYST_HOT, 0.8);
  // Lesser crystals at its foot.
  for (const [bx, tx, ty, r] of [[9, 4, 50, 2.4], [23, 28, 53, 2.2], [12, 10, 56, 1.8], [21, 22, 57, 1.6]] as const) {
    c.part();
    c.shape(ty, 67, (y) => {
      const u = (y - ty) / (67 - ty);
      const hw = 0.3 + Math.min(1, u * 3) * r;
      const x = tx + (bx - tx) * u;
      return [x - hw, x + hw];
    }, CRYSTAL_DARK, (_x, _y, t) => ({ x: t < 0 ? -0.6 : 0.5, y: 0.3, z: 0.7 }));
    c.spark(tx, ty + 1, AMETHYST_HOT, 0.6);
  }
  return c;
}

export const LANTERN_W = 16;
export const LANTERN_H = 38;
export const LANTERN_OY = 36;
export const LANTERN_FRAMES = 4;

/** An explorers' lantern: an iron lamp hung from a crooked post, a candle flickering in it. */
export function lanternPost(f: number): PixelCanvas {
  const c = new PixelCanvas(LANTERN_W, LANTERN_H);
  // The post, a stake driven into the floor, and its arm.
  c.part();
  c.shape(4, 36, () => [3, 5.5], WOOD, (_x, _y, t) => cyl(t));
  c.part();
  c.shape(4, 6, () => [3, 12], WOOD, (_x, _y, t) => cyl(t * 0.3, 0.8));
  c.part();
  c.ellipse(4.2, 36, 3.4, 1.4, ROCK, { flatten: 0.4 });
  // The chain and the lamp.
  c.part();
  c.px(11, 7, IRON);
  c.px(11, 8, IRON);
  c.part();
  c.shape(9, 10, () => [8.5, 13.5], IRON, (_x, _y, t) => cyl(t, 0.7));
  c.shape(19, 20, () => [8.5, 13.5], IRON, (_x, _y, t) => cyl(t, 0.2));
  c.part();
  c.shape(11, 18, () => [8.5, 13.5], { ramp: ramp('#5a3a10', '#b07a24', '#ffc050', '#ffe8a0'), outline: IRON.outline, emissive: 0.7, noAO: true }, (_x, _y, t) => cyl(t, 0.1));
  for (let y = 11; y <= 18; y++) {
    c.px(8, y, IRON);
    c.px(13, y, IRON);
  }
  // The flame inside.
  c.part();
  const top = 12 + (f % 2);
  c.shape(top, 17, (y) => {
    const u = (y - top) / (17 - top);
    const hw = 0.3 + u * 1.4;
    const s = [0, 0.4, 0, -0.4][f % 4] * (1 - u);
    return [10.9 - hw + s, 11.1 + hw + s];
  }, FLAME, () => FLAT);
  c.spark(11, 15, HOT, 0.9);
  return c;
}
