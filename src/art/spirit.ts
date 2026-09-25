// The Spirit Dungeon's art: the whole floor plan painted in one piece (lit,
// with a normal map and a glow layer), and the things that stand in it.
//
// The floor is old flagstone, cold and blue-grey, grimed toward the walls
// and cracked, with spectral moss and puddles of glowing ectoplasm here and
// there, bones where the lost fell, faint rune circles in each chamber, a
// pool of spirit-water in the ossuary and a great ritual circle in the
// Sanctum. The north walls show their faces, courses of dark brick with
// ghost-light seeping from cracks; every wall is capped in stone, and past
// the caps lies solid dark. Props: spirit braziers, gothic pillars, tombs,
// mourning statues holding lanterns, and candles.

import { mix } from './bitmap';
import { hash2, rng, valueNoise } from './env';
import { KEY_LIGHT, PixelCanvas, cyl, hex, sphere, type Material, type RGB } from './pixel';
import { POOL, SANCTUM, SPIRIT_H, SPIRIT_PROPS, SPIRIT_W, WALL_H, spiritFloor } from '../world/spiritLayout';

const ramp = (...c: string[]): RGB[] => c.map(hex);

function fbm(x: number, y: number, scale: number, seed: number, octaves = 3): number {
  let v = 0;
  let amp = 0.5;
  let s = scale;
  let total = 0;
  for (let i = 0; i < octaves; i++) {
    v += valueNoise(x, y, s, seed + i * 17) * amp;
    total += amp;
    amp *= 0.5;
    s *= 0.5;
  }
  return v / total;
}

// ---------------------------------------------------------------- Palette

const STONE = ramp('#0b0a14', '#131221', '#1b1a2c', '#242438', '#2e2f46', '#3a3c55', '#4a4d68');
const SANCT = ramp('#0d0b18', '#161226', '#1f1a34', '#292344', '#342e56', '#443c6c', '#57507f');
const FACE = ramp('#08070f', '#0f0e1b', '#171627', '#201f33', '#2a2a40', '#36374f');
const CAP = ramp('#100f1c', '#1a1929', '#242437', '#303048', '#3e3f5a', '#50526e');
const MASS: RGB = hex('#050409');
const GROUT: RGB = hex('#07060d');
const BONE = ramp('#4e493f', '#7a7362', '#a8a08a', '#d2cab2', '#efe8d4');
const MOSS = ramp('#0c1a1c', '#12282a', '#1a3a3a', '#24504c');
const WATER = ramp('#04141a', '#073038', '#0c5058', '#18807e', '#3cc0b0', '#9cf4e2', '#e6fff8');

export const GHOST_TEAL: RGB = hex('#6af4dc');
export const GHOST_BLUE: RGB = hex('#8ac8ff');
export const GHOST_VIOLET: RGB = hex('#b89cff');
const GHOST_WHITE: RGB = hex('#e8fff8');

/** Particle tints for spirit bursts: ghost-white, teal, pale blue and lilac. */
export const SPIRIT_TINTS = [0xe8fff8, 0x6af4dc, 0x8ac8ff, 0xb89cff];

export interface SpiritArt {
  diffuse: Uint8ClampedArray;
  normal: Uint8ClampedArray;
  emissive: Uint8ClampedArray;
}

type N3 = [number, number, number];
const UP: N3 = [0, 0, 1];

/**
 * Distance from every pixel to the nearest set pixel of `mask`, up to `max`
 * (a two-pass chamfer: close enough to round).
 */
function* distanceTo(mask: Uint8Array, W: number, H: number, max: number): Generator<void, Float32Array, void> {
  const d = new Float32Array(W * H).fill(max);
  for (let i = 0; i < W * H; i++) if (mask[i]) d[i] = 0;
  const D = Math.SQRT2;
  for (let y = 0; y < H; y++) {
    if (y % 64 === 0) yield;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let v = d[i];
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
    if (y % 64 === 0) yield;
    for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      let v = d[i];
      if (x < W - 1) v = Math.min(v, d[i + 1] + 1);
      if (y < H - 1) {
        v = Math.min(v, d[i + W] + 1);
        if (x < W - 1) v = Math.min(v, d[i + W + 1] + D);
        if (x > 0) v = Math.min(v, d[i + W - 1] + D);
      }
      d[i] = v;
    }
  }
  return d;
}

/**
 * Is (u, v) on the Sanctum's inner sigil: a ring with seven small rings set
 * round it, and faint spokes from each to the heart? `w` is a line's
 * half-width, in the same units.
 */
function onSigil(u: number, v: number, w: number): boolean {
  const r = Math.hypot(u, v);
  if (Math.abs(r - 0.3) < w) return true;
  for (let k = 0; k < 7; k++) {
    const a = -Math.PI / 2 + (k * Math.PI * 2) / 7;
    const nx = Math.cos(a) * 0.3;
    const ny = Math.sin(a) * 0.3;
    const d = Math.hypot(u - nx, v - ny);
    if (Math.abs(d - 0.055) < w) return true;
    // A spoke from the ring's node in toward the dais.
    const t = (u * nx + v * ny) / 0.09;
    if (t > 0.5 && t < 0.8 && Math.abs(u * ny - v * nx) / 0.3 < w * 0.8) return true;
  }
  return false;
}

/** Small pale decals: skulls and scattered bones where the `bones` props lie. */
function boneDecals(): Map<number, RGB> {
  const out = new Map<number, RGB>();
  const put = (x: number, y: number, c: RGB) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < SPIRIT_W && y < SPIRIT_H) out.set(y * SPIRIT_W + x, c);
  };
  SPIRIT_PROPS.forEach((p, n) => {
    if (p.kind !== 'bones') return;
    const R = rng(n * 97 + 5);
    const s = p.flip ? -1 : 1;
    // A skull: a rounded dome, two dark sockets and a jaw.
    const sk = [
      '.aab.',
      'abbbc',
      'bdbdc',
      'bbbcc',
      '.cec.',
    ];
    sk.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch === '.') return;
        const c = ch === 'a' ? BONE[4] : ch === 'b' ? BONE[3] : ch === 'c' ? BONE[1] : ch === 'd' ? GROUT : BONE[0];
        put(p.x + (s > 0 ? x : 4 - x) - 2, p.y + y - 3, c);
      }),
    );
    // Long bones lying about it, each with knobbed ends.
    for (let k = 0; k < 3; k++) {
      const a = R() * Math.PI;
      const len = 5 + R() * 4;
      const bx = p.x + s * (6 + R() * 10);
      const by = p.y + (R() - 0.3) * 8;
      for (let i = 0; i <= len; i++) put(bx + Math.cos(a) * (i - len / 2), by + Math.sin(a) * (i - len / 2) * 0.6, i === 0 || i >= len - 0.5 ? BONE[4] : BONE[2]);
      put(bx + Math.cos(a) * (len / 2) + 1, by + Math.sin(a) * (len / 2) * 0.6, BONE[3]);
      put(bx - Math.cos(a) * (len / 2) - 1, by - Math.sin(a) * (len / 2) * 0.6, BONE[3]);
    }
    // A few loose fragments.
    for (let k = 0; k < 4; k++) put(p.x + s * (R() - 0.5) * 22, p.y + (R() - 0.5) * 10, BONE[1 + Math.floor(R() * 3)]);
  });
  return out;
}

/** The chamber a floor pixel belongs to, for its rune circle: centre and radius. */
const RUNE_CIRCLES = [
  { cx: 280, cy: 1270, r: 34, seed: 1 },
  { cx: 280, cy: 994, r: 30, seed: 2 },
  { cx: 280, cy: 482, r: 0, seed: 3 },
];

/**
 * The dungeon floor plan in one image: diffuse, a normal map for the
 * lights, and a glow layer. Built a few rows at a time.
 */
export function* spiritArt(): Generator<void, SpiritArt, void> {
  const W = SPIRIT_W;
  const H = SPIRIT_H;
  const N = W * H;
  const diffuse = new Uint8ClampedArray(N * 4);
  const normal = new Uint8ClampedArray(N * 4);
  const emissive = new Uint8ClampedArray(N * 4);
  const L = KEY_LIGHT;
  const Ll = Math.hypot(L.x, L.y, L.z);

  // 1. What each pixel is: floor, pool, or wall.
  const floor = new Uint8Array(N);
  const pool = new Uint8Array(N);
  for (let y = 0; y < H; y++) {
    if (y % 64 === 0) yield;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (spiritFloor(x + 0.5, y + 0.5)) floor[i] = 1;
      else {
        const u = (x + 0.5 - POOL.cx) / POOL.rx;
        const v = (y + 0.5 - POOL.cy) / POOL.ry;
        if (u * u + v * v < 1) pool[i] = 1;
      }
    }
  }
  // 2. Wall faces: the WALL_H pixels of wall just north of any floor.
  const face = new Uint8Array(N); // height above the floor, 1..WALL_H; 0 = no face
  for (let x = 0; x < W; x++) {
    let below = -1;
    for (let y = H - 1; y >= 0; y--) {
      const i = y * W + x;
      if (floor[i] || pool[i]) {
        below = floor[i] ? y : -1;
        continue;
      }
      if (below >= 0 && below - y <= WALL_H) face[i] = below - y;
      else below = -1;
    }
  }
  yield;
  // 3. Distances: open floor from the walls (grime), and wall from the floor and faces (the caps).
  const solid = new Uint8Array(N);
  const wall = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    solid[i] = floor[i] || face[i] || pool[i] ? 1 : 0;
    wall[i] = floor[i] || pool[i] ? 0 : 1;
  }
  const fromOpen = yield* distanceTo(solid, W, H, 12);
  const fromWall = yield* distanceTo(wall, W, H, 14);
  const decals = boneDecals();

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
    if (glow) {
      emissive[o] = Math.min(255, emissive[o] + glow[0] * gk);
      emissive[o + 1] = Math.min(255, emissive[o + 1] + glow[1] * gk);
      emissive[o + 2] = Math.min(255, emissive[o + 2] + glow[2] * gk);
      emissive[o + 3] = 255;
    }
  };
  const shadeOf = (n: N3) => (n[0] * L.x + n[1] * L.y + n[2] * L.z) / ((Math.hypot(n[0], n[1], n[2]) || 1) * Ll);
  const pick = (r: RGB[], idx: number) => r[Math.max(0, Math.min(r.length - 1, Math.round(idx)))];

  for (let y = 0; y < H; y++) {
    if (y % 10 === 0) yield;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;

      // ---- The pool of spirit-water.
      if (pool[i]) {
        const u = (x + 0.5 - POOL.cx) / POOL.rx;
        const v = (y + 0.5 - POOL.cy) / POOL.ry;
        const r = Math.hypot(u, v);
        const deep = 1 - r;
        const ripple = Math.sin(r * 26 - fbm(x, y, 10, 71, 2) * 5) * 0.5 + 0.5;
        let idx = 1 + deep * 2.6 + (ripple > 0.8 ? 1 : 0);
        // The lip's shadow falls across the water's north edge.
        if (v < 0 && r > 0.86) idx -= 1;
        if (hash2(x, y, 31) > 0.992) idx = 6;
        const c = pick(WATER, idx);
        put(i, c, UP, c, 0.45 + deep * 0.5);
        continue;
      }

      // ---- Wall faces: courses of dark brick.
      if (face[i]) {
        const h = face[i];
        const yy = WALL_H - h;
        const row = Math.floor(yy / 6);
        const off = row % 2 ? 7 : 0;
        const bx = Math.floor((x + off) / 14);
        const lx = (x + off) % 14;
        const ly = yy % 6;
        const faceN: N3 = [0, -0.5, 0.86];
        if (ly === 5 || lx === 0) {
          put(i, pick(FACE, 0), faceN);
          continue;
        }
        const brick = hash2(bx, row, 41);
        let n = faceN;
        let idx = 2.4 + (brick - 0.5) * 1.4 + (fbm(x, y, 5, 43, 2) - 0.5) * 0.9;
        if (ly === 0) {
          n = [0, 0.3, 0.95];
          idx += 1;
        } else if (lx === 1) idx += 0.5;
        else if (lx === 13 || ly === 4) idx -= 0.5;
        // Dark at the foot of the wall, a little darker toward its top.
        if (h <= 2) idx -= 2;
        else if (h <= 4) idx -= 1;
        if (yy < 3) idx -= 0.5;
        // Cracks, some seeping ghost-light.
        const crack = Math.abs(fbm(x * 1.6, y, 22, 47, 2) - 0.5);
        if (crack < 0.018 && h > 3) {
          const seep = hash2(Math.floor(x / 60), 0, 49) > 0.62;
          if (seep) put(i, mix(pick(FACE, 1), GHOST_TEAL, 0.35), faceN, GHOST_TEAL, 0.55 * (1 - h / WALL_H) + 0.25);
          else put(i, pick(FACE, 0), faceN);
          continue;
        }
        put(i, pick(FACE, idx + shadeOf(n) * 0.6), n);
        continue;
      }

      // ---- Floor.
      if (floor[i]) {
        const wd = fromWall[i];
        const sanct = y < 440;
        const base = sanct ? SANCT : STONE;
        let n: N3 = UP;
        let idx = 3;
        let glow: RGB | undefined;
        let gk = 0;
        let grout = false;

        if (sanct) {
          // The Sanctum: rings of wedge-shaped stones round the ritual circle.
          const u = (x + 0.5 - SANCTUM.cx) / SANCTUM.rx;
          const v = (y + 0.5 - SANCTUM.cy) / SANCTUM.ry;
          const r = Math.hypot(u, v);
          const a = Math.atan2(v, u);
          const rings = [0, 0.13, 0.26, 0.4, 0.5, 0.58, 0.72, 0.86, 1.2];
          let ring = 0;
          while (ring < rings.length - 2 && r >= rings[ring + 1]) ring++;
          const r0 = rings[ring];
          const r1 = rings[ring + 1];
          const segs = [1, 10, 16, 24, 1, 32, 40, 48][ring];
          const seg = (Math.PI * 2) / segs;
          const sa = (((a % seg) + seg) % seg);
          const dA = segs > 1 ? Math.min(sa, seg - sa) * r * SANCTUM.rx : 99;
          const dR = Math.min(r - r0, r1 - r) * SANCTUM.ry;
          const stoneId = hash2(Math.floor((a + Math.PI) / seg), ring, 51);
          if (ring === 4) {
            // The ritual band: a dark channel between two glowing rings, runes along it.
            const edge = Math.min(r - r0, r1 - r) * SANCTUM.ry;
            if (edge < 1.2) {
              put(i, mix(pick(SANCT, 2), GHOST_TEAL, 0.55), UP, GHOST_TEAL, 0.85);
              continue;
            }
            const rune = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 36);
            const ra = ((a + Math.PI) / (Math.PI * 2)) * 36 - rune;
            const rr = (r - r0) / (r1 - r0);
            const glyph = hash2(rune, Math.floor(ra * 3), 53) > 0.45 && Math.abs(rr - 0.5) < 0.28 && ra > 0.2 && ra < 0.8 && hash2(rune, Math.floor(rr * 4), 55) > 0.35;
            if (glyph) {
              put(i, mix(pick(SANCT, 1), GHOST_BLUE, 0.4), UP, GHOST_BLUE, 0.7);
              continue;
            }
            put(i, pick(SANCT, 1 + (fbm(x, y, 6, 57, 2) - 0.5)), UP);
            continue;
          }
          if (dA < 0.7 || dR < 0.8) grout = true;
          else {
            idx = 3 + (stoneId - 0.5) * 1.5 + (fbm(x, y, 7, 59, 2) - 0.5) * 1;
            if (dA < 1.7 || dR < 1.7) {
              const ou: N3 = [u / (r || 1), -v / (r || 1), 0];
              n = dR < 1.7 && r - r0 < r1 - r ? [-ou[0] * 0.35, -ou[1] * 0.35, 0.9] : [ou[0] * 0.35, ou[1] * 0.35, 0.9];
            }
          }
          // The sigil inside the circle, and the dais at its heart.
          if (r < 0.4 && onSigil(u, v, 0.8 / SANCTUM.ry)) {
            put(i, mix(pick(SANCT, 2), GHOST_VIOLET, 0.45), UP, GHOST_VIOLET, 0.5);
            continue;
          }
          if (r < 0.13) {
            const ou: N3 = [u / (r || 1), -v / (r || 1), 0];
            const rim = r > 0.11;
            idx = 3.5 + (rim ? 0 : -0.5) + (fbm(x, y, 5, 61, 2) - 0.5);
            n = rim ? [ou[0] * 0.6, ou[1] * 0.6, 0.8] : UP;
            grout = false;
            if (r < 0.035) {
              put(i, mix(pick(SANCT, 4), GHOST_WHITE, 0.4), UP, GHOST_TEAL, 0.7);
              continue;
            }
          }
          if (!grout && r > 0.6 && Math.abs(fbm(x, y, 26, 63, 2) - 0.5) < 0.012 && fbm(x, y, 70, 64, 2) > 0.62) {
            // Glowing fissures run out from the circle.
            put(i, mix(pick(SANCT, 1), GHOST_TEAL, 0.3), UP, GHOST_TEAL, 0.45);
            continue;
          }
        } else {
          // Flagstones in staggered courses, some doubled up.
          const cw = 17;
          const ch = 12;
          const row = Math.floor(y / ch);
          const off = (row % 2) * 8 + Math.floor(hash2(row, 0, 65) * 5);
          const col = Math.floor((x + off) / cw);
          let lx = (x + off) % cw;
          const ly = y % ch;
          const wide = hash2(col >> 1, row, 67) > 0.72;
          if (wide && col % 2 === 1) lx += cw;
          const w = wide ? cw * 2 : cw;
          const id = wide ? hash2(col >> 1, row, 69) : hash2(col, row, 69);
          if (ly === 0 || lx === 0) grout = true;
          else {
            idx = 3 + (id - 0.5) * 1.6 + (fbm(x, y, 6, 71, 2) - 0.5) * 1.1;
            if (ly === 1 || lx === 1) {
              n = [-0.3, 0.35, 0.88];
              idx += 0.6;
            } else if (ly === ch - 1 || lx === w - 1) {
              n = [0.3, -0.35, 0.88];
              idx -= 0.6;
            }
            // Cracked stones.
            if (id > 0.8 && Math.abs(fbm(x * 1.3, y, 9, 73 + col, 2) - 0.5) < 0.03) idx = 0.4;
            if (hash2(x, y, 75) > 0.993) idx += 1.5;
          }
          // A faint rune circle in the middle of each chamber.
          for (const rc of RUNE_CIRCLES) {
            if (!rc.r) continue;
            const d = Math.hypot(x + 0.5 - rc.cx, (y + 0.5 - rc.cy) * 1.4);
            if (Math.abs(d - rc.r) < 0.8 || Math.abs(d - rc.r + 5) < 0.6) {
              glow = GHOST_TEAL;
              gk = 0.22;
            } else if (d < rc.r - 5 && d > rc.r - 12) {
              const a = Math.atan2(y + 0.5 - rc.cy, x + 0.5 - rc.cx);
              const k = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 16);
              if (hash2(k, Math.floor(d), rc.seed * 7) > 0.62 && Math.floor(d) % 2 === 0) {
                glow = GHOST_TEAL;
                gk = 0.18;
              }
            }
          }
        }

        if (grout) {
          put(i, GROUT, UP, glow, gk);
          continue;
        }
        // Grime and shadow toward the walls; the north walls cast a shadow down onto the floor.
        if (wd < 6) idx -= (6 - wd) * 0.35;
        if (y > 0 && !floor[i - W] && !pool[i - W]) idx -= 1.5;
        else if (y > 3 && face[i - 3 * W]) idx -= 0.8;
        // Spectral moss creeping in, more of it by the walls.
        const m = fbm(x, y, 16, 77, 3) + (wd < 8 ? (8 - wd) * 0.025 : 0);
        let c = pick(base, idx + shadeOf(n) * 0.8);
        if (m > 0.66) {
          const k = Math.min(1, (m - 0.66) * 6);
          c = mix(c, pick(MOSS, 1 + k * 2 + (hash2(x, y, 79) > 0.8 ? 1 : 0)), 0.55 + k * 0.3);
          if (hash2(x, y, 81) > 0.996) {
            put(i, mix(c, GHOST_TEAL, 0.5), n, GHOST_TEAL, 0.4);
            continue;
          }
        }
        // Puddles of ectoplasm glowing faintly.
        const ecto = fbm(x, y, 7, 83, 2);
        if (ecto > 0.82 && fbm(x, y, 40, 85, 2) > 0.64) {
          const k = Math.min(1, (ecto - 0.82) * 10);
          put(i, mix(c, mix(pick(WATER, 3), GHOST_TEAL, 0.3), 0.5 + k * 0.3), UP, GHOST_TEAL, 0.14 + k * 0.22);
          continue;
        }
        // The spirit pool's carved stone lip.
        const pu = (x + 0.5 - POOL.cx) / POOL.rx;
        const pv = (y + 0.5 - POOL.cy) / POOL.ry;
        const pr = Math.hypot(pu, pv);
        if (pr < 1.12) {
          const ou: N3 = [pu / pr, -pv / pr, 0];
          const lipN: N3 = [ou[0] * 0.5, ou[1] * 0.5, 0.85];
          const lip = pick(STONE, 3.6 + shadeOf(lipN) * 1.6 + (pr < 1.03 ? 0.6 : 0));
          put(i, lip, lipN, pr < 1.035 ? GHOST_TEAL : undefined, 0.3);
          continue;
        }
        const bone = decals.get(i);
        if (bone) {
          put(i, bone, UP);
          continue;
        }
        put(i, c, n, glow, gk);
        continue;
      }

      // ---- Wall tops and the dark past them.
      const od = fromOpen[i];
      if (od <= 5.5) {
        // The cap: a stone ledge along every wall, catching the light on its inner edge.
        const edge = od < 1.5;
        let idx = 2.4 + (fbm(x, y, 4, 87, 2) - 0.5) * 1.4 + (edge ? 1 : 0) - (od > 4.2 ? 1.2 : 0);
        const blk = hash2(Math.floor(x / 9), Math.floor(y / 7), 89);
        idx += (blk - 0.5) * 0.8;
        if ((x % 9 === 0 || y % 7 === 0) && od > 1.5) idx -= 1;
        put(i, pick(CAP, idx), edge ? [0, 0.45, 0.9] : UP);
        continue;
      }
      const t = fbm(x, y, 12, 91, 2);
      const k = Math.max(0, 1 - (od - 5.5) / 5) * 0.5;
      put(i, mix(MASS, pick(CAP, 0), k + (t - 0.5) * 0.25), UP);
    }
  }
  return { diffuse, normal, emissive };
}

// ---------------------------------------------------------------- Props

const INK = hex('#05040a');
const PED: Material = { ramp: ramp('#0e0d18', '#1a1928', '#26263a', '#34354e', '#484a66'), outline: INK, outlineLit: hex('#1a1a2a') };
const PED_DARK: Material = { ramp: ramp('#0a0912', '#12111e', '#1c1b2c', '#282840'), outline: INK };
const BRONZE_OLD: Material = { ramp: ramp('#10201e', '#1c3430', '#2c4c44', '#46706a', '#7ab0a0'), outline: INK, shine: true };
const SKULL: Material = { ramp: ramp('#4e493f', '#7a7362', '#a8a08a', '#d2cab2', '#efe8d4'), outline: hex('#15120e') };
const FLAME = (k: number): Material => ({ ramp: ramp('#1a8a7a', '#4ae0c8', '#aefff0', '#ffffff'), outline: hex('#0a2a28'), emissive: 0.75 + k * 0.25, noAO: true, noOutline: true });
const MARBLE: Material = { ramp: ramp('#1c1c2c', '#2c2c42', '#40405a', '#585a78', '#7a7e9c', '#a4a8c4'), outline: INK, outlineLit: hex('#26263a') };
const ROBE_STONE: Material = { ramp: ramp('#161626', '#22223a', '#30304e', '#424466', '#585c80'), outline: INK };
const RUNE: Material = { ramp: ramp('#3ad8c0', '#b8fff0'), outline: INK, emissive: 0.85, noAO: true };
const WAX: Material = { ramp: ramp('#5a5448', '#8a8270', '#bab29a', '#e2dac2', '#fbf6e6'), outline: hex('#1a160e') };
const LID: Material = { ramp: ramp('#141424', '#1e1e32', '#2a2a44', '#383a56', '#4a4c6c', '#62668a'), outline: INK, outlineLit: hex('#22223a') };

export const BRAZIER_W = 18;
export const BRAZIER_H = 34;
export const BRAZIER_OY = 32;
export const BRAZIER_FRAMES = 4;

/** A stone pedestal holding a bronze bowl of cold spirit-fire. `f` flickers the flame. */
export function spiritBrazier(f: number): PixelCanvas {
  const c = new PixelCanvas(BRAZIER_W, BRAZIER_H);
  const cx = 9;
  c.part();
  c.shape(28, 32, () => [cx - 6, cx + 6], PED, (_x, _y, t, u) => cyl(t, 0.7 - u));
  c.part();
  c.shape(17, 28, (y) => [cx - 2.6 - (y > 25 ? 1 : 0), cx + 2.6 + (y > 25 ? 1 : 0)], PED, (_x, _y, t) => cyl(t, 0.1));
  for (let y = 18; y < 27; y++) c.shade(cx, y, -1);
  // The bowl, with a skull on its face.
  c.part();
  c.shape(12, 17, (y) => {
    const u = (y - 12) / 5;
    const hw = 6.5 - u * u * 3;
    return [cx - hw, cx + hw];
  }, BRONZE_OLD, (_x, _y, t, u) => sphere(t * 0.9, 0.2 - u * 0.6));
  c.part();
  c.ellipse(cx, 14, 1.6, 1.4, SKULL);
  c.px(cx - 1, 14, PED_DARK);
  c.px(cx + 1, 14, PED_DARK);
  // Cold flame: licks of teal and white rising off the bowl.
  c.part();
  const R = rng(f * 13 + 3);
  const sway = [0, 1, 0, -1][f % 4];
  c.shape(3 + (f % 2), 12, (y) => {
    const u = (y - 3) / 9;
    const hw = 0.5 + Math.sin(Math.min(1, u) * Math.PI * 0.75) * 4.2;
    const lean = (1 - u) * sway * 1.5;
    return [cx - hw + lean, cx + hw + lean];
  }, FLAME(0.5), () => ({ x: 0, y: 0, z: 1 }));
  for (let y = 5; y < 12; y++) {
    const hw = (y - 4) * 0.28;
    for (let x = Math.floor(cx - hw); x <= cx + hw; x++) c.spark(x + sway * 0.5, y, GHOST_WHITE, 0.6);
  }
  for (let k = 0; k < 4; k++) c.spark(cx + (R() - 0.5) * 8 + sway, 1 + R() * 5, k % 2 ? GHOST_TEAL : GHOST_WHITE, 0.5 + R() * 0.4);
  return c;
}

export const PILLAR_W = 22;
export const PILLAR_H = 62;
export const PILLAR_OY = 58;

/** A tall gothic pillar of dark marble, a band of runes glowing round its middle. `broken` snaps its top off. */
export function spiritPillar(broken: boolean): PixelCanvas {
  const c = new PixelCanvas(PILLAR_W, PILLAR_H);
  const cx = 11;
  c.part();
  c.shape(52, 58, (y) => [cx - 9 + (y < 54 ? 1 : 0), cx + 9 - (y < 54 ? 1 : 0)], MARBLE, (_x, _y, t, u) => cyl(t, 0.6 - u));
  c.part();
  c.shape(49, 52, () => [cx - 7, cx + 7], MARBLE, (_x, _y, t) => cyl(t, 0.5));
  const top = broken ? 16 : 9;
  c.part();
  c.shape(top, 49, (y) => {
    // A jagged break across the top of a broken one.
    if (broken && y < top + 4) {
      const hw = 5.2;
      return [cx - hw + (y - top) * 0.2 - 0.5, cx + hw - (top + 4 - y) * 1.1];
    }
    return [cx - 5.2, cx + 5.2];
  }, MARBLE, (_x, _y, t) => cyl(t, 0.08));
  // Flutes down the shaft.
  for (let y = top + 2; y < 48; y++) for (const f of [-3, 0, 3]) c.shade(cx + f, y, -1);
  // The band of runes.
  c.part();
  c.shape(30, 33, () => [cx - 5.6, cx + 5.6], PED_DARK, (_x, _y, t) => cyl(t, 0.1));
  c.part();
  for (const x of [cx - 3, cx - 1, cx + 1, cx + 3]) c.px(x, 31, RUNE);
  c.px(cx - 2, 32, RUNE);
  c.px(cx + 2, 30, RUNE);
  if (!broken) {
    // Capital: a flared block with a ledge.
    c.part();
    c.shape(4, 9, (y) => {
      const hw = 5.4 + (9 - y) * 0.8;
      return [cx - hw, cx + hw];
    }, MARBLE, (_x, _y, t, u) => cyl(t, 0.5 - u * 0.4));
    c.part();
    c.shape(1, 4, () => [cx - 9.5, cx + 9.5], MARBLE, (_x, _y, t, u) => cyl(t, 0.8 - u));
  } else {
    // Rubble fallen at its foot.
    c.part();
    c.ellipse(cx + 8, 57, 2.4, 1.8, MARBLE);
    c.ellipse(cx - 8.5, 58, 1.8, 1.4, MARBLE);
  }
  return c;
}

export const TOMB_W = 32;
export const TOMB_H = 26;
export const TOMB_OY = 23;

/** A sarcophagus: a carved lid with a sword on it, ghost-light leaking from the seam. */
export function spiritTomb(): PixelCanvas {
  const c = new PixelCanvas(TOMB_W, TOMB_H);
  // Front face.
  c.part();
  c.shape(12, 23, () => [2, 30], PED, (_x, _y, t, u) => ({ x: t * 0.3, y: -0.4 - u * 0.1, z: 0.85 }));
  for (let y = 14; y < 22; y++) for (const x of [9, 16, 23]) c.shade(x, y, -1);
  // The lid, seen from above.
  c.part();
  c.shape(3, 12, (y) => [1.5 + (y < 4 ? 1 : 0), 30.5 - (y < 4 ? 1 : 0)], LID, (_x, y, t) => ({ x: t * 0.15, y: y < 5 ? 0.6 : 0.15, z: 0.9 }));
  // A sword carved down the lid.
  c.part();
  for (let x = 7; x <= 25; x++) c.shade(x, 7, 1);
  for (let y = 5; y <= 9; y++) c.shade(10, y, 1);
  c.shade(26, 7, 1);
  // The seam between lid and box, glowing.
  c.part();
  for (let x = 4; x <= 28; x++) if (hash2(x, 0, 101) > 0.35) c.spark(x, 12, GHOST_TEAL, 0.35 + hash2(x, 1, 103) * 0.35);
  return c;
}

export const STATUE_W = 22;
export const STATUE_H = 48;
export const STATUE_OY = 45;

/** A hooded mourner of pale stone, head bowed, holding up a lantern of spirit-light. */
export function spiritStatue(): PixelCanvas {
  const c = new PixelCanvas(STATUE_W, STATUE_H);
  const cx = 11;
  // Plinth.
  c.part();
  c.shape(38, 45, (y) => [cx - 8 - (y > 42 ? 1 : 0), cx + 8 + (y > 42 ? 1 : 0)], PED, (_x, _y, t, u) => cyl(t, 0.6 - u));
  // Robe, falling from bowed shoulders.
  c.part();
  c.shape(16, 38, (y) => {
    const u = (y - 16) / 22;
    const hw = 4.5 + u * 3.2;
    return [cx - hw, cx + hw];
  }, ROBE_STONE, (_x, _y, t) => cyl(t, 0.15));
  for (let y = 22; y < 38; y++) {
    c.shade(cx - 2, y, -1);
    c.shade(cx + 2 + (y > 30 ? 1 : 0), y, -1);
  }
  // Hood, bowed forward.
  c.part();
  c.ellipse(cx + 1, 13, 4.6, 5.2, ROBE_STONE);
  c.part();
  c.ellipse(cx + 2, 15, 2.4, 2.8, PED_DARK, { normal: () => ({ x: 0, y: 0, z: 1 }) });
  // Arms reaching forward to the lantern.
  c.part();
  c.capsule(cx - 3, 20, cx + 3, 25, 2, 1.6, ROBE_STONE);
  c.capsule(cx + 4, 20, cx + 5, 25, 1.8, 1.5, ROBE_STONE);
  // The lantern.
  c.part();
  c.shape(24, 31, (y) => [cx + 3, cx + 8 + (y > 26 && y < 30 ? 0.5 : 0)], BRONZE_OLD, (_x, _y, t) => cyl(t, 0.2));
  c.part();
  c.shape(26, 29, () => [cx + 4, cx + 7], FLAME(0.6), () => ({ x: 0, y: 0, z: 1 }));
  c.spark(cx + 5, 27, GHOST_WHITE, 0.9);
  c.px(cx + 5, 23, BRONZE_OLD);
  return c;
}

export const CANDLE_W = 16;
export const CANDLE_H = 16;
export const CANDLE_OY = 14;
export const CANDLE_FRAMES = 3;

/** A cluster of pale candles in a puddle of wax, their flames cold and white. */
export function spiritCandles(f: number): PixelCanvas {
  const c = new PixelCanvas(CANDLE_W, CANDLE_H);
  c.part();
  c.ellipse(8, 13.5, 6.5, 1.8, WAX, { flatten: 0.4 });
  const sticks: [number, number][] = [
    [4, 7],
    [8, 4],
    [11, 8],
    [6.5, 10],
  ];
  sticks.forEach(([x, top], k) => {
    c.part();
    c.shape(top, 13, () => [x - 1, x + 1], WAX, (_x, _y, t) => cyl(t, 0.2));
    const fl = (f + k) % 3;
    c.spark(x - 0.5, top - 1, GHOST_WHITE, 0.9);
    c.spark(x - 0.5, top - 2, fl === 1 ? GHOST_WHITE : GHOST_TEAL, 0.7);
    if (fl !== 2) c.spark(x - 0.5 + (fl ? 1 : 0), top - 3, GHOST_TEAL, 0.45);
  });
  return c;
}

// ---------------------------------------------------------------- Light and spells

/** A soft, lumpy puff of mist, white: tinted and drifted over the floor. */
export function mistPuff(w: number, h: number, seed: number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5 - w / 2) / (w / 2);
      const v = (y + 0.5 - h / 2) / (h / 2);
      const d = Math.hypot(u, v);
      const n = fbm(x, y, 9, seed, 3);
      const a = Math.max(0, 1 - d * (1.1 - n * 0.5)) * (0.4 + n * 0.8);
      const q = Math.round(a * 4) / 4;
      const i = (y * w + x) * 4;
      px[i] = px[i + 1] = px[i + 2] = Math.round(255 * Math.min(1, q));
      px[i + 3] = 255;
    }
  }
  return px;
}

export const ORB_PX = 11;

/** A banshee's wail made solid: a small orb of cold light with a white core. Pure light. */
export function spiritOrb(): Uint8ClampedArray {
  const n = ORB_PX;
  const px = new Uint8ClampedArray(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const d = Math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2) / (n / 2);
      if (d > 1) continue;
      const c = d < 0.3 ? GHOST_WHITE : d < 0.6 ? mix(GHOST_WHITE, GHOST_TEAL, 0.5) : d < 0.85 ? GHOST_TEAL : mix(GHOST_TEAL, GHOST_BLUE, 0.6);
      const a = d < 0.85 ? 1 : 0.45;
      const i = (y * n + x) * 4;
      px[i] = c[0] * a;
      px[i + 1] = c[1] * a;
      px[i + 2] = c[2] * a;
      px[i + 3] = 255;
    }
  }
  return px;
}

export const LANE_W = 32;
export const LANE_H = 9;

/** A soft band of light, brightest down its middle, with bright edges: the path a charge will take. White. */
export function laneCanvas(): Uint8ClampedArray {
  const px = new Uint8ClampedArray(LANE_W * LANE_H * 4);
  for (let y = 0; y < LANE_H; y++) {
    const v = Math.abs(y + 0.5 - LANE_H / 2) / (LANE_H / 2);
    const a = v > 0.8 ? 0.8 : 0.22 + (1 - v) * 0.2;
    for (let x = 0; x < LANE_W; x++) {
      const i = (y * LANE_W + x) * 4;
      px[i] = px[i + 1] = px[i + 2] = Math.round(255 * a);
      px[i + 3] = 255;
    }
  }
  return px;
}
