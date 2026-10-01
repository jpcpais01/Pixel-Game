// Tents, painted from their shape (see world/houses.ts): wall and roof in
// one, cloth rising straight from a pegged hem to a ridge pole, so any patch
// of tent cells is one tent. Its ridge runs the long way. A tent standing
// gable-on (a north-south ridge) shows both its side slopes and its front
// gable, a triangle with the door cut in it; one lying the long way
// (east-west) shows its long south slope, the door a flap opening in it.
// Every point of cloth is drawn as high as it stands, as roofs are, and lit
// by its slope in the colours and the normal map. Poles stand proud of the
// ridge at its ends, guy ropes run out to pegs (those behind the tent pass
// behind it), the door's flaps are tied back on a dim inside that glows
// warm at night, and a hem is laid flat on the ground to show where the
// cloth stood while the hero is inside and it has faded.
//
// Three cloths:
//   - canvas: sun-bleached cream canvas in sewn panels, weathered at the hem,
//     plain poles and hemp guy ropes;
//   - festival: red and cream stripes with a scalloped valance and gold
//     piping, pennants flying from the poles;
//   - ranger: hides stitched in patchwork, fur along the hem, crossed poles
//     at the ridge's ends hung with a feather charm.

import { bayer } from './bitmap';
import { hash2, valueNoise } from './env';
import { ramp } from './ground';
import { KEY_LIGHT, hex, type RGB, type Vec3 } from './pixel';
import { SOLID_NONE, type HouseSolid } from './homeWalls';
import { TENTS } from '../world/homeParts';
import { TENT_DOOR_HW, TENT_HEM, findHousesIn, tentHeight, type House } from '../world/houses';

/** The grid's cell (homeLayout's CELL). */
const CELL = 16;
/** Room round the footprint for the guy ropes and pegs, px. */
const MARGIN = 11;
/** Room over the ridge for the poles and their pennants, px. */
const OVER = 13;
/** How far the poles stand proud of the ridge, px. */
const POLE_UP = 4;
/** How far out from a pole its guy ropes are pegged, px (along, and to either side). */
const ROPE_OUT = 9;
const ROPE_SPREAD = 7;
/** How tall the door opening stands at most, px, and how much of the front's height it takes. */
const DOOR_H = 19;
const DOOR_OF = 0.72;
/** How steeply the slopes tilt their light. */
const PITCH = 0.8;
/** The front gable faces the viewer, like a wall's face. */
const GABLE: Vec3 = { x: 0, y: -0.42, z: 0.9 };

const CANVAS = ramp('#2e2619', '#463b28', '#615339', '#7d6d4c', '#998862', '#b4a37b', '#cbbb93', '#ddcfab', '#ece2c4');
const RED = ramp('#2c070b', '#480d12', '#69141a', '#8a1d20', '#a82828', '#c23a32', '#d65640', '#e67852');
const CREAM = ramp('#3e3424', '#5e5038', '#7e6e50', '#a0906c', '#bcae88', '#d4c8a4', '#e8dec0', '#f6f0dc');
const GOLD = ramp('#3a2408', '#5c3c0c', '#825a14', '#a8781e', '#c8962c', '#e0b444', '#f0d070');
const HIDES = [
  ramp('#26170c', '#3a2414', '#51341d', '#694527', '#815732', '#986a3e', '#ae7e4c'),
  ramp('#1c120b', '#2b1c12', '#3c281a', '#4f3623', '#62452d', '#755538', '#886644'),
  ramp('#2a1f14', '#3e2f1f', '#55422c', '#6b5639', '#826a47', '#987f57', '#ad9468'),
  ramp('#3a2412', '#563619', '#744a22', '#92602d', '#ad773a', '#c48f4c', '#d6a764'),
];
const FUR = ramp('#2e2822', '#48403a', '#645b52', '#82786c', '#a09586', '#bbb1a0', '#d2c9b8', '#e6dfd0');
const INSIDE = ramp('#0b0806', '#140e0a', '#1e150f', '#2a1d14', '#382819');
const WOOD = ramp('#1e1209', '#2e1d10', '#432b18', '#5a3b22', '#724c2d', '#8a5f39');
const ROPE: RGB = hex('#a08a62');
const ROPE_DARK: RGB = hex('#6c5a3c');
const PEG: RGB = hex('#3a2616');
const INK = hex('#0a080c');
/** The warm light of the inside through the door, at night. */
const EMBER: RGB = [255, 186, 104];

export interface TentArt {
  w: number;
  h: number;
  diffuse: Uint8ClampedArray<ArrayBuffer>;
  normal: Uint8ClampedArray<ArrayBuffer>;
  /** The inside's glow through the door, for the night. */
  glow: Uint8ClampedArray<ArrayBuffer>;
  /** Where its top-left sits on the grid (px). */
  x: number;
  y: number;
  /** The tent as a solid, for its sun shadow. */
  solid: HouseSolid;
  /** The hem laid flat on the ground: shown where the cloth stood while it's faded. */
  hem: { x: number; y: number; w: number; h: number; diffuse: Uint8ClampedArray<ArrayBuffer>; normal: Uint8ClampedArray<ArrayBuffer> };
}

/** A pixel's paint: its ramp, its place on it, and its normal. */
interface Paint {
  r: RGB[];
  idx: number;
  nx: number;
  ny: number;
  nz: number;
  glow: number;
}

/** Paint tent `h`; `kindAt` gives each cell's cloth (its index in TENTS, from 1). Grid px: cell (0, 0) at 0. */
export function paintTent(kindAt: (cx: number, cy: number) => number, h: House): TentArt {
  const cloth = TENTS[Math.max(0, kindAt(h.cells[0].x, h.cells[0].y) - 1)]?.id ?? 'canvas';
  const fx0 = h.x0 * CELL - MARGIN;
  const fy0 = h.y0 * CELL - MARGIN;
  const FW = (h.x1 - h.x0 + 1) * CELL + MARGIN * 2;
  const FH = (h.y1 - h.y0 + 1) * CELL + MARGIN * 2;
  // Heights over the footprint (0 off it), sampled at each pixel's middle.
  const hgt = new Float32Array(FW * FH);
  const inside = new Uint8Array(FW * FH);
  let top = 0;
  for (let y = 0; y < FH; y++) {
    for (let x = 0; x < FW; x++) {
      const gx = x + fx0;
      const gy = y + fy0;
      if (!h.has(Math.floor(gx / CELL), Math.floor(gy / CELL))) continue;
      const i = y * FW + x;
      inside[i] = 1;
      hgt[i] = tentHeight(h, gx + 0.5, gy + 0.5);
      top = Math.max(top, hgt[i]);
    }
  }
  const lift = Math.ceil(top) + OVER;
  const W = FW;
  const HH = FH + lift;
  const diffuse = new Uint8ClampedArray(W * HH * 4);
  const normal = new Uint8ClampedArray(W * HH * 4);
  const glow = new Uint8ClampedArray(W * HH * 4);
  const L = KEY_LIGHT;
  const Ll = Math.hypot(L.x, L.y, L.z);
  const flat = L.z / Ll;
  const hAt = (x: number, y: number) => (x < 0 || y < 0 || x >= FW || y >= FH ? 0 : hgt[y * FW + x]);
  const isIn = (x: number, y: number) => x >= 0 && y >= 0 && x < FW && y < FH && inside[y * FW + x] === 1;
  const door = h.door ? { x: h.door.x - fx0, y: h.door.y - fy0 } : null;
  // The door's height: of the gable's front, or of a slope lying the long way.
  const doorTop = !door ? 0 : Math.min(DOOR_H, (h.ns ? hAt(Math.round(door.x - 0.5), door.y - 1) : top) * DOOR_OF);
  // How wide the door opening is at height z above the ground (a tall narrow triangle, rounded at its foot).
  const doorHalf = (z: number) => (z >= doorTop ? -1 : (TENT_DOOR_HW + 0.5) * Math.pow(1 - z / doorTop, 0.85));
  // The ridge's line: the middle across the tent.
  const ridgeX = ((h.x0 + h.x1 + 1) * CELL) / 2 - fx0;
  const ridgeY = ((h.y0 + h.y1 + 1) * CELL) / 2 - fy0;

  const put = (x: number, sy: number, p: Paint) => {
    if (sy < 0 || sy >= HH) return;
    const nl = Math.hypot(p.nx, p.ny, p.nz);
    const nx = p.nx / nl;
    const ny = p.ny / nl;
    const nz = p.nz / nl;
    const idx = p.idx + ((nx * L.x + ny * L.y + nz * L.z) / Ll - flat) * 3.2;
    const c = p.r[Math.max(0, Math.min(p.r.length - 1, Math.floor(idx + bayer(x, sy) * 0.8)))];
    const o = (sy * W + x) * 4;
    diffuse[o] = c[0];
    diffuse[o + 1] = c[1];
    diffuse[o + 2] = c[2];
    diffuse[o + 3] = 255;
    normal[o] = Math.round(nx * 127.5 + 127.5);
    normal[o + 1] = Math.round(ny * 127.5 + 127.5);
    normal[o + 2] = Math.round(nz * 127.5 + 127.5);
    normal[o + 3] = 255;
    glow[o] = Math.round(EMBER[0] * p.glow);
    glow[o + 1] = Math.round(EMBER[1] * p.glow);
    glow[o + 2] = Math.round(EMBER[2] * p.glow);
    glow[o + 3] = p.glow > 0 ? 255 : 0;
  };

  /**
   * The cloth at grid point (X, Y), `z` px up, on a surface facing (nx, ny,
   * nz); `face`: on the front gable (else a slope). `across`: how far from
   * the ridge's line, px.
   */
  const paint = (X: number, Y: number, z: number, sy: number, nx: number, ny: number, nz: number, face: boolean): Paint => {
    const p: Paint = { r: CANVAS, idx: 4.6, nx, ny, nz, glow: 0 };
    // Shade gathers low by the ground.
    const low = Math.max(0, 3 - z) * 0.35;
    if (cloth === 'canvas') {
      // Sewn panels: a seam every few px, darker with its stitching; the weave's grain; weathering up from the hem.
      const seam = (((X - Math.round(ridgeX + fx0)) % 11) + 11) % 11;
      p.idx += (hash2(X, Y + (face ? 977 : 0), 1201) - 0.5) * 0.7 + (valueNoise(X, sy, 9, 1203) - 0.5) * 0.9;
      if (seam === 0) p.idx -= 1.3;
      else if (seam === 1) p.idx += 0.3;
      const stain = valueNoise(X, sy, 6, 1205) * 4 - z * 0.45;
      if (stain > 1.4) p.idx -= Math.min(1.6, (stain - 1.4) * 1.2);
    } else if (cloth === 'festival') {
      const SW = 6;
      const u = X - (Math.round(ridgeX + fx0) - SW / 2);
      const k = Math.floor(u / SW);
      const v = ((u % SW) + SW) % SW;
      const red = (k & 1) === 0;
      p.r = red ? RED : CREAM;
      p.idx = red ? 4.4 : 4.6;
      // A rounded fold down each stripe.
      p.nx += Math.cos(((v + 0.5) / SW) * Math.PI) * 0.18;
      p.idx += (hash2(X, Y, 1207) - 0.5) * 0.5;
      // The valance: scallops along the hem in the other stripe's colour, edged in gold piping.
      const scallop = 4.2 - Math.sin(((v + 0.5) / SW) * Math.PI) * 2.6;
      if (z < scallop) {
        p.r = red ? CREAM : RED;
        p.idx = 4 - (scallop - z) * 0.25;
        if (scallop - z < 0.9) {
          p.r = GOLD;
          p.idx = 4.2;
        }
      } else if (z < 5.4) {
        p.r = GOLD;
        p.idx = 3.6 + (hash2(X, 3, 1209) - 0.5) * 0.6;
      }
    } else {
      // Hides in patchwork: each patch its own leather, stitched at its edges.
      const cw = 9;
      const ch = 7;
      const px = X / cw;
      const py = sy / ch;
      let d1 = 1e9;
      let d2 = 1e9;
      let id = 0;
      for (let j = Math.floor(py) - 1; j <= Math.floor(py) + 1; j++) {
        for (let i = Math.floor(px) - 1; i <= Math.floor(px) + 1; i++) {
          const ox = i + 0.2 + hash2(i, j, 1211) * 0.6;
          const oy = j + 0.2 + hash2(i, j, 1213) * 0.6;
          const d = Math.hypot((px - ox) * cw, (py - oy) * ch);
          if (d < d1) {
            d2 = d1;
            d1 = d;
            id = Math.floor(hash2(i, j, 1215) * HIDES.length);
          } else if (d < d2) d2 = d;
        }
      }
      p.r = HIDES[id];
      p.idx = 3.8 + (valueNoise(X, sy, 4, 1217) - 0.5) * 1.4 + (hash2(X, sy, 1219) - 0.5) * 0.5;
      if (d2 - d1 < 1.1) {
        // The seam, and its stitches across it every other pixel.
        p.idx -= 2.2;
        if ((X + sy) % 3 === 0) {
          p.r = HIDES[2];
          p.idx = 5.2;
        }
      }
      // Fur along the hem, ragged at its top.
      const fur = 3.2 + hash2(X, 7, 1221) * 2.2;
      if (z < fur) {
        p.r = FUR;
        p.idx = 4.2 + (hash2(X, sy, 1223) - 0.5) * 2.2 - (fur - z < 1 ? 0.8 : 0);
        p.nz += 0.3;
      }
    }
    p.idx -= low;
    return p;
  };

  /** The door's opening at grid point (X), `z` px up: the dim inside, the flaps tied back either side of it, or neither. */
  const doorway = (X: number, z: number, p: Paint): Paint => {
    if (!door) return p;
    const half = doorHalf(z);
    const dx = Math.abs(X - fx0 + 0.5 - door.x);
    if (half > 0 && dx < half) {
      // The dark inside, a little lighter low down where the floor catches the day; it glows at night.
      return { r: INSIDE, idx: 1.4 + Math.max(0, 3 - z) * 0.4 + (z < 2 ? 0.6 : 0), nx: 0, ny: -0.2, nz: 1, glow: 0.2 + 0.28 * Math.max(0, 1 - z / doorTop) };
    }
    // The flaps, folded back off the opening: lighter where they turn, a tie across them half way up.
    if (half > 0 && dx < half + 2.6 && z < doorTop - 1) {
      const fold = dx - half;
      const q = { ...p, idx: p.idx + (fold < 1.2 ? 1.2 : 0.4), nx: p.nx + (X - fx0 < door.x ? -0.35 : 0.35) };
      if (Math.abs(z - doorTop * 0.45) < 0.8) return { ...q, r: [ROPE_DARK, ROPE, ROPE], idx: fold < 1.5 ? 2 : 1 };
      return q;
    }
    return p;
  };

  // The cloth, a column at a time: each point of the footprint drawn as high as it stands; at the front of a column, the gable face down to the ground.
  const groundRow = (y: number) => y + lift;
  for (let x = 0; x < FW; x++) {
    let prev = -1;
    for (let y = 0; y < FH; y++) {
      if (!isIn(x, y)) continue;
      const hh = hAt(x, y);
      const gx = (hAt(x + 1, y) - hAt(x - 1, y)) / 2;
      const gy = (isIn(x, y + 1) ? hAt(x, y + 1) : hh) - (isIn(x, y - 1) ? hAt(x, y - 1) : hh);
      const X = x + fx0;
      const Y = y + fy0;
      const sy = groundRow(y) - Math.round(hh);
      let p = paint(X, Y, hh, sy, -gx * PITCH, (gy / 2) * PITCH, 1, false);
      // The cloth is pulled taut and catches more light toward the ridge.
      p.idx += (hh / Math.max(1, top) - 0.5) * 0.9;
      // The ridge: the cloth turns over its pole.
      const crease = h.ns ? Math.abs(x + 0.5 - ridgeX) < 1 : Math.abs(y + 0.5 - ridgeY) < 1;
      if (crease && hh > 4) {
        if (cloth === 'festival') p = { ...p, r: GOLD, idx: 4.6 };
        else if (cloth === 'ranger') p = { ...p, r: WOOD, idx: 3.4 };
        else p = { ...p, idx: p.idx - 0.9 };
        p.nx = 0;
        p.ny = 0.35;
      }
      // The door, in a slope lying the long way.
      if (!h.ns && door && Math.abs(Y - fy0 - door.y) < CELL) p = doorway(X, hh, p);
      const from = prev < 0 ? sy : Math.min(sy, prev + 1);
      for (let yy = from; yy <= sy; yy++) put(x, yy, p);
      prev = Math.max(prev, sy);
      // The front: where the cloth ends over open ground, a gable face standing down to it.
      if (!isIn(x, y + 1) && hh > 0.6) {
        const g = groundRow(y);
        for (let yy = sy + 1; yy <= g; yy++) {
          const z = g - yy;
          let q = paint(X, Y, z, yy, GABLE.x, GABLE.y, GABLE.z, true);
          // The gable's edge under the slope's overhang is in shade.
          if (yy - sy < 2) q = { ...q, idx: q.idx - (yy - sy < 1.5 ? 2.2 : 1.1) };
          q = doorway(X, z, q);
          put(x, yy, q);
        }
        prev = Math.max(prev, g);
      }
    }
  }

  // An outline all round the cloth.
  const solidPx = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < HH && diffuse[(y * W + x) * 4 + 3] > 0;
  const rim: number[] = [];
  for (let y = 0; y < HH; y++) for (let x = 0; x < W; x++) if (!solidPx(x, y) && (solidPx(x - 1, y) || solidPx(x + 1, y) || solidPx(x, y - 1) || solidPx(x, y + 1))) rim.push(y * W + x);
  const ink = (i: number, c: RGB) => {
    const o = i * 4;
    diffuse[o] = c[0];
    diffuse[o + 1] = c[1];
    diffuse[o + 2] = c[2];
    diffuse[o + 3] = 255;
    normal[o] = 128;
    normal[o + 1] = 128;
    normal[o + 2] = 255;
    normal[o + 3] = 255;
  };
  for (const i of rim) ink(i, INK);

  // Poles, guy ropes and pegs. A rope or peg behind the cloth only shows where the cloth doesn't.
  const dot = (x: number, y: number, c: RGB, behind: boolean) => {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= W || yi >= HH) return;
    if (behind && solidPx(xi, yi)) return;
    ink(yi * W + xi, c);
  };
  const line = (x0: number, y0: number, x1: number, y1: number, c: RGB, behind: boolean) => {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let s = 0; s <= n; s++) dot(x0 + ((x1 - x0) * s) / n, y0 + ((y1 - y0) * s) / n, c, behind);
  };
  const peg = (gx: number, gy: number, behind: boolean) => {
    const sy = groundRow(gy);
    dot(gx, sy, PEG, behind);
    dot(gx, sy - 1, ROPE_DARK, behind);
  };
  /** A pole's end at ground point (gx, gy) (the ridge's end), standing proud of the ridge, with its ropes out `way` (a unit step on the ground). */
  const pole = (gx: number, gy: number, way: { x: number; y: number }, behind: boolean, flag = true) => {
    const ridge = hAt(Math.round(gx - (way.x > 0 ? 1 : 0)), Math.round(gy - (way.y > 0 ? 1 : 0)));
    const base = groundRow(gy) - Math.round(Math.max(ridge, top * 0.9));
    const tip = base - POLE_UP;
    const side = { x: -way.y, y: way.x };
    // The ropes from the pole's tip out to two pegs.
    for (const s of [-1, 1]) {
      const px = gx + way.x * ROPE_OUT + side.x * s * ROPE_SPREAD;
      const py = gy + way.y * ROPE_OUT + side.y * s * ROPE_SPREAD;
      const back = behind || py < gy - 0.5;
      line(gx, tip + 1, px, groundRow(py) - 1, back ? ROPE_DARK : ROPE, back);
      peg(px, py, back);
    }
    if (cloth === 'ranger') {
      // Two poles crossed over the ridge, lashed where they cross, a feather charm hanging.
      const a = h.ns ? 3 : 2;
      line(gx - a, base + 2, gx + a, tip - 3, WOOD[3], false);
      line(gx + a, base + 2, gx - a, tip - 3, WOOD[4], false);
      dot(gx, base - 1, ROPE, false);
      dot(gx + 1, base + 1, ROPE_DARK, false);
      dot(gx + 1, base + 2, hex('#e8e0cc'), false);
      dot(gx + 1, base + 3, hex('#b4483a'), false);
      return;
    }
    line(gx, base + 1, gx, tip, WOOD[3], false);
    dot(gx, tip - 1, cloth === 'festival' ? GOLD[5] : WOOD[5], false);
    if (cloth === 'festival' && flag) {
      // A pennant on a short staff, its tail lifting.
      line(gx, tip - 1, gx, tip - 6, WOOD[2], false);
      const flag = [hex('#d63a32'), hex('#f0c040')];
      for (let k = 0; k < 6; k++) {
        const hgtK = Math.max(1, Math.round(3 - k * 0.5));
        for (let j = 0; j < hgtK; j++) dot(gx + 1 + k, tip - 6 + j + (k > 3 ? 1 : 0), flag[k < 3 ? 0 : 1], false);
      }
    }
  };
  if (h.ns) {
    const south = (h.y1 + 1) * CELL - fy0;
    const north = h.y0 * CELL - fy0;
    // The back pole first, so the front's ropes cross over anything of it.
    if (h.has(Math.floor((ridgeX - 0.5 + fx0) / CELL), h.y0)) pole(ridgeX - 0.5, north, { x: 0, y: -1 }, true);
    // The front pole stands against the slopes behind it: a finial, no pennant to clutter them.
    if (door) pole(door.x - 0.5, south - 0.5, { x: 0, y: 1 }, false, false);
  } else {
    const west = h.x0 * CELL - fx0;
    const east = (h.x1 + 1) * CELL - fx0;
    pole(west, ridgeY - 0.5, { x: -1, y: 0 }, false);
    pole(east - 1, ridgeY - 0.5, { x: 1, y: 0 }, false);
  }

  // The tent as a solid: cloth from the ground up to its height.
  const n = FW * FH;
  const sBase = new Uint8Array(n).fill(SOLID_NONE);
  const sTop = new Uint8Array(n).fill(SOLID_NONE);
  for (let i = 0; i < n; i++) {
    if (!inside[i]) continue;
    sBase[i] = 0;
    sTop[i] = Math.max(1, Math.round(hgt[i]));
  }

  // The hem on the ground: a band of the cloth round the edge, open at the door, a peg at each corner.
  const hd = new Uint8ClampedArray(FW * FH * 4);
  const hn = new Uint8ClampedArray(FW * FH * 4);
  for (let y = 0; y < FH; y++) {
    for (let x = 0; x < FW; x++) {
      if (!isIn(x, y)) continue;
      const edge = !isIn(x - 2, y) || !isIn(x + 2, y) || !isIn(x, y - 2) || !isIn(x, y + 2);
      if (!edge) continue;
      if (door && Math.abs(x + 0.5 - door.x) < TENT_DOOR_HW && y >= door.y - TENT_HEM - 1) continue;
      const outer = !isIn(x - 1, y) || !isIn(x + 1, y) || !isIn(x, y - 1) || !isIn(x, y + 1);
      const p = paint(x + fx0, y + fy0, outer ? 0.5 : 1.6, y, 0, outer ? -0.3 : 0.2, 1, false);
      const c = p.r[Math.max(0, Math.min(p.r.length - 1, Math.floor(p.idx - (outer ? 1.6 : 0.6) + bayer(x, y) * 0.8)))];
      const o = (y * FW + x) * 4;
      hd.set([c[0], c[1], c[2], 255], o);
      hn.set([128, Math.round((outer ? -0.3 : 0.2) * 127.5 + 127.5), 250, 255], o);
    }
  }

  // The texture is one pixel wider all round for the outline: shift into a padded copy.
  const PW = W + 2;
  const PH = HH + 2;
  const pad = (src: Uint8ClampedArray<ArrayBuffer>) => {
    const out = new Uint8ClampedArray(PW * PH * 4);
    for (let y = 0; y < HH; y++) out.set(src.subarray(y * W * 4, (y + 1) * W * 4), ((y + 1) * PW + 1) * 4);
    return out;
  };
  return {
    w: PW,
    h: PH,
    diffuse: pad(diffuse),
    normal: pad(normal),
    glow: pad(glow),
    x: fx0 - 1,
    y: fy0 - lift - 1,
    solid: { x: fx0, y: fy0, w: FW, h: FH, base: sBase, top: sTop },
    hem: { x: fx0, y: fy0, w: FW, h: FH, diffuse: hd, normal: hn },
  };
}

/** A tent's sample for the build palette: a little one of its cloth, `size` px square. */
export function tentSwatch(kind: number, size: number): Uint8ClampedArray<ArrayBuffer> {
  const art = paintTent(() => kind, findHousesIn([], [{ x: 0, y: 0 }]).houses[0]);
  const out = new Uint8ClampedArray(size * size * 4);
  // Its foot near the bottom of the sample, the ropes cropped off its sides.
  const ox = Math.round((art.w - size) / 2);
  const oy = art.h - size - (MARGIN - 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = x + ox;
      const sy = y + oy;
      if (sx < 0 || sy < 0 || sx >= art.w || sy >= art.h) continue;
      out.set(art.diffuse.subarray((sy * art.w + sx) * 4, (sy * art.w + sx) * 4 + 4), (y * size + x) * 4);
    }
  }
  return out;
}
