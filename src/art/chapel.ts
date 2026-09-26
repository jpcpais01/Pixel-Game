// The walk-in chapel on the east of the Runestone Clearing (see
// world/chapelLayout.ts), in the Rune Temple's own palette.
//
// Inside, painted in one piece like the temple's room: a marble north wall
// with a small rose window, two lancets and the keepers' banners; polished
// indigo stone laid in diamonds with gold stars; a gold-ringed rosette in the
// middle, a crimson runner from the door, a dais for each keeper; the walls'
// tops all round, and the doorway in the south wall.
//
// Outside: the chapel of weathered fieldstone, its ridge running back from the
// door so its mossy slate roof falls away to either side, a gable over the
// door with a rose of rune glass, oak doors open on a warm hall, two small
// windows over flower boxes, lanterns, ivy and bushes.

import { mix } from './bitmap';
import { hash2 } from './env';
import { KEY_LIGHT, PixelCanvas, cyl, sphere, type RGB, type Vec3 } from './pixel';
import { fbm } from './spirit';
import {
  BUSH,
  CAPS,
  DAIS_ST,
  FIELDSTONE,
  GEM_FLOWER_GOLD,
  GEM_FLOWER_PINK,
  GLASS,
  GOLDEN,
  GOLDS,
  HEARTH,
  INK_R,
  IRON,
  KEEPER_RGB,
  OAK,
  PALE,
  PETAL_R,
  PETAL_V,
  ROOF_MOSS,
  ROOF_SLATE,
  RUNE_GLASS,
  RUNNER,
  TILE_A,
  TILE_B,
  VIOLET,
  WALL,
  type SanctumArt,
} from './sanctum';
import { CH_EXT_H, CH_EXT_W, CH_H, CH_W, C_BANNERS, C_CAP, C_CIRCLE, C_DAIS, C_DOOR_HW, C_FLOOR, C_FRONT, C_LANCETS, C_SIDE, C_WINDOW } from '../world/chapelLayout';

type N3 = [number, number, number];
const UP: N3 = [0, 0, 1];
const CLOTH_VIOLET = [hex3(0x1a0e32), hex3(0x2a1650), hex3(0x3e2272), hex3(0x563096), hex3(0x7044bc)];

function hex3(v: number): RGB {
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** The chapel's hall, painted in one piece: CH_W x CH_H. */
export function* chapelArt(): Generator<void, SanctumArt, void> {
  const W = CH_W;
  const H = CH_H;
  const N = W * H;
  const diffuse = new Uint8ClampedArray(N * 4);
  const normal = new Uint8ClampedArray(N * 4);
  const emissive = new Uint8ClampedArray(N * 4);
  const L = KEY_LIGHT;
  const Ll = Math.hypot(L.x, L.y, L.z);

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
  const faceN: N3 = [0, -0.5, 0.86];
  const doorL = W / 2 - C_DOOR_HW;
  const doorR = W / 2 + C_DOOR_HW;

  for (let y = 0; y < H; y++) {
    if (y % 16 === 0) yield;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const inX = x >= C_SIDE && x < W - C_SIDE;

      // ---- The north wall's face.
      if (inX && y >= C_CAP && y < C_FLOOR) {
        const yy = y - C_CAP;
        const hgt = C_FLOOR - C_CAP;
        // The rose window: a stone ring, a gold one, glass in lead.
        const wd = Math.hypot(x + 0.5 - C_WINDOW.x, y + 0.5 - C_WINDOW.y);
        if (wd < C_WINDOW.r + 2) {
          if (wd >= C_WINDOW.r) {
            const n: N3 = [((x - C_WINDOW.x) / wd) * 0.6, (-(y - C_WINDOW.y) / wd) * 0.6, 0.8];
            put(i, pick(WALL, 5 + shadeOf(n) * 2), n);
          } else if (wd >= C_WINDOW.r - 1) put(i, pick(GOLDS, 3), faceN, GOLDEN, 0.25);
          else {
            const a = Math.atan2(y + 0.5 - C_WINDOW.y, x + 0.5 - C_WINDOW.x) + Math.PI;
            const seg = (a / (Math.PI * 2)) * 8;
            const lead = (Math.abs(seg - Math.round(seg)) * (wd * 0.8) < 0.5 && wd > 4) || Math.abs(wd - 4) < 0.6;
            if (lead) put(i, INK_R, faceN);
            else {
              const g = wd < 4 ? GLASS.gold : Math.floor(seg) % 2 ? GLASS.violet : GLASS.rose;
              put(i, mix(INK_R, g, 0.55), faceN, g, 0.7 + fbm(x, y, 3, 501, 2) * 0.4);
            }
          }
          continue;
        }
        // Two lancets.
        let lit = false;
        for (const lx of C_LANCETS) {
          const dx = x + 0.5 - lx;
          const top = 5;
          const bot = 32;
          const inside = Math.abs(dx) < 3.5 && yy >= top && yy < bot && (yy >= top + 3 || Math.hypot(dx, yy - (top + 3)) < 3.5);
          if (!inside) continue;
          const edge = Math.abs(dx) > 2.5 || (yy < top + 3 && Math.hypot(dx, yy - (top + 3)) > 2.5);
          if (edge) put(i, pick(GOLDS, 2), faceN, GOLDEN, 0.12);
          else if (yy === top + 13) put(i, INK_R, faceN);
          else {
            const k = (yy - top) / (bot - top);
            const g = mix(GLASS.violet, GLASS.blue, k);
            put(i, mix(INK_R, g, 0.5), faceN, g, 0.7 - k * 0.2);
          }
          lit = true;
          break;
        }
        if (lit) continue;
        // The keepers' banners, on gold rods.
        let banner = false;
        for (const id of ['disenchant', 'upgrade'] as const) {
          const dx = x + 0.5 - C_BANNERS[id];
          if (yy >= 3 && yy <= 4 && Math.abs(dx) < 9) {
            put(i, pick(GOLDS, yy === 3 ? 4 : 2), faceN);
            banner = true;
            break;
          }
          const point = 32 + (7 - Math.abs(dx)) * 0.6;
          if (Math.abs(dx) < 7 && yy > 4 && yy < point) {
            const cloth = id === 'disenchant' ? CLOTH_VIOLET : RUNNER;
            if (Math.abs(dx) > 5.8 || yy > point - 1.5) put(i, pick(GOLDS, 3), faceN);
            else {
              const sy = yy - 17;
              const sigil =
                id === 'disenchant'
                  ? Math.abs(dx) + Math.abs(sy) * 0.7 < 3.6 && Math.abs(dx) + Math.abs(sy) * 0.7 > 2
                  : (sy >= -3 && sy <= -2 && Math.abs(dx) < 4) || (sy >= -1 && sy <= 2 && Math.abs(dx) < 1.5) || (sy === 3 && Math.abs(dx) < 3);
              if (sigil) put(i, pick(GOLDS, 4), faceN, KEEPER_RGB[id], 0.6);
              else put(i, pick(cloth, 2.4 + Math.sin(dx * 1.2) * 0.8 + (yy < 7 ? -0.6 : 0)), faceN);
            }
            banner = true;
            break;
          }
        }
        if (banner) continue;
        // The rune band near the foot of the wall.
        if (yy >= hgt - 8 && yy <= hgt - 3) {
          if (yy === hgt - 8 || yy === hgt - 3) {
            put(i, pick(WALL, yy === hgt - 8 ? 5 : 2), yy === hgt - 8 ? [0, 0.4, 0.9] : faceN);
            continue;
          }
          const gx = Math.floor(x / 6);
          const lx = x % 6;
          const glyph = lx > 0 && lx < 5 && hash2(gx, yy, 511) > 0.45 && hash2(gx, lx, 513) > 0.3;
          put(i, glyph ? mix(pick(WALL, 1), VIOLET, 0.5) : pick(WALL, 1), faceN, glyph ? VIOLET : undefined, 0.5);
          continue;
        }
        // Moulding along the top, then courses of cut marble, darker toward the floor.
        if (yy < 3) {
          put(i, pick(WALL, yy < 1 ? 6 : 2), yy < 1 ? [0, 0.5, 0.86] : faceN);
          continue;
        }
        const row = Math.floor((yy - 3) / 7);
        const off = row % 2 ? 9 : 0;
        const lx = (x + off) % 18;
        const ly = (yy - 3) % 7;
        if (ly === 6 || lx === 0) {
          put(i, pick(WALL, 1), faceN);
          continue;
        }
        let n = faceN;
        let idx = 3.3 + (hash2(Math.floor((x + off) / 18), row, 517) - 0.5) * 1.2 + (fbm(x, y, 6, 519, 2) - 0.5) * 0.8;
        if (ly === 0) {
          n = [0, 0.3, 0.95];
          idx += 0.8;
        }
        if (yy > hgt - 3) idx -= 1.4;
        put(i, pick(WALL, idx + shadeOf(n) * 0.6), n);
        continue;
      }

      // ---- The floor, and the doorway through the south wall.
      const inFloor = inX && y >= C_FLOOR && y < C_FRONT;
      const inDoor = x >= doorL && x < doorR && y >= C_FRONT;
      if (inFloor || inDoor) {
        const fy = y - C_FLOOR;
        const cu = (x + 0.5 - C_CIRCLE.x) / C_CIRCLE.rx;
        const cv = (y + 0.5 - C_CIRCLE.y) / C_CIRCLE.ry;
        const cr = Math.hypot(cu, cv);
        // The crimson runner from the door to the rosette.
        if (x >= doorL + 2 && x < doorR - 2 && y >= C_CIRCLE.y + C_CIRCLE.ry * 0.95 && cr >= 0.97) {
          const edge = x === doorL + 2 || x === doorR - 3;
          if (inDoor) {
            // The threshold, and daylight spilling in over it.
            const k = (y - C_FRONT) / (H - C_FRONT);
            put(i, edge ? pick(GOLDS, 3) : pick(RUNNER, 2.6 + k), y === C_FRONT ? [0, 0.5, 0.86] : UP, PALE, k * k * 0.35);
          } else if (edge) put(i, pick(GOLDS, 3), UP, GOLDEN, 0.08);
          else {
            const d = Math.abs((x - W / 2) % 6) + Math.abs((y % 6) - 3);
            put(i, pick(RUNNER, 3 + (d === 3 ? 1 : 0) + (fbm(x, y, 4, 531, 2) - 0.5) * 0.8), UP);
          }
          continue;
        }
        if (inDoor) {
          const jamb = x < doorL + 2 || x >= doorR - 2;
          const k = (y - C_FRONT) / (H - C_FRONT);
          put(i, jamb ? pick(GOLDS, 2) : pick(DAIS_ST, 3 + k), UP, PALE, k * k * 0.3);
          continue;
        }
        // The keepers' daises.
        let done = false;
        for (const id of ['disenchant', 'upgrade'] as const) {
          const d = C_DAIS[id];
          const du = (x + 0.5 - d.x) / d.rx;
          const dv = (y + 0.5 - d.y) / d.ry;
          const r = Math.hypot(du, dv);
          if (r >= 1) continue;
          done = true;
          const glow = KEEPER_RGB[id];
          if (r > 0.88 && dv > 0) put(i, pick(DAIS_ST, 1.5), faceN);
          else if (r > 0.88) put(i, pick(DAIS_ST, 5), [du * 0.4, -dv * 0.4, 0.8]);
          else if (r > 0.76 && r < 0.83) put(i, mix(pick(DAIS_ST, 2), glow, 0.55), UP, glow, 0.5);
          else {
            const a = Math.atan2(dv, du);
            const ringLine = Math.abs(((r * 3) % 1) - 0.5) > 0.44;
            const spoke = Math.abs((((a / (Math.PI * 2)) * 12 + 12) % 1) - 0.5) > 0.45 && r > 0.3;
            let idx = 3.6 - r * 0.8 + (fbm(x, y, 5, 541, 2) - 0.5) * 0.6;
            if (ringLine || spoke) idx -= 1.2;
            put(i, pick(DAIS_ST, idx), UP, glow, Math.max(0, 0.25 - r * 0.3));
          }
          break;
        }
        if (done) continue;

        // Diamonds of polished stone, gold stars where their corners meet.
        const dp = (x + 0.5 - W / 2) / 18 + (fy + 0.5) / 13;
        const dq = (x + 0.5 - W / 2) / 18 - (fy + 0.5) / 13;
        const ip = Math.floor(dp);
        const iq = Math.floor(dq);
        const fp = dp - ip;
        const fq = dq - iq;
        const odd = (ip + iq) & 1;
        const base = odd ? TILE_A : TILE_B;
        const ep = Math.min(fp, 1 - fp);
        const eq = Math.min(fq, 1 - fq);
        let n: N3 = UP;
        let idx = 3.2 + (hash2(ip, iq, 551) - 0.5) * 0.7;
        let glow: RGB | undefined;
        let gk = 0;
        if (fp < 0.09) {
          n = [-0.25, 0.3, 0.9];
          idx += 0.7;
        } else if (fp > 0.92) {
          n = [0.25, -0.3, 0.9];
          idx -= 0.6;
        } else if (fq < 0.09) {
          n = [-0.25, -0.3, 0.9];
          idx += 0.3;
        } else if (fq > 0.92) {
          n = [0.25, 0.3, 0.9];
          idx -= 0.3;
        }
        if (!odd && Math.abs(Math.max(Math.abs(fp - 0.5), Math.abs(fq - 0.5)) - 0.27) < 0.025) {
          idx += 1;
          glow = GOLDEN;
          gk = 0.03;
        }
        const vein = Math.abs(fbm(x, y * 1.3, 18, 553, 3) - 0.5);
        if (vein < 0.012) idx += 1.6;
        else if (vein < 0.024) idx += 0.6;
        // The window's light down the floor, and shade at the walls' feet.
        const pool = Math.exp(-(((x - C_WINDOW.x) / 34) ** 2) - (fy / 60) ** 2);
        idx += pool * 1.4;
        if (fy < 6) idx -= (6 - fy) / 2.6;
        const side = Math.min(x - C_SIDE, W - C_SIDE - 1 - x, C_FRONT - 1 - y);
        if (side < 7) idx -= (7 - side) / 4;
        if (pool > 0.1 && !glow) {
          glow = mix(GLASS.violet, GLASS.blue, 0.5);
          gk = pool * 0.1 * (0.7 + hash2(x >> 1, y >> 1, 555) * 0.3);
        }

        // The rosette: a gold ring, a violet ring, twelve petals in two layers.
        if (cr < 1) {
          if (cr > 0.93) {
            put(i, pick(GOLDS, 3 + (cr > 0.965 ? -1 : 0.5)), UP, GOLDEN, 0.3);
            continue;
          }
          if (cr > 0.84 && cr < 0.89) {
            put(i, mix(pick(TILE_A, 2), VIOLET, 0.55), UP, VIOLET, 0.5);
            continue;
          }
          if (cr >= 0.84) {
            put(i, pick(TILE_A, 1.5), UP);
            continue;
          }
          const r = cr / 0.84;
          const a = Math.atan2(cv, cu);
          const co = Math.abs(Math.cos(6 * a));
          const si = Math.abs(Math.sin(6 * a));
          const outer = 0.97 * (0.46 + 0.54 * co ** 0.7);
          const inner = 0.66 * (0.5 + 0.5 * si ** 0.7);
          const lw = 0.055;
          if (r < 0.15) {
            const nn: N3 = [cu * 3, -cv * 3, 0.8];
            put(i, pick(GOLDS, 3 + shadeOf(nn) * 1.5), nn, GOLDEN, 0.5);
          } else if (r < 0.22) put(i, r < 0.18 ? pick(TILE_A, 1) : pick(GOLDS, 3), UP, GOLDEN, r < 0.18 ? 0 : 0.3);
          else if (Math.abs(r - inner) < lw || Math.abs(r - outer) < lw) put(i, pick(GOLDS, 2.6 + (r < inner ? 0.6 : 0)), UP, GOLDEN, 0.16);
          else if (r < inner) put(i, pick(PETAL_R, 2 + (inner - r) * 3 + (co < 0.08 ? 1.4 : 0)), UP, GLASS.rose, 0.06);
          else if (r < outer) put(i, pick(PETAL_V, 2.8 - (r - inner) * 2.6 + (si < 0.08 ? 1.3 : 0)), UP, VIOLET, 0.06);
          else {
            const fleck = hash2(x, y, 559) > 0.96;
            put(i, fleck ? mix(pick(TILE_A, 2), PALE, 0.6) : pick(TILE_A, 1.2), UP, fleck ? PALE : VIOLET, fleck ? 0.5 : 0.04);
          }
          continue;
        }
        if (ep + eq < 0.08) {
          put(i, pick(GOLDS, ep + eq < 0.035 ? 3.6 : 2.4), UP, GOLDEN, 0.1);
          continue;
        }
        if (ep < 0.04 || eq < 0.04) {
          put(i, pick(base, 0.2 + pool * 0.6), UP);
          continue;
        }
        put(i, pick(base, idx + shadeOf(n) * 0.5), n, glow, gk);
        continue;
      }

      // ---- The walls' tops all round: cut stone, their inner edges catching the light.
      const inner = (x === C_SIDE - 1 && y >= C_CAP) || (x === W - C_SIDE && y >= C_CAP) || (y === C_CAP - 1 && inX) || (y === C_FRONT && inX);
      const outer = x === 0 || x === W - 1 || y === 0 || y === H - 1;
      const jamb = y >= C_FRONT && (x === doorL - 1 || x === doorR);
      if (jamb) {
        put(i, pick(GOLDS, 3), UP, GOLDEN, 0.15);
        continue;
      }
      const bx = Math.floor(x / 10);
      const by = Math.floor(y / 7);
      let idx = 2.6 + (hash2(bx, by, 561) - 0.5) * 0.9 + (fbm(x, y, 5, 563, 2) - 0.5) * 0.6;
      if (x % 10 === 0 || y % 7 === 0) idx -= 1;
      if (inner) idx += 2.2;
      if (outer) idx = 0;
      put(i, pick(CAPS, idx), UP);
    }
  }
  return { diffuse, normal, emissive };
}

/**
 * The chapel from outside: CH_EXT_W x CH_EXT_H, bottom row at the front
 * wall's foot. Its roof covers the whole hall, so it hides everything inside
 * until the hero walks in and it fades away.
 */
export function chapelExterior(): PixelCanvas {
  const W = CH_EXT_W;
  const H = CH_EXT_H;
  const c = new PixelCanvas(W, H);
  const cx = W / 2;
  const eaves = 236;
  const wallN: Vec3 = { x: 0, y: -0.45, z: 0.88 };

  /** Rough-cut stone courses: each block its own tone, mortar dark, moss in the joints. */
  const masonry = (x0: number, x1: number, y0: number, y1: number, rowH: number, seed: number, keep?: (x: number, y: number) => boolean) => {
    for (let y = y0; y < y1; y++) {
      const row = Math.floor((y - y0) / rowH);
      const ly = (y - y0) % rowH;
      const off = Math.floor(hash2(row, 0, seed) * 14);
      for (let x = x0; x < x1; x++) {
        if (keep && !keep(x, y)) continue;
        const bw = 10 + Math.floor(hash2(Math.floor((x + off) / 12), row, seed + 1) * 3) * 2;
        const lx = (x + off) % bw;
        const block = hash2(Math.floor((x + off) / bw), row, seed + 2);
        let bias = Math.round((block - 0.5) * 2.2 + (fbm(x, y, 5, seed + 3, 2) - 0.5) * 1.2);
        if (ly === rowH - 1 || lx === 0) bias = -3;
        else if (ly === 0) bias += 1;
        const mossy = fbm(x, y, 9, seed + 4, 2) > 0.66 && (ly === rowH - 1 || lx === 0 || y > y1 - 6);
        if (mossy) c.px(x, y, BUSH, wallN, { bias: -1 });
        else c.px(x, y, FIELDSTONE, wallN, { bias });
      }
    }
  };

  // The roof: its ridge runs back from the door, slate falling away to either side in courses, moss over it.
  const gApex = 196;
  const gHw = (y: number) => ((y - gApex) / (eaves - gApex)) * 72;
  c.part();
  for (let y = 3; y <= eaves; y++) {
    // Rounded back corners.
    const inset = y < 9 ? Math.round(6 - Math.sqrt(Math.max(0, 36 - (9 - y) ** 2))) : 0;
    for (let x = inset; x < W - inset; x++) {
      const dx = x + 0.5 - cx;
      const side = dx < 0 ? -1 : 1;
      const d = Math.abs(dx);
      const n: Vec3 = { x: side * 0.5, y: 0.12, z: 0.86 };
      const course = Math.floor(d / 6);
      const lc = d % 6;
      const off = course % 2 ? 5 : 0;
      const ly = (y + off) % 10;
      // Moss gathers low on the slopes, toward the eaves.
      const moss = fbm(x, y, 9, 601, 3) + (d / 78) * 0.22 - 0.1;
      if (moss > 0.68) {
        c.px(x, y, ROOF_MOSS, n, { bias: Math.round((fbm(x, y, 3, 603, 2) - 0.5) * 2) - 1 + (lc > 5 ? -1 : 0) });
        continue;
      }
      let bias = Math.round((hash2(course, Math.floor((y + off) / 10) * side, 605) - 0.5) * 2);
      if (lc > 5) bias = -2;
      else if (lc < 1) bias += 1;
      if (ly === 0) bias -= 1;
      // Lighter up by the ridge, the east slope turned from the light.
      if (d < 10) bias += 1;
      if (side > 0) bias -= 1;
      if (y <= 4 || x - inset < 2 || W - inset - x <= 2) bias -= 2;
      c.px(x, y, ROOF_SLATE, n, { bias });
    }
  }
  // Grass tufts along the eaves and on the ridge, and the ridge's stone cap.
  for (let y = 4; y < eaves; y++) for (const x of [1, W - 2]) if (hash2(x, y, 607) > 0.72) c.px(x, y, ROOF_MOSS, { x: x < cx ? -0.5 : 0.5, y: 0, z: 0.85 }, { bias: 2 });
  c.part();
  for (let y = 5; y < gApex - 2; y += 4) c.ellipse(cx, y, 2.6, 2.4, FIELDSTONE, { bias: 1 + (hash2(y, 0, 609) > 0.7 ? -1 : 0) });
  c.part();
  for (let y = 5; y < gApex - 2; y++) if (fbm(cx, y, 6, 611, 2) > 0.62) c.px(cx + (hash2(y, 1, 611) > 0.5 ? 1 : -1) * 2, y, ROOF_MOSS, { x: 0, y: 0.3, z: 0.9 }, { bias: 1 });

  // A stone chimney on the west slope, its cap blackened.
  c.part();
  masonry(cx - 34, cx - 22, 54, 72, 5, 613);
  c.part();
  c.shape(50, 54, () => [cx - 35, cx - 21], FIELDSTONE, (_x, y, t) => (y < 52 ? { x: t * 0.2, y: 0.75, z: 0.65 } : { x: t * 0.3, y: -0.4, z: 0.85 }), { bias: 1 });
  c.part();
  c.ellipse(cx - 28, 51.5, 4, 1.4, IRON, { bias: -2 });

  // The gable over the door: stone under slate bargeboards, a rose of rune glass.
  c.part();
  masonry(0, W, gApex + 2, eaves + 1, 7, 621, (x, y) => Math.abs(x + 0.5 - cx) < gHw(y) - 2);
  c.part();
  for (let y = gApex; y <= eaves; y++) {
    const hw = gHw(y);
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) c.px(cx + sx * (hw - k) - (sx > 0 ? 1 : 0), y, ROOF_SLATE, { x: sx * 0.4, y: 0.4, z: 0.8 }, { bias: k === 0 ? -1 : 1 });
  }
  c.part();
  c.ellipse(cx, gApex - 1, 2.4, 2.4, FIELDSTONE, { bias: 2 });
  const ry = 222;
  c.part();
  for (let y = ry - 8; y <= ry + 8; y++) {
    for (let x = cx - 8; x <= cx + 8; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - ry);
      if (d > 7.5) continue;
      if (d > 5.8) c.px(x, y, FIELDSTONE, sphere((x + 0.5 - cx) / 8, (y + 0.5 - ry) / 8, 0.6), { bias: 2 });
      else {
        const a = Math.atan2(y + 0.5 - ry, x + 0.5 - cx) + Math.PI;
        const seg = (a / (Math.PI * 2)) * 6;
        const lead = (Math.abs(seg - Math.round(seg)) * d < 0.5 && d > 2) || Math.abs(d - 2) < 0.5;
        if (lead) c.px(x, y, IRON, wallN, { bias: -1 });
        else c.px(x, y, RUNE_GLASS, { x: 0, y: 0, z: 1 }, { bias: d < 2 ? 2 : Math.floor(seg) % 2, glow: 0.8 });
      }
    }
  }

  // The front wall, heavier quoins at its corners, and the eaves' shadow on it.
  const wl = 4;
  const wr = W - 4;
  c.part();
  masonry(wl, wr, eaves, H, 7, 631);
  c.part();
  for (const [x0, x1] of [
    [wl, wl + 9],
    [wr - 9, wr],
  ]) {
    for (let y = eaves; y < H; y++) {
      const row = Math.floor((y - eaves) / 8);
      const wide = row % 2 === 0;
      const xa = x0 === wl ? x0 : wide ? x0 : x0 + 3;
      const xb = x0 === wl ? (wide ? x1 : x1 - 3) : x1;
      for (let x = xa; x < xb; x++) {
        const ly = (y - eaves) % 8;
        c.px(x, y, FIELDSTONE, wallN, { bias: ly === 7 ? -3 : ly === 0 ? 2 : 1 });
      }
    }
  }
  for (let y = eaves + 1; y < eaves + 4; y++) for (let x = wl; x < wr; x++) if (Math.abs(x + 0.5 - cx) >= gHw(eaves) - 3) c.shade(x, y, y < eaves + 2 ? -2 : -1);

  // The doorway: wedge stones round an arch, oak doors open on a warm hall.
  const spring = 252;
  const dr = C_DOOR_HW;
  const inArch = (x: number, y: number, r: number) => (y >= spring ? Math.abs(x + 0.5 - cx) < r : Math.hypot(x + 0.5 - cx, y + 0.5 - spring) < r);
  c.part();
  for (let y = spring - dr - 4; y < H; y++) {
    for (let x = cx - dr - 4; x < cx + dr + 4; x++) {
      if (!inArch(x, y, dr + 3) || inArch(x, y, dr)) continue;
      const a = Math.atan2(y + 0.5 - spring, x + 0.5 - cx);
      const seam = y < spring ? Math.abs(((a / Math.PI) * 8) % 1) < 0.14 : (y - spring) % 6 === 5;
      c.px(x, y, FIELDSTONE, wallN, { bias: seam ? -2 : 2 });
    }
  }
  c.part();
  for (let y = spring - dr; y < H; y++) {
    for (let x = cx - dr; x < cx + dr; x++) {
      if (!inArch(x, y, dr)) continue;
      const side = Math.abs(x + 0.5 - cx);
      if (side > dr - 4) {
        const stud = (y - spring) % 5 === 0 && side > dr - 2.5;
        if (stud) c.px(x, y, IRON, wallN, { bias: 1 });
        else c.px(x, y, OAK, { x: x < cx ? 0.5 : -0.5, y: -0.2, z: 0.84 }, { bias: (x - (cx - dr)) % 2 === 0 ? 0 : -1 });
        continue;
      }
      const k = (y - (spring - dr)) / (H - (spring - dr));
      c.px(x, y, HEARTH, { x: 0, y: 0, z: 1 }, { bias: Math.round(k * 2.5 - 1.5 - side / 6), glow: 0.35 + k * 0.5 });
    }
  }
  c.part();
  c.shape(spring - dr - 5, spring - dr - 1, () => [cx - 3, cx + 3], FIELDSTONE, (_x, _y, t) => cyl(t, 0.2), { bias: 2 });
  c.part();
  c.px(cx, spring - dr - 3, RUNE_GLASS, wallN, { glow: 0.9 });
  c.px(cx - 1, spring - dr - 2, RUNE_GLASS, wallN, { glow: 0.7 });

  // Two small arched windows, warm light behind oak mullions, flower boxes under them.
  for (const wx of [cx - 46, cx + 46]) {
    const ws = 250;
    const wr2 = 5;
    const inWin = (x: number, y: number, r: number) => (y >= ws ? Math.abs(x + 0.5 - wx) < r && y < 262 : Math.hypot(x + 0.5 - wx, y + 0.5 - ws) < r);
    c.part();
    for (let y = ws - wr2 - 2; y < 263; y++) {
      for (let x = wx - wr2 - 2; x < wx + wr2 + 2; x++) {
        if (!inWin(x, y, wr2 + 2)) continue;
        if (!inWin(x, y, wr2)) c.px(x, y, FIELDSTONE, wallN, { bias: 2 });
        else if (Math.abs(x + 0.5 - wx) < 1 || y === 255) c.px(x, y, OAK, wallN, { bias: 1 });
        else c.px(x, y, HEARTH, { x: 0, y: 0, z: 1 }, { bias: Math.round((y - ws) / 6), glow: 0.55 });
      }
    }
    c.part();
    c.shape(262, 265, () => [wx - 7, wx + 7], OAK, (_x, y, t) => (y === 262 ? { x: t * 0.2, y: 0.75, z: 0.65 } : { x: t * 0.3, y: -0.4, z: 0.85 }));
    c.part();
    for (let x = wx - 6; x <= wx + 6; x++) {
      const k = hash2(x, 7, 641);
      c.px(x, 261, BUSH, sphere(0, 0.4), { bias: 2 });
      if (k > 0.45) c.px(x, 260, k > 0.8 ? GEM_FLOWER_PINK : k > 0.62 ? GEM_FLOWER_GOLD : BUSH, sphere(0, 0.5), { bias: 2 });
    }
  }

  // Iron lanterns either side of the door.
  for (const lx of [cx - 21, cx + 21]) {
    c.part();
    c.line(lx, 245, lx + (lx < cx ? 2 : -2), 245, IRON);
    c.part();
    c.capsule(lx, 247, lx, 252, 1.8, 2.1, IRON);
    c.part();
    c.ellipse(lx, 249.5, 1.1, 1.7, HEARTH, { glow: 1 });
  }

  // Ivy up the corners, bushes at the wall's foot.
  c.part();
  for (const [x0, dir] of [
    [wl + 1, 1],
    [wr - 2, -1],
  ]) {
    for (let y = eaves - 6; y < H - 2; y++) {
      const reach = 3 + Math.floor(fbm(x0, y, 5, 651, 2) * 6);
      for (let k = 0; k < reach; k++) if (hash2(x0 + k * dir, y, 653) > 0.35) c.px(x0 + k * dir, y, BUSH, { x: 0, y: 0.2, z: 0.95 }, { bias: Math.round(hash2(k, y, 655) * 2) - (k > reach - 2 ? 1 : 0) });
    }
  }
  for (const [bx, r] of [
    [8, 7],
    [W - 8, 7],
    [cx - 30, 4],
    [cx + 30, 4],
  ]) {
    c.part();
    c.ellipse(bx, H - 3, r, r * 0.6, BUSH, { flatten: 0.8 });
    for (let k = 0; k < 4; k++) if (hash2(bx, k, 657) > 0.4) c.px(bx - r + 2 + hash2(k, bx, 659) * (r * 2 - 4), H - 3 - r * 0.4 + hash2(bx, k, 661) * 2, k % 2 ? GEM_FLOWER_PINK : GEM_FLOWER_GOLD, sphere(0, 0.5), { bias: 2 });
  }
  return c;
}
