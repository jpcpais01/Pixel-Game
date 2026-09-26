// The Rune Temple's art: the temple on the Runestone Clearing, the room
// inside it (painted in one piece, lit, with a normal map and a glow layer),
// the things that stand in the room, and its two keepers.
//
// Outside: a small temple of pale lavender marble on three broad steps, four
// fluted columns with gold capitals, violet banners between them, a frieze of
// glowing runes, and over it all a deep blue dome ribbed in gold with a gold
// spire. A crystal floats above the spire, and the arched doorway is a swirl
// of violet light.
//
// Inside: a marble north wall with a great rose window of stained glass, two
// tall lancet windows and a band of runes; the keepers' banners hang on it,
// violet for the Unmaker, crimson for the Runesmith. The floor is polished
// indigo stone laid in a checker, veined, with the window's light pooling on
// it; a gold and violet rune circle lies in the middle, a crimson runner leads
// in from the door, and each keeper has a round dais ringed in their colour.
//
// Nyx the Unmaker, who breaks gear down into dust: tall and slender in a
// starry violet robe, long silver hair, glowing eyes, a crescent staff in one
// hand and a swirl of dust above the other palm. Her station is a crucible of
// dark stone on three legs, full of swirling violet dust.
// Tharn the Runesmith, who spends dust raising a piece's level: broad and
// short, bald with a glowing rune on his brow, a great braided ginger beard, a
// leather apron over a slate-blue shirt, and a rune hammer on his shoulder.
// His station is an anvil on a runed stone block, hot gold runes on its face.

import { mix } from './bitmap';
import { hash2 } from './env';
import { KEY_LIGHT, PixelCanvas, cyl, hex, sphere, type Material, type RGB, type Vec3 } from './pixel';
import { fbm } from './spirit';
import { BOOT, EYE, GOLD, LEATHER } from './palette';
import { CIRCLE, DAIS, DOOR_BOT, DOOR_L, DOOR_R, FACE_TOP, FLOOR_BOT, FLOOR_TOP, IN_L, IN_R, ROOM_H, ROOM_W, WINDOW } from '../world/sanctumLayout';

const ramp = (...c: string[]): RGB[] => c.map(hex);
type N3 = [number, number, number];
const UP: N3 = [0, 0, 1];

// ---------------------------------------------------------------- Palette

const WALL = ramp('#110e1a', '#1a1628', '#241e36', '#2f2846', '#3c3458', '#4b426c', '#5c5282', '#71669a');
const CAPS = ramp('#0d0b15', '#15121f', '#1e1a2c', '#28223a', '#332c4a', '#3f375a');
const TILE_A = ramp('#0b0a14', '#110f1f', '#17142a', '#1e1a36', '#262142', '#2f2950', '#39325f');
const TILE_B = ramp('#0e0a16', '#150f22', '#1c142e', '#241a3a', '#2d2148', '#372856', '#433068');
const DAIS_ST = ramp('#14111e', '#1d1a2c', '#27233a', '#322d4a', '#3e385c', '#4b446e', '#5a5282');
const GOLDS = ramp('#3a2008', '#6a3e12', '#9e6420', '#d69a3a', '#f4cf6a', '#fff4bf');
const RUNNER = ramp('#16040b', '#2a0814', '#420e20', '#5c142c', '#781c3a', '#94284a');
const MASS: RGB = hex('#06050b');
const INK_R: RGB = hex('#050409');
const VIOLET: RGB = [176, 120, 255];
const GOLDEN: RGB = [255, 196, 96];
const PALE: RGB = [236, 224, 255];
/** The rose window's glass, from the middle out: gold, then violet and rose petals, then blue and teal. */
const GLASS: Record<string, RGB> = { gold: hex('#ffcc5a'), violet: hex('#9a5aff'), rose: hex('#ff6aa8'), blue: hex('#4a8aff'), teal: hex('#4ae0d4') };
/** Each keeper's colour: their dais ring and banner. */
export const KEEPER_TINT = { disenchant: 0xb078ff, upgrade: 0xffc060 } as const;
const KEEPER_RGB: Record<'disenchant' | 'upgrade', RGB> = { disenchant: VIOLET, upgrade: GOLDEN };

export interface SanctumArt {
  diffuse: Uint8ClampedArray;
  normal: Uint8ClampedArray;
  emissive: Uint8ClampedArray;
}

/** Distance from (px, py) to the segment (ax, ay)-(bx, by). */
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax;
  const vy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1)));
  return Math.hypot(px - ax - vx * t, py - ay - vy * t);
}

/** The room inside the temple, painted in one piece: ROOM_W x ROOM_H. */
export function* sanctumArt(): Generator<void, SanctumArt, void> {
  const W = ROOM_W;
  const H = ROOM_H;
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

  // The rune circle's star: two triangles inside its inner ring.
  const star: [number, number, number, number][] = [];
  for (const rot of [-Math.PI / 2, Math.PI / 2]) {
    const pts = [0, 1, 2].map((k) => {
      const a = rot + (k * Math.PI * 2) / 3;
      return [CIRCLE.x + Math.cos(a) * CIRCLE.rx * 0.72, CIRCLE.y + Math.sin(a) * CIRCLE.ry * 0.72] as const;
    });
    for (let k = 0; k < 3; k++) star.push([pts[k][0], pts[k][1], pts[(k + 1) % 3][0], pts[(k + 1) % 3][1]]);
  }

  for (let y = 0; y < H; y++) {
    if (y % 12 === 0) yield;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const inX = x >= IN_L && x < IN_R;

      // ---- The north wall's face.
      if (inX && y >= FACE_TOP && y < FLOOR_TOP) {
        const yy = y - FACE_TOP;
        const hgt = FLOOR_TOP - FACE_TOP;
        // The rose window: a stone ring, a gold one inside it, and glass in lead.
        const wd = Math.hypot(x + 0.5 - WINDOW.x, y + 0.5 - WINDOW.y);
        if (wd < WINDOW.r + 3) {
          if (wd >= WINDOW.r) {
            const n: N3 = [(x - WINDOW.x) / wd * 0.6, -(y - WINDOW.y) / wd * 0.6, 0.8];
            put(i, pick(WALL, 5 + shadeOf(n) * 2), n);
          } else if (wd >= WINDOW.r - 1.2) put(i, pick(GOLDS, 3), faceN, GOLDEN, 0.25);
          else {
            const a = Math.atan2(y + 0.5 - WINDOW.y, x + 0.5 - WINDOW.x) + Math.PI;
            const seg = (a / (Math.PI * 2)) * 12;
            const lead = Math.abs(seg - Math.round(seg)) * (wd * 0.52) < 0.5 && wd > 6;
            const ring = Math.abs(wd - 6) < 0.6 || Math.abs(wd - 14) < 0.6;
            if (lead || ring) put(i, INK_R, faceN);
            else {
              const petal = Math.floor(seg) % 2;
              const g = wd < 6 ? GLASS.gold : wd < 14 ? (petal ? GLASS.violet : GLASS.rose) : petal ? GLASS.blue : GLASS.teal;
              const shine = 0.75 + fbm(x, y, 3, 301, 2) * 0.5;
              put(i, mix(INK_R, g, 0.55), faceN, g, shine * (wd < 6 ? 1 : 0.85));
            }
          }
          continue;
        }
        // Two tall lancet windows either side of it.
        for (const lx of [150, 298]) {
          const dx = x + 0.5 - lx;
          const top = 18;
          const bot = 56;
          const inside = Math.abs(dx) < 5 && yy >= top && yy < bot && (yy >= top + 5 || Math.hypot(dx, yy - (top + 5)) < 5);
          if (!inside) continue;
          const lead = Math.abs(dx) < 0.5 || yy === top + 16 || yy === top + 28;
          const edge = Math.abs(dx) > 4 || (yy < top + 5 && Math.hypot(dx, yy - (top + 5)) > 4);
          if (edge) put(i, pick(GOLDS, 2), faceN, GOLDEN, 0.15);
          else if (lead) put(i, INK_R, faceN);
          else {
            const k = (yy - top) / (bot - top);
            const g = mix(GLASS.violet, GLASS.blue, k);
            put(i, mix(INK_R, g, 0.5), faceN, g, 0.75 - k * 0.25);
          }
          break;
        }
        if (emissive[i * 4 + 3]) continue;
        if (diffuse[i * 4 + 3]) continue;
        // The keepers' banners, on gold rods.
        let banner = false;
        for (const id of ['disenchant', 'upgrade'] as const) {
          const bx = DAIS[id].banner;
          const dx = x + 0.5 - bx;
          if (yy >= 6 && yy <= 7 && Math.abs(dx) < 11) {
            put(i, pick(GOLDS, yy === 6 ? 4 : 2), faceN);
            banner = true;
            break;
          }
          const point = 48 + (9 - Math.abs(dx)) * 0.6;
          if (Math.abs(dx) < 9 && yy > 7 && yy < point) {
            const cloth = id === 'disenchant' ? ramp('#1a0e32', '#2a1650', '#3e2272', '#563096', '#7044bc') : RUNNER;
            if (Math.abs(dx) > 7.8 || yy > point - 1.5) put(i, pick(GOLDS, 3), faceN);
            else {
              // Folds, and the keeper's sigil in the middle.
              const fold = Math.sin(dx * 1.1) * 0.8;
              const sy = yy - 26;
              const sigil = id === 'disenchant' ? Math.abs(dx) + Math.abs(sy) * 0.7 < 4.2 && Math.abs(dx) + Math.abs(sy) * 0.7 > 2.4 : (sy >= -3 && sy <= -1 && Math.abs(dx) < 5) || (sy >= 0 && sy <= 3 && Math.abs(dx) < 2) || (sy === 4 && Math.abs(dx) < 4);
              if (sigil) put(i, pick(GOLDS, 4), faceN, KEEPER_RGB[id], 0.6);
              else put(i, pick(cloth, 2.4 + fold + (yy < 10 ? -0.6 : 0)), faceN);
            }
            banner = true;
            break;
          }
        }
        if (banner) continue;
        // Pilasters between the windows, gold at the top.
        const pil = [64, 110, 188, 260, 338, 384].find((p) => Math.abs(x + 0.5 - p) < 4.5);
        if (pil !== undefined && yy >= 2 && yy < hgt - 4) {
          const t = (x + 0.5 - pil) / 4.5;
          const n: N3 = [t * 0.7, -0.35, 0.75];
          if (yy < 6) put(i, pick(GOLDS, 3 + shadeOf(n) * 1.5), n, GOLDEN, 0.1);
          else put(i, pick(WALL, 4.2 + shadeOf(n) * 2.4 + (Math.round(t * 3) % 2 ? -0.4 : 0)), n);
          continue;
        }
        // The rune band near the foot of the wall.
        if (yy >= hgt - 12 && yy <= hgt - 6) {
          if (yy === hgt - 12 || yy === hgt - 6) {
            put(i, pick(WALL, yy === hgt - 12 ? 5 : 2), yy === hgt - 12 ? [0, 0.4, 0.9] : faceN);
            continue;
          }
          const gx = Math.floor(x / 7);
          const lx = x % 7;
          const glyph = lx > 0 && lx < 6 && hash2(gx, yy, 311) > 0.45 && hash2(gx, lx, 313) > 0.3;
          if (glyph) put(i, mix(pick(WALL, 1), VIOLET, 0.5), faceN, VIOLET, 0.55);
          else put(i, pick(WALL, 1), faceN);
          continue;
        }
        // The moulding along the top, then courses of cut marble, darker toward the floor.
        if (yy < 4) {
          put(i, pick(WALL, yy < 2 ? 6 : 2), yy < 2 ? [0, 0.5, 0.86] : faceN);
          continue;
        }
        const row = Math.floor((yy - 4) / 8);
        const off = row % 2 ? 11 : 0;
        const lx = (x + off) % 22;
        const ly = (yy - 4) % 8;
        if (ly === 7 || lx === 0) {
          put(i, pick(WALL, 1), faceN);
          continue;
        }
        let n = faceN;
        let idx = 3.3 + (hash2(Math.floor((x + off) / 22), row, 317) - 0.5) * 1.2 + (fbm(x, y, 6, 319, 2) - 0.5) * 0.8;
        if (ly === 0) {
          n = [0, 0.3, 0.95];
          idx += 0.8;
        }
        if (yy > hgt - 5) idx -= 1.4;
        put(i, pick(WALL, idx + shadeOf(n) * 0.6), n);
        continue;
      }

      // ---- The floor.
      const inFloor = inX && y >= FLOOR_TOP && y < FLOOR_BOT;
      const inDoor = x >= DOOR_L && x < DOOR_R && y >= FLOOR_BOT && y < DOOR_BOT;
      if (inFloor || inDoor) {
        const fy = y - FLOOR_TOP;
        // The crimson runner, from the door to the circle.
        const runnerTop = CIRCLE.y + CIRCLE.ry * 0.95;
        if (x >= 213 && x < 235 && y >= runnerTop) {
          const edge = x === 213 || x === 234;
          const inner = x === 215 || x === 232;
          if (inDoor) {
            // Down the steps.
            const step = (y - FLOOR_BOT) % 9;
            const n: N3 = step < 2 ? [0, 0.5, 0.86] : faceN;
            put(i, edge ? pick(GOLDS, step < 2 ? 4 : 2) : pick(RUNNER, (step < 2 ? 4 : 2.2) - (y - FLOOR_BOT) / 14), n);
            continue;
          }
          if (edge) put(i, pick(GOLDS, 3), UP, GOLDEN, 0.08);
          else if (inner) put(i, pick(RUNNER, 1), UP);
          else {
            const d = Math.abs(((x - 224) % 6) + 0) + Math.abs((y % 6) - 3);
            put(i, pick(RUNNER, 3 + (d === 3 ? 1 : 0) + (fbm(x, y, 4, 331, 2) - 0.5) * 0.8), UP);
          }
          continue;
        }
        if (inDoor) {
          // Steps down to the doorway, and light spilling in at its foot.
          const s = y - FLOOR_BOT;
          const step = s % 9;
          const n: N3 = step < 2 ? [0, 0.5, 0.86] : faceN;
          const jamb = x < DOOR_L + 2 || x >= DOOR_R - 2;
          const light = Math.max(0, (s - 12) / 14);
          put(i, jamb ? pick(GOLDS, 2) : pick(DAIS_ST, (step < 2 ? 5 : 3) - s / 10), n, PALE, light * light * 0.5);
          continue;
        }
        // The keepers' daises.
        let done = false;
        for (const id of ['disenchant', 'upgrade'] as const) {
          const d = DAIS[id];
          const du = (x + 0.5 - d.x) / d.rx;
          const dv = (y + 0.5 - d.y) / d.ry;
          const r = Math.hypot(du, dv);
          if (r >= 1) continue;
          done = true;
          const glow = KEEPER_RGB[id];
          if (r > 0.9 && dv > 0) {
            // The dais's front edge, a step down to the floor.
            put(i, pick(DAIS_ST, 1.5), faceN);
          } else if (r > 0.9) put(i, pick(DAIS_ST, 5), [du * 0.4, -dv * 0.4, 0.8]);
          else if (r > 0.8 && r < 0.86) put(i, mix(pick(DAIS_ST, 2), glow, 0.55), UP, glow, 0.5);
          else {
            const a = Math.atan2(dv, du);
            const ringLine = Math.abs((r * 4) % 1 - 0.5) > 0.44;
            const spoke = Math.abs(((a / (Math.PI * 2)) * 16 + 16) % 1 - 0.5) > 0.46 && r > 0.3;
            let idx = 3.6 - r * 0.8 + (fbm(x, y, 5, 341, 2) - 0.5) * 0.6;
            if (ringLine || spoke) idx -= 1.2;
            const rune = r > 0.66 && r < 0.76 && hash2(Math.floor(((a + Math.PI) / (Math.PI * 2)) * 24), 0, id === 'disenchant' ? 343 : 347) > 0.35;
            if (rune) put(i, mix(pick(DAIS_ST, 2), glow, 0.4), UP, glow, 0.3);
            else put(i, pick(DAIS_ST, idx), UP, glow, Math.max(0, 0.25 - r * 0.3));
          }
          break;
        }
        if (done) continue;

        // Polished stone laid in a checker: bevelled edges, pale veins.
        const tx = Math.floor(x / 16);
        const ty = Math.floor(fy / 12);
        const lx = x % 16;
        const ly = fy % 12;
        const base = (tx + ty) % 2 ? TILE_A : TILE_B;
        if (lx === 0 || ly === 0) {
          put(i, pick(base, 0), UP);
          continue;
        }
        let n: N3 = UP;
        let idx = 3.2 + (hash2(tx, ty, 351) - 0.5) * 0.8;
        if (lx === 1 || ly === 1) {
          n = [-0.25, 0.3, 0.9];
          idx += 0.8;
        } else if (lx === 15 || ly === 11) {
          n = [0.25, -0.3, 0.9];
          idx -= 0.7;
        }
        const vein = Math.abs(fbm(x, y * 1.3, 18, 353, 3) - 0.5);
        if (vein < 0.012) idx += 1.6;
        else if (vein < 0.024) idx += 0.6;
        // The window's light pooling down the floor, and the shade at the wall's foot and the sides.
        const pool = Math.exp(-(((x - WINDOW.x) / 70) ** 2) - (fy / 80) ** 2);
        idx += pool * 1.8;
        if (fy < 8) idx -= (8 - fy) / 3.2;
        const side = Math.min(x - IN_L, IN_R - 1 - x, FLOOR_BOT - 1 - y);
        if (side < 10) idx -= (10 - side) / 5;
        let glow: RGB | undefined;
        let gk = 0;
        if (pool > 0.1) {
          glow = mix(GLASS.violet, GLASS.blue, 0.5);
          gk = pool * 0.12 * (0.7 + hash2(x >> 1, y >> 1, 355) * 0.3);
        }

        // The rune circle: a gold ring, a band of runes, a violet ring and a star inside.
        const cu = (x + 0.5 - CIRCLE.x) / CIRCLE.rx;
        const cv = (y + 0.5 - CIRCLE.y) / CIRCLE.ry;
        const cr = Math.hypot(cu, cv);
        if (cr < 1) {
          if (cr > 0.94) {
            put(i, pick(GOLDS, 3 + (cr > 0.97 ? -1 : 0.5)), UP, GOLDEN, 0.3);
            continue;
          }
          if (cr > 0.8 && cr < 0.84) {
            put(i, mix(pick(TILE_A, 2), VIOLET, 0.55), UP, VIOLET, 0.55);
            continue;
          }
          if (cr >= 0.84) {
            const a = Math.atan2(cv, cu) + Math.PI;
            const cell = Math.floor((a / (Math.PI * 2)) * 36);
            const k = ((a / (Math.PI * 2)) * 36) % 1;
            const glyph = k > 0.15 && k < 0.85 && hash2(cell, Math.floor((cr - 0.84) * 60), 357) > 0.4;
            if (glyph) put(i, mix(pick(TILE_A, 2), VIOLET, 0.4), UP, VIOLET, 0.4);
            else put(i, pick(TILE_A, 1.5), UP);
            continue;
          }
          const onStar = star.some(([ax, ay, bx, by]) => segDist(x + 0.5, y + 0.5, ax, ay, bx, by) < 0.7);
          if (onStar) {
            put(i, mix(pick(TILE_A, 2), PALE, 0.4), UP, VIOLET, 0.35);
            continue;
          }
          if (cr < 0.2 && cr > 0.14) {
            put(i, pick(GOLDS, 4), UP, GOLDEN, 0.45);
            continue;
          }
          idx -= 0.4;
          glow = VIOLET;
          gk = Math.max(gk, (1 - cr) * 0.08);
        }
        put(i, pick(base, idx + shadeOf(n) * 0.5), n, glow, gk);
        continue;
      }

      // ---- Wall tops round the room, and the dark past them.
      const capL = IN_L - 12;
      const capR = IN_R + 12;
      const capT = FACE_TOP - 10;
      const capB = FLOOR_BOT + 12;
      if (x >= capL && x < capR && y >= capT && y < capB) {
        // The doorway's jambs: gold-edged, where the south wall opens.
        const nearDoor = y >= FLOOR_BOT && (x === DOOR_L - 1 || x === DOOR_R);
        if (nearDoor) {
          put(i, pick(GOLDS, 3), UP, GOLDEN, 0.15);
          continue;
        }
        const d = Math.min(x < IN_L ? IN_L - 1 - x : x >= IN_R ? x - IN_R : 99, y < FACE_TOP ? FACE_TOP - 1 - y : y >= FLOOR_BOT ? y - FLOOR_BOT : 99, x - capL, capR - 1 - x, y - capT, capB - 1 - y);
        const inner = (x < IN_L && x === IN_L - 1) || (x >= IN_R && x === IN_R) || (y < FACE_TOP && y === FACE_TOP - 1) || (y >= FLOOR_BOT && y === FLOOR_BOT && (x < DOOR_L || x >= DOOR_R));
        const bx = Math.floor(x / 12);
        const by = Math.floor(y / 8);
        let idx = 2.6 + (hash2(bx, by, 361) - 0.5) * 0.9 + (fbm(x, y, 5, 363, 2) - 0.5) * 0.6;
        if (x % 12 === 0 || y % 8 === 0) idx -= 1;
        if (inner) idx += 2.2;
        if (d === 0) idx = 0;
        put(i, pick(CAPS, idx), UP);
        continue;
      }
      // Past the doorway: the way out, bright; elsewhere solid dark.
      if (x >= DOOR_L && x < DOOR_R && y >= DOOR_BOT) {
        const k = Math.max(0, 1 - (y - DOOR_BOT) / 6);
        put(i, mix(MASS, PALE, k * 0.3), UP, PALE, k * 0.45);
        continue;
      }
      put(i, MASS, UP);
    }
  }
  return { diffuse, normal, emissive };
}

// ---------------------------------------------------------------- Materials

const INK = hex('#120e1f');
const MARBLE: Material = { ramp: ramp('#2a2440', '#3c3458', '#544a74', '#6e6492', '#8c82b0', '#aca3cc', '#cec7e6', '#ece8f8'), outline: INK, outlineLit: hex('#3a3258') };
const MARBLE_DK: Material = { ramp: ramp('#1c1830', '#282244', '#383058', '#4a4270', '#5c5488'), outline: INK };
const DOME: Material = { ramp: ramp('#120e2c', '#1c1644', '#28205e', '#352c7c', '#463c9c', '#5a52bc', '#7470d8'), outline: hex('#0a0818'), shine: true };
const PORTAL: Material = { ramp: ramp('#3a1a80', '#5a30c0', '#8a60f0', '#c0a0ff', '#f4ecff'), outline: hex('#1a0a40'), emissive: 0.9, noAO: true, noOutline: true };
const GEM_V: Material = { ramp: ramp('#2a1060', '#5a2ab0', '#9a6af0', '#dcc8ff', '#ffffff'), outline: hex('#140828'), emissive: 0.7, shine: true, noAO: true };
const GEM_G: Material = { ramp: ramp('#5a2a08', '#a0580e', '#e09a28', '#ffd870', '#fff8d8'), outline: hex('#2a1004'), emissive: 0.8, shine: true, noAO: true };
const CLOTH_V: Material = { ramp: ramp('#1a0e32', '#2a1650', '#3e2272', '#563096', '#7044bc'), outline: INK };
const MOSS_M: Material = { ramp: ramp('#14240e', '#1e3614', '#2c4e1c', '#3e6a26', '#58883a'), outline: hex('#0a1406') };
const STONE_DK: Material = { ramp: ramp('#0e0c14', '#18141f', '#221d2c', '#2e273a', '#3a3248', '#474058'), outline: hex('#06050a'), outlineLit: hex('#1e1a28') };
const IRON: Material = { ramp: ramp('#0c0c12', '#16161f', '#22222e', '#30303e', '#444454', '#5c5c70', '#8a8aa0'), outline: hex('#040408'), shine: true };
const DUST: Material = { ramp: ramp('#2a1060', '#4a22a0', '#7a48e0', '#b08cff', '#e8dcff'), outline: hex('#140828'), emissive: 0.85, noAO: true, noOutline: true };
const EMBERS: Material = { ramp: ramp('#5a1a04', '#a0400a', '#e08a20', '#ffc860', '#fff4c0'), outline: hex('#2a0a02'), emissive: 0.9, noAO: true, noOutline: true };

const front = (t: number): Vec3 => ({ x: t * 0.35, y: -0.4, z: 0.85 });
const top = (t = 0): Vec3 => ({ x: t * 0.2, y: 0.75, z: 0.65 });

// ---------------------------------------------------------------- The temple, outside

export const TEMPLE_ART_W = 144;
export const TEMPLE_ART_H = 138;
/** Feet row: the bottom of the lowest step. */
export const TEMPLE_ART_OY = 134;

export function sanctumExterior(): PixelCanvas {
  const c = new PixelCanvas(TEMPLE_ART_W, TEMPLE_ART_H);
  const cx = 72;

  // The dome on its drum, ribbed in gold, and the spire.
  c.part();
  c.shape(42, 53, () => [cx - 30, cx + 30], MARBLE, (_x, _y, t) => cyl(t, 0.1));
  for (const wx of [cx - 18, cx, cx + 18]) {
    c.part();
    c.ellipse(wx, 47.5, 2.3, 2.6, PORTAL, { glow: 0.8 });
  }
  c.part();
  const dcy = 44;
  c.shape(14, 44, (y) => {
    const v = (y + 0.5 - dcy) / 30;
    const hw = 28 * Math.sqrt(Math.max(0, 1 - v * v));
    return hw > 0.5 ? [cx - hw, cx + hw] : null;
  }, DOME, (_x, y, t) => sphere(t * 0.95, (dcy - y) / 32, 1));
  c.part();
  for (const k of [-0.75, -0.38, 0, 0.38, 0.75]) {
    for (let y = 16; y <= 43; y++) {
      const v = (y + 0.5 - dcy) / 30;
      const hw = 28 * Math.sqrt(Math.max(0, 1 - v * v));
      const x = cx + k * hw;
      c.px(x, y, GOLD, sphere(k * 0.9, (dcy - y) / 32, 1));
    }
  }
  c.part();
  c.capsule(cx, 6, cx, 16, 1.2, 2.2, GOLD);
  c.part();
  c.ellipse(cx, 5, 1.6, 1.6, GEM_V, { glow: 0.9 });

  // The roof's terrace, seen from above, with a gold finial at each corner.
  c.part();
  c.shape(53, 58, (y) => [20 + (58 - y) * 0.4, 124 - (58 - y) * 0.4], MARBLE, (_x, _y, t) => top(t), { bias: 1 });
  for (const fx of [24, 120]) {
    c.part();
    c.capsule(fx, 51, fx, 56, 1.8, 1.4, GOLD);
    c.part();
    c.ellipse(fx, 49.5, 1.4, 1.6, GEM_V, { glow: 0.8 });
  }

  // The frieze, with its row of glowing runes.
  c.part();
  c.shape(58, 66, () => [18, 126], MARBLE, (_x, y, t) => (y === 58 ? top(t) : front(t)));
  c.part();
  for (let x = 22; x < 122; x++) {
    const k = x % 6;
    if (k === 0 || k === 5) continue;
    for (let y = 61; y <= 63; y++) if (hash2(Math.floor(x / 6), y * 7 + k, 371) > 0.5) c.px(x, y, PORTAL, front(0), { glow: 0.75 });
  }
  for (let x = 18; x < 126; x++) c.shade(x, 65, -1);

  // The wall behind the columns: courses of darker marble.
  c.part();
  c.shape(66, 120, () => [24, 120], MARBLE_DK, (_x, _y, t) => front(t * 0.4));
  for (let y = 66; y <= 120; y++) {
    if ((y - 66) % 7 === 6) for (let x = 24; x < 120; x++) c.shade(x, y, -1);
  }

  // Banners between the outer columns: violet, gold-edged, a gem in the middle.
  for (const bx of [41, 103]) {
    c.part();
    c.shape(71, 96, (y) => {
      const hw = y > 92 ? 4 - (y - 92) : 4;
      return hw > 0 ? [bx - hw, bx + hw] : null;
    }, CLOTH_V, (_x, _y, t) => ({ x: Math.sin(t * 3) * 0.3, y: -0.3, z: 0.9 }));
    for (let y = 71; y <= 93; y++) {
      c.px(bx - 4, y, GOLD, front(-0.6));
      c.px(bx + 3, y, GOLD, front(0.6));
    }
    c.part();
    c.ellipse(bx - 0.5, 82, 1.8, 2.4, GEM_V, { glow: 0.9 });
    c.part();
    c.capsule(bx - 6, 70.5, bx + 5, 70.5, 0.7, 0.7, GOLD);
  }

  // Four fluted columns with gold capitals.
  for (const px of [31, 51, 93, 113]) {
    c.part();
    c.shape(68, 115, () => [px - 3.6, px + 3.6], MARBLE, (_x, _y, t) => cyl(t, 0.15));
    for (let y = 70; y < 115; y++) c.shade(px - 1, y, -1);
    for (let y = 70; y < 115; y++) c.shade(px + 2, y, -1);
    c.part();
    c.shape(65, 69, (y) => {
      const hw = y < 67 ? 5.2 : 4.4;
      return [px - hw, px + hw];
    }, GOLD, (_x, y, t) => (y === 65 ? top(t) : cyl(t, 0.2)));
    c.part();
    c.shape(114, 119, (y) => {
      const hw = y > 116 ? 5 : 4.4;
      return [px - hw, px + hw];
    }, MARBLE, (_x, _y, t) => cyl(t, 0.2), { bias: 1 });
  }
  // Ivy climbing the outer columns.
  c.part();
  for (let y = 84; y < 118; y++) {
    const w = Math.sin(y * 0.7) * 1.2;
    if (hash2(y, 0, 373) > 0.25) c.px(28 + w, y, MOSS_M, sphere(-0.5, 0.2));
    if (y > 96 && hash2(y, 1, 373) > 0.35) c.px(116 + w, y, MOSS_M, sphere(0.4, 0.2));
  }

  // The doorway: a gold arch round a swirl of violet light, a gem at its crown.
  const dx0 = cx;
  const dy0 = 86;
  const inArch = (x: number, y: number, r: number) => (y >= dy0 ? Math.abs(x + 0.5 - dx0) < r : Math.hypot(x + 0.5 - dx0, y + 0.5 - dy0) < r);
  c.part();
  for (let y = dy0 - 14; y < 120; y++) {
    for (let x = dx0 - 14; x < dx0 + 14; x++) {
      if (!inArch(x, y, 13.5) || inArch(x, y, 11)) continue;
      const t = (x + 0.5 - dx0) / 13.5;
      c.px(x, y, GOLD, y < dy0 ? sphere(t, (dy0 - y) / 14, 1) : cyl(t, 0.1));
    }
  }
  c.part();
  for (let y = dy0 - 11; y < 120; y++) {
    for (let x = dx0 - 11; x < dx0 + 11; x++) {
      if (!inArch(x, y, 11)) continue;
      const ax = x + 0.5 - dx0;
      const ay = y + 0.5 - (dy0 + 8);
      const r = Math.hypot(ax, ay * 0.7);
      const a = Math.atan2(ay, ax);
      const swirl = Math.sin(a * 3 + r * 0.55) * 0.5 + 0.5;
      const bias = Math.round(swirl * 2 - r / 9);
      c.px(x, y, PORTAL, { x: 0, y: 0, z: 1 }, { bias, glow: 0.55 + swirl * 0.4 - r / 40 });
    }
  }
  c.part();
  c.ellipse(dx0, dy0 - 13, 2, 2.2, GEM_V, { glow: 1 });
  // Lanterns either side of the door.
  for (const lx of [cx - 18, cx + 18]) {
    c.part();
    c.capsule(lx, 88, lx, 93, 1.6, 1.8, GOLD);
    c.part();
    c.ellipse(lx, 91, 1.1, 1.8, GEM_G, { glow: 1 });
  }

  // Three broad steps.
  const steps: [number, number, number][] = [
    [120, 124, 50],
    [124, 129, 56],
    [129, 134, 62],
  ];
  for (const [y0, y1, hw] of steps) {
    c.part();
    c.shape(y0, y1, () => [cx - hw, cx + hw], MARBLE, (_x, y, t) => (y - y0 < 2 ? top(t) : front(t)), { bias: 1 });
    for (let x = cx - hw; x < cx + hw; x++) if (hash2(x, y0, 375) > 0.93) c.shade(x, y0 + 3, -1);
  }
  // Moss at the steps' ends.
  for (const [mx, my] of [
    [16, 131],
    [128, 132],
    [24, 124],
  ]) {
    c.part();
    c.ellipse(mx, my, 3.2, 1.6, MOSS_M, { flatten: 0.7 });
  }
  return c;
}

// ---------------------------------------------------------------- The floating crystal

export const CRYSTAL_W = 14;
export const CRYSTAL_H = 24;
export const CRYSTAL_FRAMES = 8;
const SHARD: Material = { ramp: ramp('#2a1060', '#46209a', '#6a3ad0', '#9a6af0', '#c8a8ff', '#f0e6ff'), outline: hex('#140828'), emissive: 0.5, shine: true, noAO: true };

/** A violet crystal turning slowly in the air: frame `f` of CRYSTAL_FRAMES. */
export function runeCrystal(f: number): PixelCanvas {
  const c = new PixelCanvas(CRYSTAL_W, CRYSTAL_H);
  const cx = 7;
  const a = (f / CRYSTAL_FRAMES) * Math.PI;
  const hw = 3.2 + Math.abs(Math.cos(a)) * 1.8;
  const ridge = Math.sin(a * 2) * hw * 0.5;
  const mid = 9;
  c.part();
  c.shape(1, 22, (y) => {
    const w = y < mid ? ((y + 0.5 - 1) / (mid - 1)) * hw : ((22.5 - y) / (22 - mid)) * hw;
    return w > 0.3 ? [cx - w, cx + w] : null;
  }, SHARD, (x, y, t) => {
    const side = x + 0.5 - cx < ridge ? -1 : 1;
    return { x: side * 0.7 + t * 0.1, y: y < mid ? 0.45 : -0.2, z: 0.6 };
  }, { glow: 0.5 });
  c.part();
  for (let y = 3; y < 20; y++) if (Math.abs(y - mid) < 6) c.spark(cx + ridge * 0.4, y, [220, 200, 255], 0.5 - Math.abs(y - mid) / 14);
  return c;
}

// ---------------------------------------------------------------- Pillars

export const PILLAR_W = 20;
export const PILLAR_H = 62;
export const PILLAR_OY = 59;

export function sanctumPillar(): PixelCanvas {
  const c = new PixelCanvas(PILLAR_W, PILLAR_H);
  const cx = 10;
  c.part();
  c.shape(52, 60, (y) => [cx - (y > 55 ? 8.5 : 7.5), cx + (y > 55 ? 8.5 : 7.5)], MARBLE, (_x, y, t) => (y === 52 || y === 56 ? top(t) : front(t)));
  c.part();
  c.shape(12, 52, () => [cx - 5, cx + 5], MARBLE, (_x, _y, t) => cyl(t, 0.12));
  for (let y = 13; y < 52; y++) {
    c.shade(cx - 3, y, -1);
    c.shade(cx + 2, y, -1);
  }
  // A thread of runes glowing down its face.
  c.part();
  for (let y = 16; y < 48; y += 3) if (hash2(y, 3, 381) > 0.2) c.px(cx, y, PORTAL, front(0), { glow: 0.7 });
  c.part();
  c.shape(6, 12, (y) => [cx - (y < 9 ? 7.5 : 6), cx + (y < 9 ? 7.5 : 6)], GOLD, (_x, y, t) => (y === 6 ? top(t) : cyl(t, 0.2)));
  c.part();
  c.shape(1, 6, () => [cx - 8.5, cx + 8.5], MARBLE, (_x, y, t) => (y < 3 ? top(t) : front(t)), { bias: 1 });
  return c;
}

// ---------------------------------------------------------------- The keepers' stations

export const STATION_FRAMES = 6;
export const CRUCIBLE_W = 30;
export const CRUCIBLE_H = 32;
export const CRUCIBLE_OY = 29;

/** Nyx's crucible: dark stone on three clawed legs, gold-rimmed, full of swirling violet dust. */
export function dustCrucible(f: number): PixelCanvas {
  const c = new PixelCanvas(CRUCIBLE_W, CRUCIBLE_H);
  const cx = 15;
  const ph = (f / STATION_FRAMES) * Math.PI * 2;
  for (const [lx, back] of [
    [cx, true],
    [cx - 8, false],
    [cx + 8, false],
  ] as [number, boolean][]) {
    c.part();
    c.capsule(lx + (lx - cx) * 0.1, 21, lx + (lx - cx) * 0.2, 28, 1.6, 1.2, IRON, { bias: back ? -1 : 0 });
    c.part();
    c.ellipse(lx + (lx - cx) * 0.2, 28.5, 2.2, 1, IRON, { flatten: 0.7 });
  }
  c.part();
  c.shape(13, 24, (y) => {
    const u = (y - 13) / 11;
    const hw = 12 - u * u * 5;
    return [cx - hw, cx + hw];
  }, STONE_DK, (_x, y, t) => sphere(t * 0.9, (18 - y) / 12, 1));
  // Runes round the bowl's belly, pulsing.
  c.part();
  for (let x = cx - 9; x <= cx + 9; x += 3) {
    const k = 0.4 + 0.5 * (0.5 + 0.5 * Math.sin(ph + x * 0.7));
    c.px(x, 18, DUST, sphere((x - cx) / 12, 0), { glow: k });
    if (hash2(x, 1, 383) > 0.4) c.px(x + 1, 19, DUST, sphere((x - cx) / 12, 0), { glow: k * 0.8 });
  }
  // The gold rim, and the dust inside it wheeling round.
  c.part();
  c.ellipse(cx, 13, 12.5, 3, GOLD, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, -dy * 0.5 + 0.4, 1) });
  c.part();
  for (let y = 11; y <= 15; y++) {
    for (let x = cx - 11; x <= cx + 11; x++) {
      const dx = (x + 0.5 - cx) / 10.5;
      const dy = (y + 0.5 - 13) / 2.2;
      const r = Math.hypot(dx, dy);
      if (r > 1) continue;
      const a = Math.atan2(dy, dx);
      const s = Math.sin(a * 2 - ph + r * 5) * 0.5 + 0.5;
      c.px(x, y, DUST, { x: 0, y: 0.3, z: 0.95 }, { bias: Math.round(s * 2 - r), glow: 0.5 + s * 0.45 });
    }
  }
  // Motes of dust rising off it.
  for (let k = 0; k < 5; k++) {
    const t = (f / STATION_FRAMES + k / 5) % 1;
    const x = cx + Math.sin(k * 2.3 + t * 5) * (4 + k);
    const y = 11 - t * 10;
    c.spark(x, y, k % 2 ? [220, 190, 255] : [150, 100, 255], 1 - t);
  }
  return c;
}

export const ANVIL_W = 34;
export const ANVIL_H = 30;
export const ANVIL_OY = 27;

/** Tharn's anvil: dark iron on a runed stone block, a rune glowing hot on its face. */
export function runeAnvil(f: number): PixelCanvas {
  const c = new PixelCanvas(ANVIL_W, ANVIL_H);
  const cx = 17;
  const pulse = 0.5 + 0.5 * Math.sin((f / STATION_FRAMES) * Math.PI * 2);
  c.part();
  c.shape(16, 27, (y) => [cx - (y > 25 ? 11 : 10), cx + (y > 25 ? 11 : 10)], STONE_DK, (_x, y, t) => (y === 16 ? top(t) : front(t)), { bias: 1 });
  // Gold runes cut into the block's face.
  c.part();
  for (let x = cx - 8; x <= cx + 8; x++) {
    for (let y = 19; y <= 24; y++) {
      const k = x - (cx - 8);
      if (k % 4 === 3) continue;
      if (hash2(Math.floor(k / 4), y * 5 + (k % 4), 391) > 0.55) c.px(x, y, GEM_G, front(0), { glow: 0.35 + pulse * 0.45 });
    }
  }
  // The anvil: foot, waist, face and horn.
  c.part();
  c.shape(13, 16, (y) => [cx - (y > 14 ? 7 : 5), cx + (y > 14 ? 7 : 5)], IRON, (_x, _y, t) => cyl(t, 0.2));
  c.part();
  c.shape(10, 13, () => [cx - 3.5, cx + 3.5], IRON, (_x, _y, t) => cyl(t, 0.1));
  c.part();
  c.shape(6, 10, (y) => [cx - 9 - (y - 6) * 0.2, cx + 10], IRON, (_x, y, t) => (y < 8 ? top(t) : front(t)), { bias: 1 });
  c.part();
  c.shape(7, 9, (y) => [cx - 15 + (y - 7) * 1.5, cx - 8], IRON, (_x, y, t) => (y === 7 ? top(t) : cyl(t, 0.3)));
  // The hot rune on its face, and sparks when it flares.
  c.part();
  for (const [x, y] of [
    [cx - 1, 6],
    [cx, 7],
    [cx + 1, 6],
    [cx, 6],
    [cx + 2, 7],
    [cx - 2, 7],
  ]) c.px(x, y, EMBERS, top(0), { glow: 0.45 + pulse * 0.55 });
  if (pulse > 0.6) {
    for (let k = 0; k < 4; k++) c.spark(cx - 3 + k * 2 + (f % 2), 4 - ((k + f) % 3), [255, 210, 120], pulse - k * 0.12);
  }
  return c;
}

// ---------------------------------------------------------------- The keepers

export const KEEPER_W = 30;
export const KEEPER_H = 38;
/** Feet in the frame. */
export const KEEPER_OX = 15;
export const KEEPER_OY = 35;
export const KEEPER_FRAMES = 6;

const ROBE_V: Material = { ramp: ramp('#160c2a', '#24143e', '#341e58', '#482a78', '#5e3a9a', '#7a52c0'), outline: INK, outlineLit: hex('#2a1c4a') };
const ROBE_DK: Material = { ramp: ramp('#0e0818', '#180e28', '#22143a', '#2e1c4c'), outline: INK };
const SILVER: Material = { ramp: ramp('#3c3458', '#645a8a', '#9a90c0', '#d4ccf0', '#f4f0ff'), outline: hex('#1a1630'), outlineLit: hex('#3a3258') };
const PALE_SKIN: Material = { ramp: ramp('#5a4a68', '#9a82a6', '#d4bcd4', '#f4e6f0'), outline: hex('#24182e'), outlineLit: hex('#3e2e4c') };
const EYE_GLOW: Material = { ramp: ramp('#c8a8ff', '#f4ecff'), outline: INK, emissive: 1, noAO: true, noOutline: true };
const STAFF: Material = { ramp: ramp('#1a1016', '#2c1c22', '#44302e', '#5e443a'), outline: hex('#0a0608') };

/** Nyx the Unmaker, frame `f`: she breathes, her staff's orb pulses and dust wheels over her palm. */
export function unmaker(f: number): PixelCanvas {
  const c = new PixelCanvas(KEEPER_W, KEEPER_H);
  const cx = 15;
  const ph = (f / KEEPER_FRAMES) * Math.PI * 2;
  const U = Math.sin(ph) * 0.5;
  const pulse = 0.5 + 0.5 * Math.sin(ph);

  // Long silver hair falling behind her, and a high collar.
  c.part();
  c.shape(9 + U, 23, (y) => {
    const u = (y - 9 - U) / 14;
    const hw = 4.2 + u * 0.8;
    return [cx - hw, cx + hw];
  }, SILVER, (_x, _y, t, u) => sphere(t * 0.9, 0.3 - u * 0.4, 1), { bias: -1 });
  c.part();
  c.shape(12 + U, 16 + U, (y) => {
    const hw = 5.6 - (y - 12 - U) * 0.2;
    return [cx - hw, cx + hw];
  }, ROBE_DK, (_x, _y, t) => cyl(t, 0.2));

  // The staff, behind her left hand: dark wood, a gold crescent, an orb of dust.
  const sx = cx - 8;
  c.part();
  c.capsule(sx, 7, sx, 34, 0.7, 0.8, STAFF);
  c.part();
  for (let k = 0; k <= 10; k++) {
    const a = Math.PI * 0.15 + (k / 10) * Math.PI * 1.7;
    c.px(sx + Math.cos(a + Math.PI / 2) * 3, 5 + Math.sin(a + Math.PI / 2) * 3, GOLD, sphere(Math.cos(a + Math.PI / 2) * 0.8, -Math.sin(a + Math.PI / 2) * 0.8));
  }
  c.part();
  c.ellipse(sx, 4.5, 1.7, 1.7, DUST, { glow: 0.55 + pulse * 0.45 });
  c.spark(sx, 1 + (f % 3), [220, 200, 255], 0.5 + pulse * 0.4);

  // The robe, flaring to the floor, stars stitched in its hem.
  c.part();
  c.shape(15 + U, 34, (y) => {
    const hw = y < 22 + U ? 4.3 + (y - 15 - U) * 0.1 : 5 + (y - 22 - U) * 0.3;
    return [cx - hw, cx + hw];
  }, ROBE_V, (_x, y, t) => sphere(t * 0.9, y < 22 ? 0.1 : 0.25, 1));
  for (let y = Math.ceil(24 + U); y <= 33; y++) {
    c.shade(cx - 3, y, -1);
    c.shade(cx + 2, y, -1);
  }
  c.part();
  for (let x = cx - 8; x <= cx + 8; x++) c.px(x, 34, GOLD, sphere((x - cx) / 9, -0.2));
  for (const [x, y] of [
    [cx - 4, 30],
    [cx + 3, 28],
    [cx - 1, 32],
    [cx + 5, 32],
    [cx - 6, 33],
  ]) c.spark(x, y, [230, 214, 255], 0.35 + 0.35 * Math.sin(ph + x));
  // A gold sash with a violet gem.
  c.part();
  c.shape(Math.round(22 + U), Math.round(22 + U), () => [cx - 4.9, cx + 4.9], GOLD, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(cx, 22 + U, GEM_V, sphere(0, 0.2), { glow: 0.9 });
  // A mantle over the shoulders.
  c.part();
  c.ellipse(cx, 16.3 + U, 5.8, 2.3, ROBE_DK, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, -dy * 0.4 + 0.4, 1) });

  // Her arms: one down to the staff, one held out palm up.
  c.part();
  c.capsule(cx - 5, 17 + U, sx + 1.2, 22 + U, 1.7, 2.1, ROBE_V);
  c.part();
  c.ellipse(sx + 0.6, 22.5 + U, 1.4, 1.3, PALE_SKIN);
  c.part();
  c.capsule(cx + 5, 17 + U, cx + 8, 21 + U, 1.7, 2.2, ROBE_V);
  c.part();
  c.ellipse(cx + 8.6, 21.4 + U, 1.5, 1.1, PALE_SKIN);
  // Dust wheeling over her palm.
  for (let k = 0; k < 6; k++) {
    const a = ph + (k / 6) * Math.PI * 2;
    const x = cx + 8.6 + Math.cos(a) * 3.2;
    const y = 17.5 + U + Math.sin(a) * 1.3 - (k % 2) * 0.8;
    c.spark(x, y, k % 3 ? [180, 130, 255] : [240, 228, 255], Math.sin(a) > 0 ? 0.95 : 0.55);
  }

  // Her head: pale, silver hair in front, a gold circlet, eyes aglow.
  c.part();
  c.ellipse(cx, 11.6 + U, 3.1, 3.3, PALE_SKIN);
  c.part();
  c.shape(Math.round(8 + U), Math.round(9.6 + U), () => [cx - 3.5, cx + 3.5], SILVER, (_x, y, t) => sphere(t * 0.8, 0.5 - (y - 8) * 0.2, 1));
  c.capsule(cx - 3.4, 10 + U, cx - 3.8, 18 + U, 1.1, 1.3, SILVER);
  c.capsule(cx + 3.4, 10 + U, cx + 3.8, 18 + U, 1.1, 1.3, SILVER);
  c.part();
  for (let x = cx - 3; x <= cx + 3; x++) c.px(x, 9 + U, GOLD, sphere((x - cx) / 4, 0.3));
  c.part();
  c.px(cx, 8.6 + U, GEM_V, sphere(0, 0.4), { glow: 1 });
  c.part();
  c.px(cx - 1.5, 12 + U, EYE_GLOW);
  c.px(cx + 1.5, 12 + U, EYE_GLOW);
  c.shade(cx, 14 + U, -1);
  return c;
}

const SLATE: Material = { ramp: ramp('#10141f', '#1a2032', '#26304a', '#344362', '#46587e', '#5c729c'), outline: INK, outlineLit: hex('#222a40') };
const RUDDY: Material = { ramp: ramp('#5a2a26', '#944a3a', '#cc7a5a', '#eeaa82', '#fbd2b0'), outline: hex('#2a1210'), outlineLit: hex('#4a2420') };
const GINGER: Material = { ramp: ramp('#4a2412', '#7e3e1a', '#b4602a', '#dc8a44', '#f4ba78'), outline: hex('#200c06'), outlineLit: hex('#3a1a0c') };
const TROUSER: Material = { ramp: ramp('#140f0c', '#221a14', '#32261c', '#443426'), outline: INK };

/** Tharn the Runesmith, frame `f`: he breathes, lifts his hammer a touch, and its rune and his flare. */
export function runesmith(f: number): PixelCanvas {
  const c = new PixelCanvas(KEEPER_W, KEEPER_H);
  const cx = 14;
  const ph = (f / KEEPER_FRAMES) * Math.PI * 2;
  const U = Math.sin(ph) * 0.5;
  const pulse = 0.5 + 0.5 * Math.sin(ph);
  const lift = f === 2 || f === 3 ? -1 : 0;

  // Legs and boots.
  for (const s of [-1, 1]) {
    c.part();
    c.capsule(cx + s * 2.8, 28, cx + s * 3, 32, 2, 1.8, TROUSER);
    c.part();
    c.ellipse(cx + s * 3.2, 33.3, 2.6, 1.6, BOOT, { flatten: 0.8 });
  }
  // A broad body in a slate shirt, a leather apron over it.
  c.part();
  c.shape(17 + U, 29, (y) => {
    const u = (y - 17 - U) / (12 - U);
    const hw = 6.2 - u * 0.4 + Math.sin(u * Math.PI) * 0.6;
    return [cx - hw, cx + hw];
  }, SLATE, (_x, y, t) => sphere(t * 0.9, (21 - y) / 12, 1));
  c.part();
  c.shape(20 + U, 31, (y) => {
    const hw = 4.2 + (y - 20 - U) * 0.08;
    return [cx - hw, cx + hw];
  }, LEATHER, (_x, _y, t) => sphere(t * 0.8, 0.1, 1));
  for (const s of [-1, 1]) {
    c.part();
    c.capsule(cx + s * 3.6, 17.5 + U, cx + s * 3.4, 20.5 + U, 0.5, 0.5, LEATHER);
  }
  // The belt with its buckle, and the rune stitched on the apron.
  c.part();
  c.shape(Math.round(24 + U), Math.round(24 + U), () => [cx - 6.3, cx + 6.3], TROUSER, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(cx, 24 + U, GOLD, sphere(0, 0.2));
  c.part();
  for (const [x, y] of [
    [cx - 1, 27],
    [cx, 26],
    [cx + 1, 27],
    [cx, 28],
    [cx, 29],
  ]) c.px(x, y + U, GEM_G, sphere(0, 0), { glow: 0.3 + pulse * 0.5 });

  // His left arm hangs at his side, sleeve rolled to a thick forearm.
  c.part();
  c.capsule(cx - 6.2, 18.5 + U, cx - 7.4, 22 + U, 2.1, 1.9, SLATE);
  c.part();
  c.capsule(cx - 7.4, 22 + U, cx - 7.2, 25.5 + U, 1.7, 1.6, RUDDY);
  c.part();
  c.ellipse(cx - 7.1, 26.4 + U, 1.8, 1.7, RUDDY);

  // The rune hammer over his right shoulder.
  const hx = cx + 9;
  const hy = 8 + lift;
  c.part();
  c.capsule(cx + 7.6, 24 + U, hx - 0.5, hy + 3, 0.8, 0.8, STAFF);
  c.part();
  c.shape(hy - 3, hy + 3, (y) => [hx - 3.6 + (y > hy + 1 ? 0.4 : 0), hx + 3.6 - (y > hy + 1 ? 0.4 : 0)], IRON, (_x, y, t) => (y === hy - 3 ? top(t) : cyl(t, 0.2)), { bias: 1 });
  c.part();
  for (let y = hy - 2; y <= hy + 2; y++) {
    c.px(hx - 3, y, GOLD, cyl(-0.8, 0.2));
    c.px(hx + 2.6, y, GOLD, cyl(0.8, 0.2));
  }
  c.part();
  c.px(hx, hy - 1, GEM_G, front(0), { glow: 0.5 + pulse * 0.5 });
  c.px(hx - 1, hy, GEM_G, front(0), { glow: 0.5 + pulse * 0.5 });
  c.px(hx + 1, hy, GEM_G, front(0), { glow: 0.5 + pulse * 0.5 });
  c.px(hx, hy + 1, GEM_G, front(0), { glow: 0.5 + pulse * 0.5 });
  // His right arm, holding it.
  c.part();
  c.capsule(cx + 6.2, 18.5 + U, cx + 7.8, 21 + U, 2.1, 1.9, SLATE);
  c.part();
  c.capsule(cx + 7.8, 21 + U, cx + 7.8, 23.5 + U, 1.7, 1.6, RUDDY);
  c.part();
  c.ellipse(cx + 7.8, 24 + U, 1.8, 1.7, RUDDY);

  // The head: bald and broad, a rune glowing on the brow, a great braided beard.
  c.part();
  c.ellipse(cx, 11.8 + U, 3.7, 3.5, RUDDY);
  c.part();
  c.px(cx, 9 + U, GEM_G, sphere(0, 0.6), { glow: 0.5 + pulse * 0.5 });
  c.px(cx - 1, 9.6 + U, GEM_G, sphere(0, 0.6), { glow: 0.3 + pulse * 0.4 });
  c.px(cx + 1, 9.6 + U, GEM_G, sphere(0, 0.6), { glow: 0.3 + pulse * 0.4 });
  c.part();
  c.shape(13 + U, 25 + U, (y) => {
    const u = (y - 13 - U) / 12;
    const hw = u < 0.25 ? 4 + u * 3 : 4.75 - (u - 0.25) * 4.4;
    return hw > 0.6 ? [cx - hw, cx + hw] : null;
  }, GINGER, (_x, y, t) => sphere(t * 0.9, (17 - y) / 10, 1));
  for (let y = Math.ceil(16 + U); y < 24 + U; y++) {
    c.shade(cx - 1, y, -1);
    c.shade(cx + 1, y, -1);
  }
  c.part();
  for (let x = cx - 2; x <= cx + 2; x++) c.px(x, 21 + U, GOLD, sphere((x - cx) / 3, 0.1));
  c.part();
  c.shape(Math.round(13.6 + U), Math.round(13.6 + U), () => [cx - 3.4, cx + 3.4], GINGER, (_x, _y, t) => sphere(t * 0.8, 0.4, 1), { bias: 1 });
  c.part();
  for (const s of [-1, 1]) {
    c.px(cx + s * 1.5, 10.4 + U, GINGER, sphere(0, 0.5), { bias: 1 });
    c.px(cx + s * 2.5, 10.4 + U, GINGER, sphere(0, 0.5), { bias: 1 });
    c.px(cx + s * 1.6, 11.6 + U, EYE);
  }
  c.shade(cx, 12.6 + U, -1);
  return c;
}
