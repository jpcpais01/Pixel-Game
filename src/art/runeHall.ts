// The walk-in Rune Temple at the head of the Runestone Clearing (see
// world/sanctumLayout.ts), in the temple's own palette.
//
// Inside, painted on the ground in one piece: a marble north wall with a
// great rose window of stained glass, two lancets, pilasters with gold
// capitals, a band of violet runes and the keepers' banners; polished indigo
// stone laid in diamonds with gold stars, veined, the window's colours
// pooling on it; a rosette of twelve petals in a gold and violet rune circle,
// a crimson runner from the door, a round dais for each keeper ringed in
// their colour, and a candelabrum burning in each back corner. Two broad steps of
// fieldstone lead down from the door to the plaza.
//
// Outside: the temple of the plaza's weathered fieldstone, its ridge running
// back from the door so a steep roof of mossy slate falls away to either side,
// its back gable standing up against the forest; astride the ridge a small
// stone tower under a slate spire, a rune crystal burning in its open arch
// like a lantern. On the front gable a rose of rune glass. Below, the door under an arch of wedge stones with a glowing
// rune on its keystone, oak doors open on the warm hall, a band of runes
// under the eaves, buttresses, two lancets glowing over flower boxes,
// lanterns, ivy and bushes.

import { mix } from './bitmap';
import { hash2 } from './env';
import { KEY_LIGHT, PixelCanvas, cyl, hex, sphere, type Material, type RGB, type Vec3 } from './pixel';
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
  doorway,
  type SanctumArt,
} from './sanctum';
import {
  T_BANNERS,
  T_BRAZIERS,
  T_CAP,
  T_CIRCLE,
  T_DAIS,
  T_DOOR_HW,
  T_FLOOR,
  T_FRONT,
  T_LANCETS,
  T_SIDE,
  T_STEP_HW,
  T_WINDOW,
  TP_EXT_H,
  TP_EXT_RISE,
  TP_EXT_W,
  TP_H,
  TP_TEX_H,
  TP_W,
} from '../world/sanctumLayout';

type N3 = [number, number, number];
const ramp = (...c: string[]): RGB[] => c.map(hex);
const UP: N3 = [0, 0, 1];
const FACE: N3 = [0, -0.5, 0.86];
const CLOTH_VIOLET = ramp('#1a0e32', '#2a1650', '#3e2272', '#563096', '#7044bc');
const STEPS = FIELDSTONE.ramp;
const MOSS = BUSH.ramp;
const WARM: RGB = [255, 150, 70];
const WAX: Material = { ramp: ramp('#5a4a3a', '#8c7a62', '#bcaa8a', '#e4d6b8', '#f8f0dc'), outline: hex('#241a12') };
const FLAME: Material = { ramp: ramp('#c0500c', '#ff9a2a', '#ffd070', '#fff4c8'), outline: hex('#401000'), emissive: 1, noAO: true, noOutline: true };
/** Runes cut in the band under the eaves, 4 x 4 each. */
const GLYPHS = ['1001101001101001', '0110100101100110', '1110010001001110', '1000111010100011', '0100111101000100', '1011101000101011'];
/** Where the glowing things on the temple's front are, in its art: the lanterns, the rose window, the crystal in the spire's arch. */
export const TEMPLE_GLOWS = {
  lanterns: [-27, 27].map((dx) => ({ x: TP_EXT_W / 2 + dx, y: TP_EXT_H - 30 })),
  rose: { x: TP_EXT_W / 2, y: TP_EXT_H - 74 },
  crystal: { x: TP_EXT_W / 2, y: 70 },
};
const SPIRE = TEMPLE_GLOWS.crystal;
const VERDIGRIS: Material = { ramp: ramp('#0e2624', '#16392f', '#1f4e3c', '#2b6649', '#3c8158', '#56a06a', '#7cc081'), outline: hex('#061210'), outlineLit: hex('#1a3a30') };
const ROSE_GLASS: Material = { ramp: ramp('#3a0c2a', '#6a1a48', '#a02a66', '#e0508a', '#ff9ac0'), outline: hex('#1a0412'), emissive: 0.6, noAO: true };
const LICHEN: Material = { ramp: ramp('#4a4a2a', '#6a6a38', '#8e8a4a', '#b0aa62'), outline: hex('#1a1a0e') };

/** The temple's hall and the steps before it, painted in one piece: TP_W x TP_TEX_H. Below the front wall's foot, only the steps are painted. */
export function templeHall(): SanctumArt {
  const W = TP_W;
  const H = TP_TEX_H;
  const N = W * H;
  const diffuse = new Uint8ClampedArray(N * 4);
  const normal = new Uint8ClampedArray(N * 4);
  const emissive = new Uint8ClampedArray(N * 4);
  const L = KEY_LIGHT;
  const Ll = Math.hypot(L.x, L.y, L.z);
  const put = (x: number, y: number, c: RGB, n: N3, glow?: RGB, gk = 0) => {
    const o = (y * W + x) * 4;
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
  const cx = W / 2;
  const doorL = cx - T_DOOR_HW;
  const doorR = cx + T_DOOR_HW;
  const hgt = T_FLOOR - T_CAP;
  const Wn = T_WINDOW;
  /** How much the braziers' fire lights a pixel of the wall or floor near them. */
  const fireLit = (x: number, y: number, rx: number, ry: number) => {
    let k = 0;
    for (const b of T_BRAZIERS) k = Math.max(k, 1 - Math.hypot((x + 0.5 - b.x) / rx, (y + 0.5 - (b.y - 10)) / ry));
    return Math.max(0, k);
  };

  /** The north wall's face. */
  const wallFace = (x: number, y: number) => {
    const yy = y - T_CAP;
    // The rose window: a moulded stone ring, a gold one inside it, and glass in lead.
    const wd = Math.hypot(x + 0.5 - Wn.x, y + 0.5 - Wn.y);
    if (wd < Wn.r + 3) {
      if (wd >= Wn.r) {
        const n: N3 = [((x + 0.5 - Wn.x) / wd) * 0.6, (-(y + 0.5 - Wn.y) / wd) * 0.6, 0.8];
        put(x, y, pick(WALL, 5 + shadeOf(n) * 2 + (wd > Wn.r + 2 ? -1 : 0)), n);
      } else if (wd >= Wn.r - 1.2) put(x, y, pick(GOLDS, 3), FACE, GOLDEN, 0.25);
      else {
        const a = Math.atan2(y + 0.5 - Wn.y, x + 0.5 - Wn.x) + Math.PI;
        const seg = (a / (Math.PI * 2)) * 12;
        const lead = Math.abs(seg - Math.round(seg)) * (wd * 0.52) < 0.5 && wd > 5;
        const ring = Math.abs(wd - 5) < 0.6 || Math.abs(wd - 11) < 0.6;
        if (lead || ring) put(x, y, INK_R, FACE);
        else {
          const petal = Math.floor(seg) % 2;
          const g = wd < 5 ? GLASS.gold : wd < 11 ? (petal ? GLASS.violet : GLASS.rose) : petal ? GLASS.blue : GLASS.teal;
          const shine = 0.75 + fbm(x, y, 3, 1301, 2) * 0.5;
          put(x, y, mix(INK_R, g, 0.55), FACE, g, shine * (wd < 5 ? 1 : 0.85));
        }
      }
      return;
    }
    // Two lancets either side of it, a stone sill under each.
    for (const lx of T_LANCETS) {
      const dx = x + 0.5 - lx;
      const top = 10;
      const bot = 44;
      if (Math.abs(dx) < 5.5 && (yy === bot || yy === bot + 1)) {
        put(x, y, pick(WALL, yy === bot ? 6 : 2), yy === bot ? [0, 0.5, 0.86] : FACE);
        return;
      }
      const inside = Math.abs(dx) < 4.5 && yy >= top && yy < bot && (yy >= top + 4.5 || Math.hypot(dx, yy - (top + 4.5)) < 4.5);
      if (!inside) continue;
      const lead = Math.abs(dx) < 0.5 || yy === top + 13 || yy === top + 24;
      const edge = Math.abs(dx) > 3.5 || (yy < top + 4.5 && Math.hypot(dx, yy - (top + 4.5)) > 3.5);
      if (edge) put(x, y, pick(GOLDS, 2), FACE, GOLDEN, 0.15);
      else if (lead) put(x, y, INK_R, FACE);
      else {
        const k = (yy - top) / (bot - top);
        const g = mix(GLASS.violet, GLASS.blue, k);
        put(x, y, mix(INK_R, g, 0.5), FACE, g, 0.75 - k * 0.25);
      }
      return;
    }
    // The keepers' banners, on gold rods: violet for Nyx, crimson for Tharn, each with their sigil.
    for (const id of ['disenchant', 'upgrade'] as const) {
      const dx = x + 0.5 - T_BANNERS[id];
      if (yy >= 4 && yy <= 5 && Math.abs(dx) < 11) {
        put(x, y, pick(GOLDS, yy === 4 ? 4 : 2), FACE);
        return;
      }
      const point = 40 + (9 - Math.abs(dx)) * 0.6;
      if (Math.abs(dx) < 9 && yy > 5 && yy < point) {
        const cloth = id === 'disenchant' ? CLOTH_VIOLET : RUNNER;
        if (Math.abs(dx) > 7.8 || yy > point - 1.5) put(x, y, pick(GOLDS, 3), FACE);
        else {
          const sy = yy - 21;
          const sigil =
            id === 'disenchant'
              ? Math.abs(dx) + Math.abs(sy) * 0.7 < 4.2 && Math.abs(dx) + Math.abs(sy) * 0.7 > 2.4
              : (sy >= -3 && sy <= -1 && Math.abs(dx) < 5) || (sy >= 0 && sy <= 3 && Math.abs(dx) < 2) || (sy === 4 && Math.abs(dx) < 4);
          if (sigil) put(x, y, pick(GOLDS, 4), FACE, KEEPER_RGB[id], 0.6);
          else put(x, y, pick(cloth, 2.4 + Math.sin(dx * 1.1) * 0.8 + (yy < 8 ? -0.6 : 0)), FACE);
        }
        return;
      }
    }
    const warm = fireLit(x, y, 26, 22);
    // Pilasters between the windows, gold at the top.
    const pil = [48, 76, 132, 160].find((p) => Math.abs(x + 0.5 - p) < 4.5);
    if (pil !== undefined && yy >= 2 && yy < hgt - 3) {
      const t = (x + 0.5 - pil) / 4.5;
      const n: N3 = [t * 0.7, -0.35, 0.75];
      if (yy < 6) put(x, y, pick(GOLDS, 3 + shadeOf(n) * 1.5), n, GOLDEN, 0.1);
      else if (yy >= hgt - 6) put(x, y, pick(WALL, 5 + shadeOf(n) * 1.5 - (yy - hgt + 6) * 0.5), n);
      else put(x, y, pick(WALL, 4.2 + shadeOf(n) * 2.4 + (Math.round(t * 3) % 2 ? -0.4 : 0) + warm * 0.8), n, WARM, warm * warm * 0.06);
      return;
    }
    // The rune band near the foot of the wall.
    if (yy >= hgt - 12 && yy <= hgt - 6) {
      if (yy === hgt - 12 || yy === hgt - 6) {
        put(x, y, pick(WALL, yy === hgt - 12 ? 5 : 2), yy === hgt - 12 ? [0, 0.4, 0.9] : FACE);
        return;
      }
      const gx = Math.floor(x / 7);
      const lx = x % 7;
      const glyph = lx > 0 && lx < 6 && hash2(gx, yy, 1311) > 0.45 && hash2(gx, lx, 1313) > 0.3;
      if (glyph) put(x, y, mix(pick(WALL, 1), VIOLET, 0.5), FACE, VIOLET, 0.55);
      else put(x, y, pick(WALL, 1), FACE);
      return;
    }
    // The moulding along the top, then courses of cut marble, darker toward the floor, warm where the braziers reach.
    if (yy < 3) {
      put(x, y, pick(WALL, yy < 1 ? 6 : 2), yy < 1 ? [0, 0.5, 0.86] : FACE);
      return;
    }
    const row = Math.floor((yy - 3) / 8);
    const off = row % 2 ? 11 : 0;
    const lx = (x + off) % 22;
    const ly = (yy - 3) % 8;
    if (ly === 7 || lx === 0) {
      put(x, y, pick(WALL, 1 + warm * 0.6), FACE);
      return;
    }
    let n = FACE;
    let idx = 3.3 + (hash2(Math.floor((x + off) / 22), row, 1317) - 0.5) * 1.2 + (fbm(x, y, 6, 1319, 2) - 0.5) * 0.8;
    if (ly === 0) {
      n = [0, 0.3, 0.95];
      idx += 0.8;
    }
    if (yy > hgt - 5) idx -= 1.4;
    put(x, y, pick(WALL, idx + shadeOf(n) * 0.6 + warm * 1.1), n, WARM, warm * warm * 0.07);
  };

  /** The floor, and the doorway through the south wall. */
  const floor = (x: number, y: number, inDoor: boolean) => {
    const fy = y - T_FLOOR;
    const cu = (x + 0.5 - T_CIRCLE.x) / T_CIRCLE.rx;
    const cv = (y + 0.5 - T_CIRCLE.y) / T_CIRCLE.ry;
    const cr = Math.hypot(cu, cv);
    // The crimson runner, from the door to the circle.
    const rl = doorL + 3;
    const rr = doorR - 3;
    if (x >= rl && x < rr && y >= T_CIRCLE.y + T_CIRCLE.ry * 0.95 && cr >= 0.97) {
      const edge = x === rl || x === rr - 1;
      const inner = x === rl + 2 || x === rr - 3;
      if (inDoor) {
        // Over the threshold, the daylight spilling in on it.
        const k = (y - T_FRONT) / (TP_H - T_FRONT);
        if (y === T_FRONT) put(x, y, pick(GOLDS, edge ? 4 : 3), [0, 0.5, 0.86], GOLDEN, 0.1);
        else put(x, y, edge ? pick(GOLDS, 3) : pick(RUNNER, 2.6 + k * 1.2 + (inner ? -1 : 0)), UP, PALE, k * k * 0.3);
        return;
      }
      if (edge) put(x, y, pick(GOLDS, 3), UP, GOLDEN, 0.08);
      else if (inner) put(x, y, pick(RUNNER, 1), UP);
      else {
        const d = Math.abs((x - cx) % 6) + Math.abs((y % 6) - 3);
        put(x, y, pick(RUNNER, 3 + (d === 3 ? 1 : 0) + (fbm(x, y, 4, 1331, 2) - 0.5) * 0.8), UP);
      }
      return;
    }
    if (inDoor) {
      // The sill, gold-edged jambs, and the light from outside.
      const jamb = x < doorL + 2 || x >= doorR - 2;
      const k = (y - T_FRONT) / (TP_H - T_FRONT);
      if (y === T_FRONT) put(x, y, pick(DAIS_ST, 5), [0, 0.5, 0.86]);
      else put(x, y, jamb ? pick(GOLDS, 2) : pick(DAIS_ST, 3 + k), UP, PALE, k * k * 0.3);
      return;
    }
    // The keepers' daises: a step up, a ring in their colour, runes round it.
    for (const id of ['disenchant', 'upgrade'] as const) {
      const d = T_DAIS[id];
      const du = (x + 0.5 - d.x) / d.rx;
      const dv = (y + 0.5 - d.y) / d.ry;
      const r = Math.hypot(du, dv);
      if (r >= 1) continue;
      const glow = KEEPER_RGB[id];
      if (r > 0.9 && dv > 0) put(x, y, pick(DAIS_ST, 1.5), FACE);
      else if (r > 0.9) put(x, y, pick(DAIS_ST, 5), [du * 0.4, -dv * 0.4, 0.8]);
      else if (r > 0.8 && r < 0.86) put(x, y, mix(pick(DAIS_ST, 2), glow, 0.55), UP, glow, 0.5);
      else {
        const a = Math.atan2(dv, du);
        const ringLine = Math.abs(((r * 4) % 1) - 0.5) > 0.44;
        const spoke = Math.abs((((a / (Math.PI * 2)) * 16 + 16) % 1) - 0.5) > 0.46 && r > 0.3;
        let idx = 3.6 - r * 0.8 + (fbm(x, y, 5, 1341, 2) - 0.5) * 0.6;
        if (ringLine || spoke) idx -= 1.2;
        const rune = r > 0.66 && r < 0.76 && hash2(Math.floor(((a + Math.PI) / (Math.PI * 2)) * 24), 0, id === 'disenchant' ? 1343 : 1347) > 0.35;
        if (rune) put(x, y, mix(pick(DAIS_ST, 2), glow, 0.4), UP, glow, 0.3);
        else put(x, y, pick(DAIS_ST, idx), UP, glow, Math.max(0, 0.25 - r * 0.3));
      }
      return;
    }

    // Polished stone on the diagonal: diamonds in two shades, bevelled, pale
    // veins, a fine inlaid line in every other one and a gold star where four corners meet.
    const dp = (x + 0.5 - cx) / 20 + (fy + 0.5) / 14;
    const dq = (x + 0.5 - cx) / 20 - (fy + 0.5) / 14;
    const ip = Math.floor(dp);
    const iq = Math.floor(dq);
    const fp = dp - ip;
    const fq = dq - iq;
    const odd = (ip + iq) & 1;
    const base = odd ? TILE_A : TILE_B;
    const ep = Math.min(fp, 1 - fp);
    const eq = Math.min(fq, 1 - fq);
    let n: N3 = UP;
    let idx = 3.2 + (hash2(ip, iq, 1351) - 0.5) * 0.7;
    let glow: RGB | undefined;
    let gk = 0;
    const gold = ep + eq < 0.1;
    const grout = !gold && (ep < 0.035 || eq < 0.035);
    if (!gold && !grout) {
      if (fp < 0.08) {
        n = [-0.25, 0.3, 0.9];
        idx += 0.7;
      } else if (fp > 0.93) {
        n = [0.25, -0.3, 0.9];
        idx -= 0.6;
      } else if (fq < 0.08) {
        n = [-0.25, -0.3, 0.9];
        idx += 0.3;
      } else if (fq > 0.93) {
        n = [0.25, 0.3, 0.9];
        idx -= 0.3;
      }
      if (!odd && Math.abs(Math.max(Math.abs(fp - 0.5), Math.abs(fq - 0.5)) - 0.27) < 0.02) {
        idx += 1;
        glow = GOLDEN;
        gk = 0.03;
      }
    }
    const vein = Math.abs(fbm(x, y * 1.3, 18, 1353, 3) - 0.5);
    if (vein < 0.012) idx += 1.6;
    else if (vein < 0.024) idx += 0.6;
    // The rose window's light pooling down the floor, the braziers' warmth, and shade at the walls' feet.
    const pool = Math.exp(-(((x - Wn.x) / 46) ** 2) - (fy / 66) ** 2);
    idx += pool * 1.6;
    const warm = fireLit(x, y, 30, 16);
    idx += warm * 0.8;
    if (fy < 7) idx -= (7 - fy) / 2.8;
    const side = Math.min(x - T_SIDE, W - T_SIDE - 1 - x, T_FRONT - 1 - y);
    if (side < 9) idx -= (9 - side) / 4.5;
    if (pool > 0.1 && !glow) {
      glow = mix(GLASS.violet, GLASS.blue, 0.5);
      gk = pool * 0.12 * (0.7 + hash2(x >> 1, y >> 1, 1355) * 0.3);
    }

    // The rune circle: a gold ring, a band of runes, a violet ring, and a rosette of twelve petals in two layers.
    if (cr < 1) {
      if (cr > 0.94) {
        put(x, y, pick(GOLDS, 3 + (cr > 0.97 ? -1 : 0.5)), UP, GOLDEN, 0.3);
        return;
      }
      if (cr > 0.8 && cr < 0.84) {
        put(x, y, mix(pick(TILE_A, 2), VIOLET, 0.55), UP, VIOLET, 0.55);
        return;
      }
      if (cr >= 0.84) {
        const a = Math.atan2(cv, cu) + Math.PI;
        const cell = Math.floor((a / (Math.PI * 2)) * 30);
        const k = ((a / (Math.PI * 2)) * 30) % 1;
        const glyph = k > 0.15 && k < 0.85 && hash2(cell, Math.floor((cr - 0.84) * 50), 1357) > 0.4;
        if (glyph) put(x, y, mix(pick(TILE_A, 2), VIOLET, 0.4), UP, VIOLET, 0.4);
        else put(x, y, pick(TILE_A, 1.5), UP);
        return;
      }
      const r = cr / 0.8;
      const a = Math.atan2(cv, cu);
      const co = Math.abs(Math.cos(6 * a));
      const si = Math.abs(Math.sin(6 * a));
      const outer = 0.97 * (0.46 + 0.54 * co ** 0.7);
      const inner = 0.66 * (0.5 + 0.5 * si ** 0.7);
      const lw = 0.05;
      const shine = 0.5 + pool * 0.2;
      if (r < 0.14) {
        // The boss in the middle: a domed gold stud.
        const nn: N3 = [cu * 3, -cv * 3, 0.8];
        put(x, y, pick(GOLDS, 3 + shadeOf(nn) * 1.5), nn, GOLDEN, 0.5);
      } else if (r < 0.21) put(x, y, r < 0.17 ? pick(TILE_A, 1) : pick(GOLDS, 3), UP, GOLDEN, r < 0.17 ? 0 : 0.35);
      else if (Math.abs(r - inner) < lw || Math.abs(r - outer) < lw) put(x, y, pick(GOLDS, 2.6 + (r < inner ? 0.6 : 0)), UP, GOLDEN, 0.16);
      else if (r < inner) {
        const rib = co < 0.07 && r > 0.26;
        put(x, y, mix(pick(PETAL_R, 2 + (inner - r) * 3 + (rib ? 1.4 : 0)), PALE, rib ? 0.15 : 0), UP, GLASS.rose, (0.1 + (rib ? 0.12 : 0)) * shine);
      } else if (r < outer) {
        const rib = si < 0.07;
        put(x, y, pick(PETAL_V, 2.8 - (r - inner) * 2.6 + (rib ? 1.3 : 0)), UP, VIOLET, (0.1 + (rib ? 0.14 : 0)) * shine);
      } else {
        const fleck = hash2(x, y, 1359) > 0.96;
        put(x, y, fleck ? mix(pick(TILE_A, 2), PALE, 0.6) : pick(TILE_A, 1.2), UP, fleck ? PALE : VIOLET, fleck ? 0.5 : 0.05);
      }
      return;
    }
    if (gold) {
      put(x, y, pick(GOLDS, ep + eq < 0.05 ? 3.6 : 2.4), UP, GOLDEN, 0.1);
      return;
    }
    if (grout) {
      put(x, y, pick(base, 0.2 + pool * 0.6 + warm * 0.4), UP);
      return;
    }
    const c = pick(base, idx + shadeOf(n) * 0.5);
    put(x, y, warm > 0 ? mix(c, [120, 64, 30], warm * 0.2) : c, n, glow ?? WARM, glow ? gk : warm * warm * 0.05);
  };

  /** The walls' tops all round: cut stone, their inner edges catching the light, gold jambs either side of the door. */
  const caps = (x: number, y: number) => {
    const inX = x >= T_SIDE && x < W - T_SIDE;
    const jamb = y >= T_FRONT && (x === doorL - 1 || x === doorR);
    if (jamb) {
      put(x, y, pick(GOLDS, 3), UP, GOLDEN, 0.15);
      return;
    }
    const inner = (x === T_SIDE - 1 && y >= T_CAP) || (x === W - T_SIDE && y >= T_CAP) || (y === T_CAP - 1 && inX) || (y === T_FRONT && inX);
    const outer = x === 0 || x === W - 1 || y === 0 || y === TP_H - 1;
    const bx = Math.floor(x / 12);
    const by = Math.floor(y / 8);
    let idx = 2.6 + (hash2(bx, by, 1361) - 0.5) * 0.9 + (fbm(x, y, 5, 1363, 2) - 0.5) * 0.6;
    if (x % 12 === 0 || y % 8 === 0) idx -= 1;
    if (inner) idx += 2.2;
    if (outer) idx = 0;
    put(x, y, pick(CAPS, idx), UP);
  };

  /** The two broad steps of fieldstone down from the door: each a lit tread and a riser in shade, moss in their joints, worn pale in the middle. */
  const steps = (x: number, y: number) => {
    const sy = y - TP_H;
    const k = sy < 8 ? 0 : 1;
    const hw = T_STEP_HW[k];
    const dx = x + 0.5 - cx;
    if (Math.abs(dx) >= hw) return;
    const ly = sy % 8;
    const tread = ly < 4;
    const off = k ? 6 : 0;
    const joint = (x + off) % 13 === 0;
    const block = Math.floor((x + off) / 13);
    const endFace = Math.abs(dx) > hw - 1.5;
    let idx: number;
    let n: N3;
    if (tread) {
      n = ly === 0 ? [0, 0.55, 0.84] : [0, 0.25, 0.97];
      idx = 4.4 + (ly === 0 ? 1 : 0) + (hash2(block, k, 1371) - 0.5) * 1.2 + (fbm(x, y, 4, 1373, 2) - 0.5) * 0.8;
      if (Math.abs(dx) < 13) idx += 0.6;
    } else {
      n = FACE;
      idx = 2.4 - (ly - 4) * 0.35 + (hash2(block, k + 3, 1371) - 0.5) * 1;
      if (ly === 7) idx = 0.6;
    }
    if (joint) idx -= 2;
    if (endFace) {
      n = [Math.sign(dx) * 0.7, 0, 0.7];
      idx -= 1;
    }
    // Moss creeps in along the joints and the steps' ends.
    const mossy = fbm(x, y, 5, 1375, 2) > 0.62 && (joint || endFace || (tread && ly === 3));
    if (mossy) {
      put(x, y, pick(MOSS, 2.4 + (tread ? 1 : 0) + hash2(x, y, 1377) * 0.8), n);
      return;
    }
    // The hall's lamplight falls warm on the upper step through the door.
    const spill = k === 0 && tread ? Math.max(0, 1 - Math.abs(dx) / 16) * (1 - ly / 4) : 0;
    put(x, y, pick(STEPS, idx + shadeOf(n) * 0.6), n, [255, 190, 110], spill * 0.22);
  };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (y >= TP_H) {
        steps(x, y);
        continue;
      }
      const inX = x >= T_SIDE && x < W - T_SIDE;
      if (inX && y >= T_CAP && y < T_FLOOR) wallFace(x, y);
      else if (inX && y >= T_FLOOR && y < T_FRONT) floor(x, y, false);
      else if (x >= doorL && x < doorR && y >= T_FRONT) floor(x, y, true);
      else caps(x, y);
    }
  }

  // A candelabrum in each back corner, drawn as a sprite and laid over the paint.
  const props = new PixelCanvas(W, H);
  candelabrum(props, T_SIDE + 8, T_FLOOR + 8);
  candelabrum(props, W - T_SIDE - 9, T_FLOOR + 8);
  const r = props.render();
  for (let i = 0; i < N; i++) {
    const o = i * 4;
    if (r.diffuse[o + 3]) {
      for (let k = 0; k < 4; k++) {
        diffuse[o + k] = r.diffuse[o + k];
        normal[o + k] = r.normal[o + k];
      }
    }
    if (r.emissive[o + 3]) {
      for (let k = 0; k < 3; k++) emissive[o + k] = Math.min(255, emissive[o + k] + r.emissive[o + k]);
      emissive[o + 3] = 255;
    }
  }
  return { diffuse, normal, emissive };
}

/** A tall iron candelabrum standing on the floor at (x, y): three-footed, three arms, a candle burning on each. */
function candelabrum(c: PixelCanvas, x: number, y: number): void {
  const iron = (i: number, n: number) => cyl(n > 0 ? (i / n) * 2 - 1 : 0, 0.2);
  c.part();
  c.ellipse(x, y - 0.5, 4, 1.4, IRON, { flatten: 0.5, bias: -1 });
  c.part();
  for (const dx of [-3, 3]) c.line(x, y - 3, x + dx, y, IRON, () => ({ x: dx * 0.15, y: 0.2, z: 0.9 }));
  c.line(x, y - 18, x, y - 2, IRON, () => cyl(-0.3), { bias: 1 });
  c.ellipse(x, y - 9, 1.3, 1, IRON, { bias: 1 });
  c.part();
  c.line(x - 5, y - 18, x + 5, y - 18, IRON, iron, { bias: 1 });
  for (const dx of [-5, 5]) c.line(x + dx, y - 20, x + dx, y - 18, IRON, () => cyl(0), { bias: 1 });
  for (const [dx, h] of [
    [-5, 4],
    [0, 6],
    [5, 4],
  ] as [number, number][]) {
    const base = dx === 0 ? y - 18 : y - 20;
    c.part();
    c.shape(base - h, base - 1, () => [x + dx - 0.5, x + dx + 1.5], WAX, (_x, yy, t) => (yy === base - h ? { x: t * 0.2, y: 0.7, z: 0.7 } : cyl(t, 0.1)));
    c.part();
    c.px(x + dx, base - h - 1, FLAME, { x: 0, y: 0, z: 1 }, { bias: 1 });
    c.px(x + dx, base - h - 2, FLAME, { x: 0, y: 0, z: 1 }, { bias: 3 });
    c.spark(x + dx, base - h - 1, [255, 190, 110], 0.7);
    c.spark(x + dx - 1, base - h - 1, [255, 150, 70], 0.25);
    c.spark(x + dx + 1, base - h - 1, [255, 150, 70], 0.25);
  }
}

// ---------------------------------------------------------------- Outside

/**
 * The temple from outside: TP_EXT_W x TP_EXT_H, bottom row at the front
 * wall's foot. Its roof covers the whole hall, so it hides everything inside
 * until the hero walks in and it fades away.
 */
export function templeExterior(): PixelCanvas {
  const W = TP_EXT_W;
  const H = TP_EXT_H;
  const c = new PixelCanvas(W, H);
  const cx = W / 2;
  /** The front wall's top (it stands 60 px, as the hall's walls do), and the front gable's peak over it. */
  const eaves = H - (T_FLOOR - T_CAP);
  const pitch = 36;
  const apex = eaves - pitch;
  const wl = 6;
  const wr = W - 6;
  const wallN: Vec3 = { x: 0, y: -0.45, z: 0.88 };
  const top = (t = 0): Vec3 => ({ x: t * 0.2, y: 0.75, z: 0.65 });
  const front = (t: number): Vec3 => ({ x: t * 0.35, y: -0.4, z: 0.85 });
  /** The front gable's half-width at row y. */
  const gHw = (y: number) => ((y - apex) / pitch) * (W / 2 - wl);
  /** The back gable's edge against the sky: its peak rising over the back wall. */
  const backEdge = (x: number) => TP_EXT_RISE - 34 * (1 - Math.abs(x + 0.5 - cx) / (W / 2));

  /** Rough-cut fieldstone courses, each block its own tone, mortar dark, moss in the joints low down. */
  const masonry = (x0: number, x1: number, y0: number, y1: number, rowH: number, seed: number, keep?: (x: number, y: number) => boolean, bias = 0) => {
    for (let y = y0; y < y1; y++) {
      const row = Math.floor((y - y0) / rowH);
      const ly = (y - y0) % rowH;
      const off = Math.floor(hash2(row, 0, seed) * 14);
      for (let x = x0; x < x1; x++) {
        if (keep && !keep(x, y)) continue;
        const bw = 10 + Math.floor(hash2(Math.floor((x + off) / 12), row, seed + 1) * 3) * 2;
        const lx = (x + off) % bw;
        const block = hash2(Math.floor((x + off) / bw), row, seed + 2);
        let b = bias + Math.round((block - 0.5) * 2.2 + (fbm(x, y, 5, seed + 3, 2) - 0.5) * 1.2);
        if (ly === rowH - 1 || lx === 0) b = -3;
        else if (ly === 0) b += 1;
        const mossy = fbm(x, y, 9, seed + 4, 2) > 0.66 && (ly === rowH - 1 || lx === 0 || y > H - 10);
        if (mossy) c.px(x, y, BUSH, wallN, { bias: -1 });
        else c.px(x, y, FIELDSTONE, wallN, { bias: b });
      }
    }
  };

  // ---- The roof: its ridge runs back from the door, slate falling away to either side in courses, moss over it.
  c.part();
  for (let y = 0; y <= eaves + 2; y++) {
    for (let x = 0; x < W; x++) {
      if (y < backEdge(x)) continue;
      const dx = x + 0.5 - cx;
      const d = Math.abs(dx);
      // The front gable stands before the roof; past the walls the eaves hang a little lower.
      if (y >= apex && d < gHw(y)) continue;
      if (y > eaves && x >= wl && x < wr) continue;
      const side = dx < 0 ? -1 : 1;
      const n: Vec3 = { x: side * 0.55, y: 0.12, z: 0.83 };
      const course = Math.floor(d / 7);
      const lc = d % 7;
      const off = course % 2 ? 5 : 0;
      const ly = (y + off) % 10;
      const fromBack = y - backEdge(x);
      // Moss gathers low on the slopes, toward the eaves, and thicker on the shaded east slope.
      const moss = fbm(x, y, 9, 1401, 3) + (d / (W / 2)) * 0.24 + (side > 0 ? 0.04 : 0) - 0.1;
      if (moss > 0.68 && fromBack > 2) {
        c.px(x, y, ROOF_MOSS, n, { bias: Math.round((fbm(x, y, 3, 1403, 2) - 0.5) * 2) - 1 + (lc > 6 ? -1 : 0) });
        continue;
      }
      let bias = Math.round((hash2(course, Math.floor((y + off) / 10) * side, 1405) - 0.5) * 2);
      if (lc > 6) bias = -2;
      else if (lc < 1) bias += 1;
      if (ly === 0) bias -= 1;
      // Lighter up by the ridge; the back gable's rim and the eaves' edge dark.
      if (d < 10) bias += 1;
      if (fromBack < 1) bias -= 2;
      else if (fromBack < 2) bias += 1;
      if (x < 2 || x > W - 3 || y > eaves) bias -= 2;
      // Now and then a newer slate, paler, or a patch of lichen.
      if (hash2(course, Math.floor((y + off) / 10), 1407) > 0.93) bias += 1;
      if (hash2(x, y, 1409) > 0.997) {
        c.px(x, y, LICHEN, n, { bias: 0 });
        continue;
      }
      c.px(x, y, ROOF_SLATE, n, { bias });
    }
  }
  // Grass tufts along the eaves, and the ridge's stone cap from the back gable to the front.
  for (let y = TP_EXT_RISE; y < eaves; y++) for (const x of [1, W - 2]) if (hash2(x, y, 1411) > 0.72) c.px(x, y, ROOF_MOSS, { x: x < cx ? -0.5 : 0.5, y: 0, z: 0.85 }, { bias: 2 });
  c.part();
  for (let y = backEdge(cx) + 2; y < apex; y++) {
    const joint = (y - backEdge(cx)) % 5 === 4;
    for (let x = cx - 3; x < cx + 3; x++) {
      const t = (x + 0.5 - cx) / 3;
      const mossy = fbm(x, y, 6, 1415, 2) > 0.64;
      if (mossy) c.px(x, y, ROOF_MOSS, { x: t * 0.6, y: 0.2, z: 0.8 }, { bias: 1 });
      else c.px(x, y, FIELDSTONE, { x: t * 0.7, y: 0.15, z: 0.7 }, { bias: joint ? -2 : Math.abs(t) > 0.8 ? -1 : 1 });
    }
  }
  // A carved knob at the back gable's peak.
  c.part();
  c.ellipse(cx, backEdge(cx) + 1, 2.8, 2.6, FIELDSTONE, { bias: 2 });

  // ---- The rune lantern astride the ridge: a small stone tower, a rune crystal burning in its open arch, under a slate spire.
  const tx = cx;
  const tTop = SPIRE.y - 15;
  const tBase = tTop + 32;
  const thw = 9;
  // Its shadow across the east slope.
  for (let y = tTop - 4; y < tBase + 8; y++) for (let x = tx + thw; x < tx + thw + 16; x++) c.shade(x, y, x < tx + thw + 7 ? -2 : -1);
  c.part();
  masonry(tx - thw, tx + thw, tTop + 3, tBase, 5, 1417);
  for (let y = tTop + 3; y < tBase; y++) {
    c.shade(tx - thw, y, 2);
    c.shade(tx + thw - 1, y, -2);
    c.shade(tx + thw - 2, y, -1);
  }
  // Flashing where it sits on the slates.
  c.part();
  c.shape(tBase, tBase + 1, () => [tx - thw - 1, tx + thw + 1], FIELDSTONE, (_x, y, t) => (y === tBase ? top(t) : front(t)), { bias: -1 });
  // The open arch, dark but for the crystal hanging in it.
  const aSpring = tTop + 11;
  const inTowerArch = (x: number, y: number, r: number) => (y >= aSpring ? Math.abs(x + 0.5 - tx) < r && y < tBase - 5 : Math.hypot(x + 0.5 - tx, y + 0.5 - aSpring) < r);
  c.part();
  for (let y = tTop + 3; y < tBase - 3; y++) {
    for (let x = tx - 7; x < tx + 7; x++) {
      if (!inTowerArch(x, y, 6)) continue;
      if (!inTowerArch(x, y, 4)) c.px(x, y, FIELDSTONE, wallN, { bias: y >= tBase - 5 ? 2 : 3 });
      else c.px(x, y, IRON, { x: 0, y: 0, z: 1 }, { bias: -4 });
    }
  }
  c.part();
  c.shape(SPIRE.y - 6, SPIRE.y + 6, (y) => {
    const hw = y < SPIRE.y - 1 ? ((y - (SPIRE.y - 6.5)) / 5.5) * 2.6 : ((SPIRE.y + 6.5 - y) / 7.5) * 2.6;
    return hw > 0.3 ? [tx - hw, tx + hw] : null;
  }, RUNE_GLASS, (x, y, t) => ({ x: (x + 0.5 < tx ? -0.6 : 0.6) + t * 0.1, y: y < SPIRE.y - 1 ? 0.45 : -0.2, z: 0.65 }), { glow: 0.9 });
  c.spark(tx, SPIRE.y, [230, 210, 255], 0.8);
  c.spark(tx - 1, SPIRE.y + 1, [200, 170, 255], 0.4);
  // A moulded cornice, then the spire: slate in courses, lit on its west face, a finial with a rune point.
  c.part();
  c.shape(tTop, tTop + 2, () => [tx - thw - 1, tx + thw + 1], FIELDSTONE, (_x, y, t) => (y === tTop ? top(t * 0.3) : front(t * 0.3)), { bias: 2 });
  const sTop = tTop - 30;
  c.part();
  c.shape(sTop, tTop - 1, (y) => {
    const hw = ((y + 0.5 - sTop) / (tTop - sTop)) * (thw + 2);
    return hw > 0.4 ? [tx - hw, tx + hw] : null;
  }, VERDIGRIS, (x, _y) => (x + 0.5 < tx ? { x: -0.62, y: 0.3, z: 0.72 } : { x: 0.62, y: 0.3, z: 0.72 }), {});
  for (let y = sTop + 3; y < tTop - 1; y++) {
    const hw = ((y + 0.5 - sTop) / (tTop - sTop)) * (thw + 2);
    for (let x = Math.round(tx - hw); x < Math.round(tx + hw); x++) {
      if ((y - sTop) % 4 === 3) c.shade(x, y, -1);
      if (Math.abs(x + 0.5 - tx) < 0.6) c.shade(x, y, 1);
      // Streaks where the copper has weathered darker.
      if (fbm(x * 3, y * 0.5, 5, 1419, 2) > 0.66) c.shade(x, y, -1);
    }
  }
  c.part();
  c.line(tx, sTop - 4, tx, sTop, VERDIGRIS, () => ({ x: -0.4, y: 0, z: 0.9 }), { bias: 2 });
  c.px(tx, sTop - 5, RUNE_GLASS, { x: 0, y: 0.3, z: 0.9 }, { glow: 1 });
  c.spark(tx, sTop - 5, [230, 210, 255], 0.6);

  // ---- The front gable: stone under slate bargeboards, a rose of rune glass.
  c.part();
  masonry(wl, wr, apex + 2, eaves + 1, 7, 1421, (x, y) => Math.abs(x + 0.5 - cx) < gHw(y) - 2);
  c.part();
  for (let y = apex; y <= eaves; y++) {
    const hw = gHw(y);
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) c.px(cx + sx * (hw - k) - (sx > 0 ? 1 : 0), y, ROOF_SLATE, { x: sx * 0.4, y: 0.4, z: 0.8 }, { bias: k === 0 ? -1 : 1 });
  }
  // The kneelers at the gable's feet.
  for (const x0 of [wl - 2, wr - 5]) {
    c.part();
    c.shape(eaves - 3, eaves + 1, () => [x0, x0 + 7], FIELDSTONE, (_x, y, t) => (y < eaves - 1 ? top(t) : front(t)), { bias: 1 });
  }
  const ry = apex + 22;
  const rr = 10;
  c.part();
  for (let y = ry - rr; y <= ry + rr; y++) {
    for (let x = cx - rr; x <= cx + rr; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - ry);
      if (d > rr - 0.2) continue;
      if (d > 8) c.px(x, y, FIELDSTONE, sphere((x + 0.5 - cx) / rr, (y + 0.5 - ry) / rr, 0.6), { bias: 2 });
      else if (d > 7.2) c.px(x, y, OAK, wallN, { bias: -1 });
      else {
        const a = Math.atan2(y + 0.5 - ry, x + 0.5 - cx) + Math.PI;
        const seg = (a / (Math.PI * 2)) * 8;
        const lead = (Math.abs(seg - Math.round(seg)) * d < 0.5 && d > 2.6) || Math.abs(d - 2.6) < 0.5;
        const flat = { x: 0, y: 0, z: 1 };
        if (lead || Math.abs(d - 5.2) < 0.5) c.px(x, y, IRON, wallN, { bias: -1 });
        else if (d < 2.2) c.px(x, y, HEARTH, flat, { bias: 1, glow: 0.6 });
        else if (d < 5.2) c.px(x, y, Math.floor(seg) % 2 ? ROSE_GLASS : RUNE_GLASS, flat, { bias: 1 - Math.round((d - 2.2) / 2), glow: 0.45 });
        else c.px(x, y, Math.floor(seg + 0.5) % 2 ? RUNE_GLASS : ROSE_GLASS, flat, { bias: -1, glow: 0.35 });
      }
    }
  }

  // ---- A carved finial on the front gable's peak.
  c.part();
  c.shape(apex - 3, apex + 2, (y) => [cx - 1.5 - (y - apex + 3) * 0.5, cx + 1.5 + (y - apex + 3) * 0.5], FIELDSTONE, (_x, _y, t) => cyl(t, 0.2), { bias: 1 });
  c.part();
  c.ellipse(cx, apex - 5, 2.2, 2.2, FIELDSTONE, { bias: 2 });

  // ---- The front wall: fieldstone courses, a plinth of big dark blocks, a moulded string course under the eaves.
  c.part();
  masonry(wl, wr, eaves, H - 7, 7, 1431);
  c.part();
  masonry(wl, wr, H - 7, H, 7, 1433, undefined, -1);
  for (let x = wl; x < wr; x++) c.shade(x, H - 7, 2);
  c.part();
  c.shape(eaves + 1, eaves + 3, () => [wl, wr], FIELDSTONE, (_x, y, t) => (y === eaves + 1 ? top(t * 0.2) : front(t * 0.2)), { bias: 1 });
  for (let y = eaves; y < eaves + 3; y++) for (let x = wl; x < wr; x++) if (Math.abs(x + 0.5 - cx) >= gHw(eaves) - 3) c.shade(x, y, -1);
  // The eaves' shadow down the wall under the string course.
  for (let y = eaves + 4; y < eaves + 7; y++) for (let x = wl; x < wr; x++) c.shade(x, y, y < eaves + 5 ? -2 : -1);
  // A band of runes cut under the string course, glowing faintly violet.
  c.part();
  for (let y = eaves + 6; y < eaves + 12; y++) {
    for (let x = cx - 29; x < cx + 29; x++) {
      const edge = x === cx - 29 || x === cx + 28;
      if (y === eaves + 6) c.px(x, y, FIELDSTONE, front(0), { bias: -2 });
      else if (y === eaves + 11) c.px(x, y, FIELDSTONE, top(0), { bias: 2 });
      else c.px(x, y, FIELDSTONE, wallN, { bias: edge ? -1 : -2 });
    }
  }
  c.part();
  for (let k = 0; k < 9; k++) {
    const g = GLYPHS[Math.floor(hash2(k, 3, 1435) * GLYPHS.length)];
    const gx = cx - 27 + k * 6 + 1;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) if (g[j * 4 + i] === '1') c.px(gx + i, eaves + 7 + j, RUNE_GLASS, wallN, { bias: 1, glow: 0.5 });
  }

  // ---- The doorway: wedge stones round an arch with a rune on its keystone, a hood mould over it, oak doors open on the warm hall.
  const dr = T_DOOR_HW;
  const spring = H - 28;
  const inArch = (x: number, y: number, r: number) => (y >= spring ? Math.abs(x + 0.5 - cx) < r : Math.hypot(x + 0.5 - cx, y + 0.5 - spring) < r);
  c.part();
  for (let y = spring - dr - 5; y < H; y++) {
    for (let x = cx - dr - 5; x < cx + dr + 5; x++) {
      if (!inArch(x, y, dr + 4) || inArch(x, y, dr)) continue;
      const a = Math.atan2(y + 0.5 - spring, x + 0.5 - cx);
      const seam = y < spring ? Math.abs(((a / Math.PI) * 9) % 1) < 0.12 : (y - spring) % 7 === 6;
      const outer = !inArch(x, y, dr + 3);
      c.px(x, y, FIELDSTONE, outer ? top(0) : wallN, { bias: seam ? -2 : outer ? 3 : 2 });
    }
  }
  c.part();
  for (let y = spring - dr; y < H; y++) {
    for (let x = cx - dr; x < cx + dr; x++) {
      if (!inArch(x, y, dr)) continue;
      const side = Math.abs(x + 0.5 - cx);
      if (side > dr - 3) {
        // The open leaves: oak planks and iron straps, seen edge-on against the jambs.
        const strap = (y - spring) % 9 === 2 && y > spring - dr + 4;
        c.px(x, y, strap ? IRON : OAK, { x: x < cx ? 0.6 : -0.6, y: -0.2, z: 0.78 }, { bias: strap ? 1 : (x - (cx - dr)) % 2 === 0 ? 0 : -1 });
        continue;
      }
      doorway(c, x, y, side, (y - (spring - dr)) / (H - (spring - dr)), H - 1 - y);
    }
  }
  c.part();
  c.shape(spring - dr - 6, spring - dr - 1, () => [cx - 3, cx + 3], FIELDSTONE, (_x, y, t) => (y === spring - dr - 6 ? top(t) : cyl(t, 0.2)), { bias: 2 });
  c.part();
  c.px(cx, spring - dr - 5, RUNE_GLASS, wallN, { glow: 0.9 });
  c.px(cx - 1, spring - dr - 4, RUNE_GLASS, wallN, { glow: 0.7 });
  c.px(cx + 1, spring - dr - 4, RUNE_GLASS, wallN, { glow: 0.7 });
  c.px(cx, spring - dr - 3, RUNE_GLASS, wallN, { glow: 0.9 });

  // ---- Buttresses: a pair between the door and the lancets, and one at each corner, stepping in halfway up.
  const buttress = (x0: number, x1: number, y0: number, seed: number) => {
    const set = Math.round((y0 + H) / 2);
    c.part();
    masonry(x0, x1, y0 + 3, H, 6, seed, (x, y) => y >= set || (x > x0 && x < x1 - 1));
    for (let y = y0 + 3; y < H; y++) {
      const inset = y < set ? 1 : 0;
      c.shade(x0 + inset, y, 2);
      c.shade(x1 - 1 - inset, y, -2);
    }
    // Their sloping weatherings, at the top and at the set-off.
    c.part();
    c.shape(y0, y0 + 3, () => [x0 + 1, x1 - 1], FIELDSTONE, (_x, y, t) => (y < y0 + 2 ? top(t * 0.3) : front(t)), { bias: 2 });
    c.part();
    c.shape(set - 2, set, () => [x0, x1], FIELDSTONE, (_x, y, t) => (y < set ? top(t * 0.3) : front(t)), { bias: 2 });
  };
  buttress(cx - 41, cx - 31, eaves + 12, 1441);
  buttress(cx + 31, cx + 41, eaves + 12, 1443);
  buttress(wl, wl + 11, eaves + 5, 1445);
  buttress(wr - 11, wr, eaves + 5, 1447);

  // ---- Two lancets, pointed, lamplight behind their lower panes and rune glass in their heads; a flower box under each.
  for (const wx of [cx - 58, cx + 58]) {
    const a = 5;
    const springW = eaves + 22;
    const sill = H - 16;
    const inWin = (x: number, y: number, r: number) => {
      const dx = Math.abs(x + 0.5 - wx);
      if (y >= springW) return dx < r && y < sill;
      return Math.hypot(dx + r * 0.5, y + 0.5 - springW) < r * 1.5;
    };
    c.part();
    for (let y = springW - 12; y < sill; y++) {
      for (let x = wx - a - 3; x < wx + a + 3; x++) {
        if (!inWin(x, y, a + 2)) continue;
        if (!inWin(x, y, a)) {
          c.px(x, y, FIELDSTONE, wallN, { bias: 2 });
          continue;
        }
        const head = y < springW + 2;
        const lead = Math.abs(x + 0.5 - wx) < 1 || (!head && (y - springW) % 7 === 3);
        if (lead) c.px(x, y, IRON, wallN, { bias: 0 });
        else if (head) c.px(x, y, RUNE_GLASS, { x: 0, y: 0, z: 1 }, { bias: 1, glow: 0.7 });
        else c.px(x, y, HEARTH, { x: 0, y: 0, z: 1 }, { bias: Math.round((y - springW) / 8) - 1 + (hash2(x, y, 1451) > 0.85 ? 1 : 0), glow: 0.55 });
      }
    }
    c.part();
    c.shape(sill, sill + 1, () => [wx - a - 3, wx + a + 3], FIELDSTONE, (_x, y, t) => (y === sill ? top(t) : front(t)), { bias: 2 });
    c.part();
    c.shape(sill + 3, sill + 6, () => [wx - 8, wx + 8], OAK, (_x, y, t) => (y === sill + 3 ? top(t) : front(t)));
    c.part();
    for (let x = wx - 7; x <= wx + 7; x++) {
      const k = hash2(x, 7, 1453);
      c.px(x, sill + 2, BUSH, sphere(0, 0.4), { bias: 2 });
      if (k > 0.45) c.px(x, sill + 1, k > 0.8 ? GEM_FLOWER_PINK : k > 0.62 ? GEM_FLOWER_GOLD : BUSH, sphere(0, 0.5), { bias: 2 });
    }
  }

  // ---- Iron lanterns on the inner buttresses, facing the door.
  for (const sx of [-1, 1]) {
    const lx = cx + sx * 27;
    const ly = eaves + 26;
    c.part();
    c.line(cx + sx * 31, ly - 2, lx, ly - 2, IRON, () => top(0));
    c.part();
    c.capsule(lx, ly, lx, ly + 6, 2, 2.3, IRON);
    c.part();
    c.ellipse(lx, ly + 3.5, 1.2, 1.9, HEARTH, { glow: 1 });
  }

  // ---- Ivy up the corner buttresses, moss and bushes at the wall's foot (clear of the steps).
  const ivy = (x0: number, y0: number, y1: number, sway: number, seed: number) => {
    c.part();
    for (let y = y1; y >= y0; y--) {
      const x = x0 + Math.sin(y * 0.35 + seed) * sway;
      c.px(x, y, BUSH, sphere(0, 0.3), { bias: 0 });
      if (hash2(y, seed, 1461) > 0.45) c.ellipse(x + (hash2(y, seed, 1463) > 0.5 ? 1.5 : -1.5), y, 1.3, 1, BUSH, { bias: 1 });
    }
  };
  ivy(wl + 4, eaves + 8, H - 2, 2.5, 1);
  ivy(wr - 5, eaves + 16, H - 2, 2, 4);
  ivy(cx - 64, apex + 30, eaves + 4, 1.5, 7);
  for (const [bx, r] of [
    [9, 7],
    [W - 9, 7],
    [cx - 76, 5],
    [cx + 76, 5],
    [cx - 46, 4],
    [cx + 46, 4],
  ] as [number, number][]) {
    c.part();
    c.ellipse(bx, H - 3, r, r * 0.6, BUSH, { normal: (_x, _y, dx, dy) => sphere(dx, dy, 1) });
    for (let k = 0; k < 4; k++) if (hash2(bx, k, 1465) > 0.4) c.px(bx - r + 2 + hash2(k, bx, 1467) * (r * 2 - 4), H - 3 - r * 0.4 + hash2(bx, k, 1469) * 2, k % 2 ? GEM_FLOWER_PINK : GEM_FLOWER_GOLD, sphere(0, 0.5), { bias: 2 });
  }
  return c;
}
