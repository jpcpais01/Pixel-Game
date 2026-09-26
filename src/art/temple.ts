// The Elementinho Temple's art: the whole floor plan painted in one piece
// (lit, with a normal map and a glow layer), and the things that stand in it.
//
// An old temple of warm stone, each hall laid for its element: the
// Antechamber's sandstone and its mosaic of the four elements; blue tiles
// in the Hall of Tides, washed with puddles, round a sacred pool of bright
// water; the Stone Vault's rough-cut earthstone, cracked, mossy and veined
// with glowing green crystal; pale marble in the Gale Gallery, set with a
// spiral of wind; black basalt in the Ember Forge, lava glowing in its
// seams, between two pits of lava. The Heart is round, ringed in stone,
// with an arc of each element's colour round a great flame sigil where
// Elementinho burns. The north walls show their faces, courses of carved
// sandstone with a band of glyphs glowing in each hall's colour; every wall
// is capped in stone, and past the caps lies solid dark.
// Props: fluted pillars set with an element's gem, fire bowls, mossy
// boulders, crystal clusters and the Heart's four elemental obelisks.

import { mix } from './bitmap';
import { hash2, rng } from './env';
import { KEY_LIGHT, PixelCanvas, cyl, hex, sphere, type Material, type RGB } from './pixel';
import { distanceTo, fbm } from './spirit';
import { HEART, LAVA_PITS, TEMPLE_H, TEMPLE_W, TEMPLE_WALL_H, TIDE_POOL, hallElement, inHeart, templeFloor, templeLiquid, type Element } from '../world/templeLayout';

const ramp = (...c: string[]): RGB[] => c.map(hex);

// ---------------------------------------------------------------- Palette

const SAND = ramp('#1a1410', '#2a2018', '#3a2e22', '#4c3d2c', '#5e4c38', '#735e46', '#8a7256');
const TIDE = ramp('#0c141e', '#14202c', '#1d2e3c', '#273c4c', '#324c5e', '#3f5e70', '#4f7284');
const EARTHS = ramp('#16120c', '#231c13', '#31281b', '#403524', '#50432e', '#62533a', '#766548');
const MARBLE = ramp('#1c2026', '#282e36', '#363e48', '#46505c', '#586472', '#6c7a88', '#8494a2');
const BASALT = ramp('#0e0a0a', '#171010', '#211716', '#2c1e1c', '#382624', '#46302c', '#563a34');
const HEARTS = ramp('#1a1210', '#261a16', '#34241e', '#433028', '#533c32', '#654a3e', '#7a5a4a');
const FACE = ramp('#110d09', '#1a150f', '#241d15', '#2e251b', '#3a2f22', '#473a2a');
const CAP = ramp('#15110d', '#201a14', '#2c241b', '#383024', '#463c2e', '#564a3a');
const MASS: RGB = hex('#070504');
const GROUT: RGB = hex('#0a0806');
const MOSS = ramp('#141e0e', '#1e3014', '#2a441a', '#3a5c22');
const DIRT = ramp('#1a1208', '#2a1e0e', '#3a2a16');
const WATER = ramp('#04101e', '#082440', '#0e3e6a', '#1a6aa0', '#3a9ad0', '#8ad4f4', '#e4f8ff');
const LAVA = ramp('#3a0804', '#7a1606', '#c0340a', '#ff6a14', '#ffa832', '#ffe070', '#fff8d0');
const CRUST = ramp('#0a0605', '#140c0a', '#1e1210');

/** Each element's colour, as it glows in the floor and the props. */
export const EL_RGB: Record<Element, RGB> = { water: hex('#5ab4ff'), earth: hex('#9ad84a'), air: hex('#bff4ff'), fire: hex('#ff8a2a') };
const EMBER: RGB = hex('#ffb040');
const HOT: RGB = hex('#fff0b0');

/** Particle tints for temple bursts: embers of every colour. */
export const TEMPLE_TINTS = [0xffc44a, 0x5ab4ff, 0x9ad84a, 0xbff4ff];

export interface TempleArt {
  diffuse: Uint8ClampedArray;
  normal: Uint8ClampedArray;
  emissive: Uint8ClampedArray;
}

type N3 = [number, number, number];
const UP: N3 = [0, 0, 1];

/** Where the Antechamber's four-element mosaic lies. */
const MOSAIC = { cx: 300, cy: 1782, r: 30 };
/** The Gale Gallery's wind spiral. */
const SPIRAL = { cx: 300, cy: 880, r: 52 };

/** Which element's quarter of a circle the angle `a` (radians, 0 = east) falls in: water north, air east, fire south, earth west. */
function quarter(a: number): Element {
  const q = Math.round(((a + Math.PI * 2.5) % (Math.PI * 2)) / (Math.PI / 2)) % 4;
  return (['water', 'air', 'fire', 'earth'] as const)[q];
}

/**
 * Is (u, v) on the Heart's flame sigil: a drop-shaped outline burning at the
 * centre? `w` is a line's half-width, in the same units.
 */
function onFlameSigil(u: number, v: number, w: number): boolean {
  // A drop: round below, pointed on top.
  const r = 0.13;
  const cy = 0.05;
  if (v > cy) return Math.abs(Math.hypot(u, v - cy) - r) < w;
  const tip = -0.24;
  if (v < tip) return false;
  const k = (v - tip) / (cy - tip);
  const hw = r * Math.pow(Math.sin((k * Math.PI) / 2), 1.5);
  return Math.abs(Math.abs(u) - hw) < w * 1.2;
}

/**
 * The temple floor plan in one image: diffuse, a normal map for the
 * lights, and a glow layer. Built a few rows at a time.
 */
export function* templeArt(): Generator<void, TempleArt, void> {
  const W = TEMPLE_W;
  const H = TEMPLE_H;
  const N = W * H;
  const diffuse = new Uint8ClampedArray(N * 4);
  const normal = new Uint8ClampedArray(N * 4);
  const emissive = new Uint8ClampedArray(N * 4);
  const L = KEY_LIGHT;
  const Ll = Math.hypot(L.x, L.y, L.z);

  // 1. What each pixel is: floor, liquid (1 water, 2 lava), or wall.
  const floor = new Uint8Array(N);
  const liquid = new Uint8Array(N);
  for (let y = 0; y < H; y++) {
    if (y % 64 === 0) yield;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (templeFloor(x + 0.5, y + 0.5)) floor[i] = 1;
      else {
        const l = templeLiquid(x + 0.5, y + 0.5);
        if (l) liquid[i] = l === 'water' ? 1 : 2;
      }
    }
  }
  // 2. Wall faces: the wall pixels just north of any floor.
  const face = new Uint8Array(N);
  for (let x = 0; x < W; x++) {
    let below = -1;
    for (let y = H - 1; y >= 0; y--) {
      const i = y * W + x;
      if (floor[i] || liquid[i]) {
        below = floor[i] ? y : -1;
        continue;
      }
      if (below >= 0 && below - y <= TEMPLE_WALL_H) face[i] = below - y;
      else below = -1;
    }
  }
  yield;
  // 3. Distances: open floor from the walls (grime), and wall from the floor and faces (the caps).
  const solid = new Uint8Array(N);
  const wall = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    solid[i] = floor[i] || face[i] || liquid[i] ? 1 : 0;
    wall[i] = floor[i] || liquid[i] ? 0 : 1;
  }
  const fromOpen = yield* distanceTo(solid, W, H, 12);
  const fromWall = yield* distanceTo(wall, W, H, 14);

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

  /** Staggered flagstones `cw` x `ch`: grout, a stone id, and a bevelled edge normal. */
  const flag = (x: number, y: number, cw: number, ch: number, seed: number) => {
    const row = Math.floor(y / ch);
    const off = (row % 2) * Math.floor(cw / 2) + Math.floor(hash2(row, 0, seed) * 5);
    const col = Math.floor((x + off) / cw);
    const lx = (x + off) % cw;
    const ly = y % ch;
    const id = hash2(col, row, seed + 2);
    let n: N3 = UP;
    let bump = 0;
    const grout = ly === 0 || lx === 0;
    if (ly === 1 || lx === 1) {
      n = [-0.3, 0.35, 0.88];
      bump = 0.6;
    } else if (ly === ch - 1 || lx === cw - 1) {
      n = [0.3, -0.35, 0.88];
      bump = -0.6;
    }
    return { grout, id, n, bump, col, row };
  };

  for (let y = 0; y < H; y++) {
    if (y % 10 === 0) yield;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;

      // ---- The sacred pool.
      if (liquid[i] === 1) {
        const u = (x + 0.5 - TIDE_POOL.cx) / TIDE_POOL.rx;
        const v = (y + 0.5 - TIDE_POOL.cy) / TIDE_POOL.ry;
        const r = Math.hypot(u, v);
        const deep = 1 - r;
        const ripple = Math.sin(r * 24 - fbm(x, y, 10, 171, 2) * 5) * 0.5 + 0.5;
        let idx = 1.4 + deep * 2.8 + (ripple > 0.78 ? 1 : 0);
        if (v < 0 && r > 0.86) idx -= 1;
        if (hash2(x, y, 131) > 0.99) idx = 6;
        const c = pick(WATER, idx);
        put(i, c, UP, c, 0.4 + deep * 0.45);
        continue;
      }
      // ---- The lava pits: molten rock under a breaking crust.
      if (liquid[i] === 2) {
        let pit = LAVA_PITS[0];
        for (const q of LAVA_PITS) if (Math.abs(x - q.cx) < Math.abs(x - pit.cx)) pit = q;
        const u = (x + 0.5 - pit.cx) / pit.rx;
        const v = (y + 0.5 - pit.cy) / pit.ry;
        const r = Math.hypot(u, v);
        const flow = fbm(x + y * 0.3, y, 9, 173, 3);
        const crust = fbm(x, y, 6, 175, 2);
        if (crust > 0.62 && r > 0.25) {
          // Plates of cooling crust, glowing at their cracks.
          const edge = crust < 0.66;
          put(i, edge ? pick(LAVA, 1) : pick(CRUST, 1 + (flow - 0.5) * 2), UP, edge ? pick(LAVA, 2) : undefined, 0.6);
          continue;
        }
        let idx = 2.6 + (1 - r) * 2.2 + (flow - 0.5) * 2.4;
        if (v < 0 && r > 0.86) idx -= 1.5;
        const c = pick(LAVA, idx);
        put(i, c, UP, c, 0.85);
        continue;
      }

      // ---- Wall faces: carved sandstone, a band of glyphs glowing in the hall's colour.
      if (face[i]) {
        const hgt = face[i];
        const yy = TEMPLE_WALL_H - hgt;
        const el = hallElement(x, y + hgt + 4) ?? (inHeart(x, y + hgt + 4, -6) ? 'fire' : null);
        const faceN: N3 = [0, -0.5, 0.86];
        // The glyph band, a third of the way down.
        if (yy >= 8 && yy <= 13) {
          if (yy === 8 || yy === 13) {
            put(i, pick(FACE, 4), yy === 8 ? [0, 0.4, 0.9] : faceN);
            continue;
          }
          const gx = Math.floor(x / 7);
          const lx = x % 7;
          const glyph = el && lx > 0 && lx < 6 && hash2(gx, yy, 141) > 0.42 && hash2(gx, lx, 143) > 0.3;
          if (glyph) {
            const g = EL_RGB[el];
            put(i, mix(pick(FACE, 1), g, 0.45), faceN, g, 0.55);
          } else put(i, pick(FACE, 1), faceN);
          continue;
        }
        const row = Math.floor(yy / 7);
        const off = row % 2 ? 8 : 0;
        const bx = Math.floor((x + off) / 16);
        const lx = (x + off) % 16;
        const ly = yy % 7;
        if (ly === 6 || lx === 0) {
          put(i, pick(FACE, 0), faceN);
          continue;
        }
        const brick = hash2(bx, row, 145);
        let n = faceN;
        let idx = 2.6 + (brick - 0.5) * 1.4 + (fbm(x, y, 5, 147, 2) - 0.5) * 0.9;
        if (ly === 0) {
          n = [0, 0.3, 0.95];
          idx += 1;
        } else if (lx === 1) idx += 0.5;
        else if (lx === 15 || ly === 5) idx -= 0.5;
        if (hgt <= 2) idx -= 2;
        else if (hgt <= 4) idx -= 1;
        if (yy < 3) idx -= 0.5;
        put(i, pick(FACE, idx + shadeOf(n) * 0.6), n);
        continue;
      }

      // ---- Floor.
      if (floor[i]) {
        const wd = fromWall[i];
        const el = hallElement(x, y);
        const heart = !el && inHeart(x, y, -4) && y < 380;
        let base = SAND;
        let n: N3 = UP;
        let idx = 3;
        let glow: RGB | undefined;
        let gk = 0;
        let grout = false;
        let tint: RGB | null = null;
        let tk = 0;

        if (heart) {
          // Rings of wedge-shaped stones round the great sigil.
          base = HEARTS;
          const u = (x + 0.5 - HEART.cx) / HEART.rx;
          const v = (y + 0.5 - HEART.cy) / HEART.ry;
          const r = Math.hypot(u, v);
          const a = Math.atan2(v, u);
          const rings = [0, 0.12, 0.3, 0.44, 0.54, 0.62, 0.76, 0.9, 1.3];
          let ring = 0;
          while (ring < rings.length - 2 && r >= rings[ring + 1]) ring++;
          const r0 = rings[ring];
          const r1 = rings[ring + 1];
          const segs = [1, 1, 20, 28, 1, 36, 44, 52][ring];
          const seg = (Math.PI * 2) / segs;
          const sa = ((a % seg) + seg) % seg;
          const dA = segs > 1 ? Math.min(sa, seg - sa) * r * HEART.rx : 99;
          const dR = Math.min(r - r0, r1 - r) * HEART.ry;
          const stoneId = hash2(Math.floor((a + Math.PI) / seg), ring, 151);
          if (ring === 4) {
            // The elemental band: an arc of each element's colour, glyphs along it.
            const q = quarter(a);
            const g = EL_RGB[q];
            const edge = Math.min(r - r0, r1 - r) * HEART.ry;
            const qa = ((a + Math.PI * 2.25) % (Math.PI / 2)) / (Math.PI / 2);
            if (qa < 0.03 || qa > 0.97) {
              put(i, pick(HEARTS, 4), UP);
              continue;
            }
            if (edge < 1.2) {
              put(i, mix(pick(HEARTS, 2), g, 0.55), UP, g, 0.8);
              continue;
            }
            const rune = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 40);
            const ra = ((a + Math.PI) / (Math.PI * 2)) * 40 - rune;
            const rr = (r - r0) / (r1 - r0);
            if (hash2(rune, Math.floor(ra * 3), 153) > 0.4 && Math.abs(rr - 0.5) < 0.28 && ra > 0.2 && ra < 0.8 && hash2(rune, Math.floor(rr * 4), 155) > 0.35) {
              put(i, mix(pick(HEARTS, 1), g, 0.4), UP, g, 0.65);
              continue;
            }
            put(i, mix(pick(HEARTS, 1 + (fbm(x, y, 6, 157, 2) - 0.5)), g, 0.08), UP);
            continue;
          }
          if (dA < 0.7 || dR < 0.8) grout = true;
          else {
            idx = 3 + (stoneId - 0.5) * 1.5 + (fbm(x, y, 7, 159, 2) - 0.5) * 1;
            if (dA < 1.7 || dR < 1.7) {
              const ou: N3 = [u / (r || 1), -v / (r || 1), 0];
              n = dR < 1.7 && r - r0 < r1 - r ? [-ou[0] * 0.35, -ou[1] * 0.35, 0.9] : [ou[0] * 0.35, ou[1] * 0.35, 0.9];
            }
          }
          // The dais at the heart, and the flame sigil burning on it.
          if (r < 0.3) {
            grout = false;
            const ou: N3 = [u / (r || 1), -v / (r || 1), 0];
            const rim = r > 0.275;
            idx = 3.4 + (rim ? 0.6 : -0.3) + (fbm(x, y, 5, 161, 2) - 0.5) * 0.8;
            n = rim ? [ou[0] * 0.6, ou[1] * 0.6, 0.8] : UP;
            if (onFlameSigil(u, v * (HEART.ry / HEART.rx), 0.9 / HEART.rx)) {
              put(i, mix(pick(HEARTS, 3), EMBER, 0.6), UP, EMBER, 0.9);
              continue;
            }
            // Scorch fanning out from where it burns.
            const scorch = Math.max(0, 1 - r / 0.2) * (0.6 + fbm(x, y, 5, 163, 2) * 0.6);
            idx -= scorch * 2.2;
            if (scorch > 0.5 && hash2(x, y, 165) > 0.985) {
              put(i, mix(pick(HEARTS, 1), EMBER, 0.5), UP, EMBER, 0.6);
              continue;
            }
          }
          // Spokes of each element's colour out toward its obelisk.
          if (r > 0.62 && r < 0.9 && !grout) {
            for (const qa of [-3 * Math.PI / 4, -Math.PI / 4, Math.PI / 4, 3 * Math.PI / 4]) {
              let d = a - qa;
              d = Math.atan2(Math.sin(d), Math.cos(d));
              if (Math.abs(d) * r * HEART.rx < 1.1) {
                const g = EL_RGB[qa === -3 * Math.PI / 4 ? 'water' : qa === -Math.PI / 4 ? 'air' : qa === Math.PI / 4 ? 'fire' : 'earth'];
                glow = g;
                gk = 0.35;
                tint = g;
                tk = 0.3;
              }
            }
          }
        } else if (el === 'water') {
          // Square blue tiles, water pooled on them, a wave of mosaic round the pool.
          base = TIDE;
          const lx = x % 12;
          const ly = y % 12;
          grout = lx === 0 || ly === 0;
          const id = hash2(Math.floor(x / 12), Math.floor(y / 12), 181);
          idx = 3 + (id - 0.5) * 1.4 + (fbm(x, y, 6, 183, 2) - 0.5) * 1;
          if (lx === 1 || ly === 1) {
            n = [-0.3, 0.35, 0.88];
            idx += 0.5;
          }
          const pu = (x + 0.5 - TIDE_POOL.cx) / TIDE_POOL.rx;
          const pv = (y + 0.5 - TIDE_POOL.cy) / TIDE_POOL.ry;
          const pr = Math.hypot(pu, pv);
          const pa = Math.atan2(pv, pu);
          const wave = 1.55 + Math.sin(pa * 12) * 0.08;
          if (Math.abs(pr - wave) * TIDE_POOL.ry < 1.1 || Math.abs(pr - wave - 0.18) * TIDE_POOL.ry < 0.7) {
            put(i, mix(pick(TIDE, 3), EL_RGB.water, 0.35), UP, EL_RGB.water, 0.2);
            continue;
          }
          // Puddles, catching the light.
          const wet = fbm(x, y, 11, 185, 3);
          if (wet > 0.72 && !grout) {
            const k = Math.min(1, (wet - 0.72) * 8);
            put(i, mix(pick(TIDE, idx + 0.5), pick(WATER, 2.5 + k), 0.35 + k * 0.2), UP, EL_RGB.water, 0.04 + k * 0.07);
            continue;
          }
        } else if (el === 'earth') {
          // Big rough-cut blocks, cracked, dirt and moss between them, crystal in the cracks.
          base = EARTHS;
          const f = flag(x, y, 22, 16, 191);
          grout = f.grout;
          idx = 3 + (f.id - 0.5) * 1.8 + (fbm(x, y, 5, 193, 3) - 0.5) * 1.4 + f.bump;
          n = f.n;
          const crack = Math.abs(fbm(x * 1.2, y, 14, 195, 3) - 0.5);
          if (crack < 0.008) {
            const vein = fbm(x, y, 40, 197, 2) > 0.72;
            if (vein) put(i, mix(pick(EARTHS, 1), EL_RGB.earth, 0.4), UP, EL_RGB.earth, 0.45);
            else put(i, pick(EARTHS, 0), UP);
            continue;
          }
          const dirt = fbm(x, y, 18, 199, 3);
          if (dirt > 0.64) {
            tint = pick(DIRT, 1 + (hash2(x, y, 201) > 0.7 ? 1 : 0));
            tk = 0.55;
            grout = false;
          }
        } else if (el === 'air') {
          // Pale marble in a checker, a spiral of wind in the middle, breezes across it.
          base = MARBLE;
          const cx = Math.floor(x / 14);
          const cy = Math.floor(y / 14);
          const lx = x % 14;
          const ly = y % 14;
          grout = lx === 0 || ly === 0;
          idx = ((cx + cy) % 2 ? 3.6 : 2.6) + (fbm(x, y, 8, 211, 2) - 0.5) * 0.9;
          // Veins in the marble.
          if (Math.abs(fbm(x + y, y, 20, 213, 3) - 0.5) < 0.02) idx -= 0.8;
          if (lx === 1 || ly === 1) {
            n = [-0.3, 0.35, 0.88];
            idx += 0.5;
          }
          const du = x + 0.5 - SPIRAL.cx;
          const dv = (y + 0.5 - SPIRAL.cy) * 1.35;
          const sr = Math.hypot(du, dv);
          if (sr < SPIRAL.r) {
            const sa = Math.atan2(dv, du);
            // Three arms curling out from the eye.
            const arm = Math.sin(sa * 3 - sr * 0.16);
            if (arm > 0.86 && sr > 5) {
              put(i, mix(pick(MARBLE, 4), EL_RGB.air, 0.4), UP, EL_RGB.air, 0.3 * (1 - sr / SPIRAL.r) + 0.12);
              continue;
            }
            if (Math.abs(sr - SPIRAL.r + 1) < 1) {
              put(i, mix(pick(MARBLE, 4), EL_RGB.air, 0.3), UP, EL_RGB.air, 0.22);
              continue;
            }
          }
        } else if (el === 'fire') {
          // Black basalt, lava glowing in its seams, soot round the pits.
          base = BASALT;
          const f = flag(x, y, 16, 12, 221);
          idx = 3 + (f.id - 0.5) * 1.5 + (fbm(x, y, 6, 223, 2) - 0.5) * 1.1 + f.bump;
          n = f.n;
          let near = 9;
          for (const q of LAVA_PITS) near = Math.min(near, Math.hypot((x - q.cx) / q.rx, (y - q.cy) / q.ry));
          if (f.grout) {
            // Lava seeps up through the seams near the pits, and in a few veins across the hall.
            const hot = Math.max(0, 1 - (near - 1) / 0.9) * 0.8 + (fbm(x, y, 30, 225, 2) > 0.74 ? 0.5 : 0);
            if (hot > 0.35) {
              const g = pick(LAVA, 1.5 + hot * 1.6);
              put(i, mix(GROUT, g, 0.6), UP, g, 0.2 + hot * 0.3);
              continue;
            }
            grout = true;
          }
          // Carved stone lip round each pit.
          if (near < 1.14) {
            const pit = LAVA_PITS[x < 300 ? 0 : 1];
            const pu = (x + 0.5 - pit.cx) / pit.rx;
            const pv = (y + 0.5 - pit.cy) / pit.ry;
            const ou: N3 = [pu / near, -pv / near, 0];
            const lipN: N3 = [ou[0] * 0.5, ou[1] * 0.5, 0.85];
            const lip = pick(BASALT, 3.8 + shadeOf(lipN) * 1.6 + (near < 1.04 ? 0.6 : 0));
            put(i, lip, lipN, near < 1.04 ? pick(LAVA, 3) : undefined, 0.45);
            continue;
          }
          if (near < 1.9) idx -= (1.9 - near) * 1.4;
          // Embers ground into the stone.
          if (hash2(x, y, 227) > 0.994) {
            put(i, mix(pick(BASALT, idx), EMBER, 0.6), UP, EMBER, 0.5);
            continue;
          }
        } else {
          // Sandstone flagstones: the Antechamber and the corridors.
          const f = flag(x, y, 17, 12, 231);
          grout = f.grout;
          idx = 3 + (f.id - 0.5) * 1.6 + (fbm(x, y, 6, 233, 2) - 0.5) * 1.1 + f.bump;
          n = f.n;
          if (f.id > 0.82 && Math.abs(fbm(x * 1.3, y, 9, 235 + f.col, 2) - 0.5) < 0.03) idx = 0.6;
          // The mosaic of the four elements.
          const du = x + 0.5 - MOSAIC.cx;
          const dv = (y + 0.5 - MOSAIC.cy) * 1.4;
          const mr = Math.hypot(du, dv);
          if (mr < MOSAIC.r) {
            const q = quarter(Math.atan2(dv, du) + Math.PI / 4);
            const g = EL_RGB[q];
            if (mr > MOSAIC.r - 2 || mr < 6) {
              put(i, mix(pick(SAND, 4), EMBER, 0.35), UP, EMBER, 0.3);
              continue;
            }
            const tile = hash2(Math.floor(x / 3), Math.floor(y / 3), 237);
            if (x % 3 === 0 || y % 3 === 0) put(i, GROUT, UP);
            else put(i, mix(pick(SAND, 2 + tile * 2), g, 0.45), UP, g, 0.14);
            continue;
          }
        }

        if (grout) {
          put(i, GROUT, UP, glow, gk);
          continue;
        }
        // Grime and shadow toward the walls; the north walls cast a shadow down onto the floor.
        if (wd < 6) idx -= (6 - wd) * 0.35;
        if (y > 0 && !floor[i - W] && !liquid[i - W]) idx -= 1.5;
        else if (y > 3 && face[i - 3 * W]) idx -= 0.8;
        let c = pick(base, idx + shadeOf(n) * 0.8);
        if (tint) c = mix(c, tint, tk);
        // Moss creeping in by the walls (thick in the Stone Vault).
        const m = fbm(x, y, 16, 241, 3) + (wd < 8 ? (8 - wd) * 0.03 : 0) + (el === 'earth' ? 0.1 : el === 'fire' ? -0.3 : el === 'air' ? -0.15 : 0);
        if (m > 0.7) {
          const k = Math.min(1, (m - 0.7) * 6);
          c = mix(c, pick(MOSS, 1 + k * 2 + (hash2(x, y, 243) > 0.8 ? 1 : 0)), 0.5 + k * 0.3);
        }
        // Old scorch marks from the fire bowls' spills, fewer toward the water.
        if (el !== 'water' && fbm(x, y, 9, 245, 2) > 0.8 && fbm(x, y, 50, 247, 2) > 0.62) c = mix(c, MASS, 0.35);
        put(i, c, n, glow, gk);
        continue;
      }

      // ---- Wall tops and the dark past them.
      const od = fromOpen[i];
      if (od <= 5.5) {
        const edge = od < 1.5;
        let idx = 2.4 + (fbm(x, y, 4, 251, 2) - 0.5) * 1.4 + (edge ? 1 : 0) - (od > 4.2 ? 1.2 : 0);
        const blk = hash2(Math.floor(x / 10), Math.floor(y / 7), 253);
        idx += (blk - 0.5) * 0.8;
        if ((x % 10 === 0 || y % 7 === 0) && od > 1.5) idx -= 1;
        put(i, pick(CAP, idx), edge ? [0, 0.45, 0.9] : UP);
        continue;
      }
      const t = fbm(x, y, 12, 255, 2);
      const k = Math.max(0, 1 - (od - 5.5) / 5) * 0.5;
      put(i, mix(MASS, pick(CAP, 0), k + (t - 0.5) * 0.25), UP);
    }
  }
  return { diffuse, normal, emissive };
}

// ---------------------------------------------------------------- Props

const INK = hex('#0a0604');
const SANDSTONE: Material = { ramp: ramp('#241a12', '#38291c', '#4e3a28', '#665036', '#806846', '#9c825a', '#b89e72'), outline: INK, outlineLit: hex('#2e2218') };
const SANDSTONE_DARK: Material = { ramp: ramp('#1a130c', '#281d14', '#382a1c', '#4a3826'), outline: INK };
const BRASS: Material = { ramp: ramp('#2a1406', '#5a3010', '#8e5a1e', '#c48a34', '#f0c060', '#fff0b0'), outline: INK, shine: true };
const OBSIDIAN: Material = { ramp: ramp('#0a080c', '#141018', '#1e1a26', '#2a2636', '#3a3648', '#4e4a60'), outline: hex('#040306'), outlineLit: hex('#1a1622'), shine: true };
const ROCK: Material = { ramp: ramp('#1c1814', '#2e2822', '#443a30', '#5a4e40', '#746552', '#907e66'), outline: INK, outlineLit: hex('#2a241e') };
const MOSS_M: Material = { ramp: ramp('#1a2e12', '#2a4a1a', '#406a26', '#5e9034', '#86b848'), outline: hex('#0a1406') };
const FIRE = (k: number): Material => ({ ramp: ramp('#c0340a', '#ff6a14', '#ffa832', '#ffe070', '#fff8d0'), outline: hex('#3a0804'), emissive: 0.8 + k * 0.2, noAO: true, noOutline: true });

const GEM: Record<Element, Material> = {
  water: { ramp: ramp('#0e3a7a', '#1e6cc0', '#4aa4f0', '#a4dcff', '#ffffff'), outline: INK, emissive: 0.85, shine: true, noAO: true },
  earth: { ramp: ramp('#1e5a1a', '#3c9a2a', '#7ad84a', '#c8ff90', '#f4ffe0'), outline: INK, emissive: 0.8, shine: true, noAO: true },
  air: { ramp: ramp('#3a7a8a', '#6ab8c8', '#a4e4f0', '#e0fcff', '#ffffff'), outline: INK, emissive: 0.8, shine: true, noAO: true },
  fire: { ramp: ramp('#8a1a08', '#e0460e', '#ff8a24', '#ffd060', '#fff8d0'), outline: INK, emissive: 0.9, shine: true, noAO: true },
};

export const ELEMENTS: Element[] = ['water', 'earth', 'air', 'fire'];

export const TPILLAR_W = 22;
export const TPILLAR_H = 62;
export const TPILLAR_OY = 58;

/** A fluted sandstone pillar, an element's gem set in a brass collar round its middle. */
export function templePillar(el: Element): PixelCanvas {
  const c = new PixelCanvas(TPILLAR_W, TPILLAR_H);
  const cx = 11;
  c.part();
  c.shape(52, 58, (y) => [cx - 9 + (y < 54 ? 1 : 0), cx + 9 - (y < 54 ? 1 : 0)], SANDSTONE, (_x, _y, t, u) => cyl(t, 0.6 - u));
  c.part();
  c.shape(49, 52, () => [cx - 7, cx + 7], SANDSTONE, (_x, _y, t) => cyl(t, 0.5));
  c.part();
  c.shape(9, 49, () => [cx - 5.2, cx + 5.2], SANDSTONE, (_x, _y, t) => cyl(t, 0.08));
  for (let y = 11; y < 48; y++) for (const f of [-3, 0, 3]) c.shade(cx + f, y, -1);
  // Weathering: a few chips out of the shaft.
  const R = rng(el.length * 31 + 7);
  for (let k = 0; k < 5; k++) c.shade(cx - 4 + R() * 8, 12 + R() * 34, -1);
  // The brass collar and its gem.
  c.part();
  c.shape(26, 31, () => [cx - 5.8, cx + 5.8], BRASS, (_x, _y, t, u) => cyl(t, 0.5 - u));
  c.part();
  c.ellipse(cx, 28.5, 2.4, 2.8, GEM[el]);
  c.spark(cx - 1, 27, hex('#ffffff'), 0.7);
  // Capital: a flared block with a ledge, a carved ring of flame-leaves.
  c.part();
  c.shape(4, 9, (y) => {
    const hw = 5.4 + (9 - y) * 0.8;
    return [cx - hw, cx + hw];
  }, SANDSTONE, (_x, _y, t, u) => cyl(t, 0.5 - u * 0.4));
  for (let x = -8; x <= 8; x += 2) c.shade(cx + x, 6, -1);
  c.part();
  c.shape(1, 4, () => [cx - 9.5, cx + 9.5], SANDSTONE, (_x, _y, t, u) => cyl(t, 0.8 - u));
  return c;
}

export const FIREBOWL_W = 20;
export const FIREBOWL_H = 36;
export const FIREBOWL_OY = 34;
export const FIREBOWL_FRAMES = 4;

/** A brass fire bowl on a sandstone pedestal, burning warm and high. `f` flickers the flame. */
export function fireBowl(f: number): PixelCanvas {
  const c = new PixelCanvas(FIREBOWL_W, FIREBOWL_H);
  const cx = 10;
  c.part();
  c.shape(30, 34, () => [cx - 6.5, cx + 6.5], SANDSTONE, (_x, _y, t, u) => cyl(t, 0.7 - u));
  c.part();
  c.shape(19, 30, (y) => [cx - 2.6 - (y > 27 ? 1 : 0), cx + 2.6 + (y > 27 ? 1 : 0)], SANDSTONE, (_x, _y, t) => cyl(t, 0.1));
  for (let y = 20; y < 29; y++) c.shade(cx, y, -1);
  // The bowl.
  c.part();
  c.shape(13, 19, (y) => {
    const u = (y - 13) / 6;
    const hw = 7.4 - u * u * 3.4;
    return [cx - hw, cx + hw];
  }, BRASS, (_x, _y, t, u) => sphere(t * 0.9, 0.2 - u * 0.6));
  c.part();
  c.shape(12, 13, () => [cx - 7.6, cx + 7.6], BRASS, (_x, _y, t) => cyl(t, 0.8));
  // A band of the four elements' gems round it.
  c.part();
  ELEMENTS.forEach((el, k) => c.px(cx - 4.5 + k * 3, 15, GEM[el]));
  // The flame.
  c.part();
  const R = rng(f * 17 + 5);
  const sway = [0, 1, 0, -1][f % 4];
  const top = 1 + (f % 2);
  c.shape(top, 12, (y) => {
    const u = (y - top) / (12 - top);
    const hw = 0.5 + Math.sin(Math.min(1, u) * Math.PI * 0.72) * 5;
    const lean = (1 - u) * sway * 1.6;
    return [cx - hw + lean, cx + hw + lean];
  }, FIRE(0.5), (_x, _y, t) => cyl(t, 0.2), { bias: -1 });
  for (let y = 6; y < 12; y++) {
    const hw = (y - 5) * 0.3;
    for (let x = Math.floor(cx - hw); x <= cx + hw; x++) c.spark(x + sway * 0.5, y, HOT, 0.4);
  }
  for (let k = 0; k < 4; k++) c.spark(cx + (R() - 0.5) * 9 + sway, R() * 4, k % 2 ? EMBER : HOT, 0.5 + R() * 0.4);
  return c;
}

export const BOULDER_W = 32;
export const BOULDER_H = 26;
export const BOULDER_OY = 22;

/** A boulder fallen in the Stone Vault: mossy on top, a vein of earth-crystal through it. */
export function boulder(v: number): PixelCanvas {
  const c = new PixelCanvas(BOULDER_W, BOULDER_H);
  const R = rng(v * 41 + 9);
  c.part();
  c.ellipse(16, 15, 12.5, 8.5, ROCK);
  c.part();
  c.ellipse(11 + v * 3, 12, 7, 6, ROCK);
  c.part();
  c.ellipse(21 - v * 2, 16.5, 6.5, 5, ROCK);
  // Cracks and chips.
  for (let k = 0; k < 8; k++) c.shade(6 + R() * 20, 9 + R() * 12, -1);
  for (let y = 10; y < 22; y++) c.shade(16 + Math.round(Math.sin(y * 0.7) * 1.2), y, -1);
  // Moss over its crown.
  c.part();
  for (let x = 5; x <= 25; x++) {
    const y = 7 + Math.abs(x - 13) * 0.18 + (R() < 0.3 ? 1 : 0);
    if (R() < 0.8) c.px(x, Math.round(y), MOSS_M, sphere((x - 15) / 14, 0.6));
    if (R() < 0.3) c.px(x, Math.round(y + 1), MOSS_M);
  }
  // The crystal vein.
  c.part();
  for (let k = 0; k < 5; k++) c.px(19 + k, 13 + Math.round(k * 0.6), GEM.earth);
  c.px(22, 12, GEM.earth);
  return c;
}

export const CRYSTAL_W = 18;
export const CRYSTAL_H = 22;
export const CRYSTAL_OY = 20;

/** A cluster of an element's crystals growing out of the floor. */
export function elementCrystal(el: Element): PixelCanvas {
  const c = new PixelCanvas(CRYSTAL_W, CRYSTAL_H);
  const m = GEM[el];
  const shards: [number, number, number, number][] = [
    [9, 20, 8, 3],
    [5, 20, 3, 9],
    [13, 20, 15, 10],
    [7, 20, 5, 13],
    [11, 20, 12, 6],
  ];
  // Rubble at the base.
  c.part();
  c.ellipse(9, 19.5, 7, 2, SANDSTONE_DARK, { flatten: 0.5 });
  shards.forEach(([bx, by, tx, ty], k) => {
    c.part();
    const r = k === 0 ? 2.6 : 1.8;
    c.shape(ty, by, (y) => {
      const u = (y - ty) / (by - ty);
      const hw = 0.3 + Math.min(1, u * 2.2) * r;
      const x = tx + (bx - tx) * u;
      return [x - hw, x + hw];
    }, m, (_x, _y, t) => ({ x: t * 0.7, y: 0.3, z: 0.65 }));
    c.spark(tx, ty + 1, hex('#ffffff'), 0.6);
  });
  return c;
}

export const OBELISK_W = 24;
export const OBELISK_H = 58;
export const OBELISK_OY = 54;

/** The element's sign, carved into an obelisk's face (5 wide, 6 high). */
const SIGNS: Record<Element, string[]> = {
  water: ['..#..', '..#..', '.###.', '#####', '#####', '.###.'],
  earth: ['..#..', '.#.#.', '#...#', '#####', '.....', '#####'],
  air: ['.###.', '#...#', '#.#.#', '#..#.', '.#...', '..##.'],
  fire: ['..#..', '.##..', '.###.', '##.##', '#####', '.###.'],
};

/** One of the Heart's four obelisks: black stone, its element's sign and gem blazing on its face. */
export function obelisk(el: Element): PixelCanvas {
  const c = new PixelCanvas(OBELISK_W, OBELISK_H);
  const cx = 12;
  const g = GEM[el];
  // Plinth.
  c.part();
  c.shape(47, 54, (y) => [cx - 10 + (y < 50 ? 1 : 0), cx + 10 - (y < 50 ? 1 : 0)], SANDSTONE, (_x, _y, t, u) => cyl(t, 0.6 - u));
  // The shaft, tapering, to a pyramid tip.
  c.part();
  c.shape(10, 47, (y) => {
    const u = (y - 10) / 37;
    const hw = 4.6 + u * 1.8;
    return [cx - hw, cx + hw];
  }, OBSIDIAN, (_x, _y, t) => cyl(t, 0.1));
  c.part();
  c.shape(3, 10, (y) => {
    const u = (y - 3) / 7;
    const hw = 0.5 + u * 4.2;
    return [cx - hw, cx + hw];
  }, OBSIDIAN, (_x, _y, t) => cyl(t, 0.6));
  // Edges catching the light.
  for (let y = 11; y < 46; y++) c.shade(cx - 3, y, 1);
  // The sign, glowing.
  c.part();
  SIGNS[el].forEach((row, y) => [...row].forEach((ch, x) => ch === '#' && c.px(cx - 2 + x, 26 + y, g)));
  // A gem at the capstone.
  c.part();
  c.ellipse(cx, 13, 1.8, 2.2, g);
  // Glyphs down the shaft.
  const R = rng(el.length * 13 + 3);
  for (let y = 16; y < 44; y += 3) {
    if (y > 23 && y < 34) continue;
    if (R() < 0.7) c.spark(cx - 1 + Math.floor(R() * 3), y, EL_RGB[el], 0.35);
  }
  return c;
}
