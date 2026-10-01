// A Home's walls and roofs (see world/homeLayout.ts and world/Home.ts).
//
// Walls: each wall cell is drawn as the pieces of wall standing on it, seen
// from the game's high three-quarter view: a post in the middle of the cell
// and an arm out to each wall beside it, so runs, corners and crossings all
// join up. What shows is each piece's top and, where nothing carries on
// south of it, its face. A cell's picture is one frame per material, per
// which neighbours it joins (16), per kind: two plain walls to break up long
// runs, a doorway (or garden gate) and a window. Window glass and the lit
// hall seen through a doorway glow, and the world shows that glow at night.
//
// Roofs: one picture per house, painted when the layout changes. Its height
// is the distance in from the eaves, so any shape of house gets a hipped
// roof: slopes rising from every edge to ridges and hips where they meet,
// lit by their slope, laid in courses that follow the eaves. The whole roof
// is lifted by the walls' height, so it sits on them and hides the rooms.

import { bayer } from './bitmap';
import { hash2, valueNoise } from './env';
import { ramp } from './ground';
import { KEY_LIGHT, PixelCanvas, hex, sphere, type Material, type RGB, type Vec3 } from './pixel';
import { fbm } from './spirit';
import { BUSH, FIELDSTONE, HEARTH, IRON, doorway } from './sanctum';
import { CELL, DOOR_HW, doorAcross, wallBoxes, type House, type HomeLayout, COLS, cellIndex, inPlot } from '../world/homeLayout';
import { ROOFS, WALLS, type WallKind } from '../world/homeParts';

// ---------------------------------------------------------------- Materials

const PLASTER: Material = { ramp: ramp('#4a4034', '#6a5e4e', '#8e8270', '#aea290', '#c8bca6', '#dcd2bc', '#ece4d0', '#f8f2e2'), outline: hex('#1a140e'), outlineLit: hex('#4a3e30') };
const BEAM: Material = { ramp: ramp('#150d08', '#22150c', '#321f12', '#452b19', '#5a3920', '#704828'), outline: hex('#0a0604') };
const LOG: Material = { ramp: ramp('#1a0f08', '#2a190d', '#3d2514', '#52331c', '#684325', '#80552f', '#9a693c'), outline: hex('#0c0704') };
const CHINK: Material = { ramp: ramp('#3a3226', '#5a4e3c', '#7a6c54', '#9a8a6c'), outline: hex('#0c0704') };
const BRICK: Material = { ramp: ramp('#2a0f0b', '#421711', '#5c2118', '#772b1e', '#903826', '#a84830', '#be5c3e', '#d27450'), outline: hex('#140806'), outlineLit: hex('#3e1810') };
const BRICK_MORTAR: Material = { ramp: ramp('#4a4238', '#665c50', '#827868', '#9c9280', '#b4aa96'), outline: hex('#140806') };
const COPING: Material = { ramp: ramp('#2c2a2e', '#3e3b40', '#524e54', '#68636a', '#807a82', '#9a949a', '#b4aeb2'), outline: hex('#121014'), outlineLit: hex('#34303a') };
const HEDGE: Material = { ramp: ramp('#0c1f0e', '#133016', '#1c421d', '#275727', '#346d31', '#46863c', '#5ea04a', '#7cb85c'), outline: hex('#061006'), outlineLit: hex('#12260f') };
const PICKET: Material = { ramp: ramp('#34343e', '#5a5a64', '#84848c', '#aeaeb2', '#d0d0cc', '#e8e6e0', '#f8f6f0'), outline: hex('#16161c'), outlineLit: hex('#40404a') };
const GLASS: Material = { ramp: ramp('#0c1a2a', '#14283e', '#1e3a54', '#2c506c', '#406a86', '#5e8aa4', '#8cb2c8', '#c4dcea'), outline: hex('#06080c'), noAO: true };
const FRAME: Material = { ramp: ramp('#1e140c', '#2e1f12', '#42301c', '#5a4428', '#745a36', '#8e7046'), outline: hex('#0c0704') };
const DOOR_WOOD: Material = { ramp: ramp('#1e0f08', '#30190d', '#442414', '#5a311b', '#723f23', '#8a4f2c'), outline: hex('#0c0604') };
const MOSSY: Material = BUSH;

const WARM: RGB = [255, 190, 110];
const INNER: RGB = [255, 214, 150];

/** Normals: a wall's face turned toward the viewer, and its top. */
const FACE: Vec3 = { x: 0, y: -0.42, z: 0.9 };
const TOP: Vec3 = { x: 0, y: 0.35, z: 0.94 };

/** The tallest wall, for canvases that fit any material. */
export const WALL_MAX_H = Math.max(...WALLS.map((w) => w.height));
/** Each material's frames: 16 wide, the cell plus the wall's height above it. The cell's top is `height` px down. */
export const wallFrameH = (mat: number): number => CELL + WALLS[mat].height;

/** What a wall pixel is made of and how it sits. */
interface Paint {
  m: Material;
  n: Vec3;
  bias: number;
}
const P: Paint = { m: FIELDSTONE, n: FACE, bias: 0 };
const set = (m: Material, n: Vec3, bias: number): Paint => {
  P.m = m;
  P.n = n;
  P.bias = bias;
  return P;
};

// ---------------------------------------------------------------- Faces

/**
 * A pixel of a wall's face: `x` across its cell (0..15), `z` up from the
 * ground (0 at the foot), `gx` the same column across the whole plot so
 * courses line up from cell to cell, `v` the variant.
 */
function face(mat: string, x: number, z: number, H: number, gx: number, v: number, cx: number): Paint | null {
  switch (mat) {
    case 'stone': {
      // Rough courses of fieldstone, each block its own tone, dark mortar, moss low down.
      const row = Math.floor(z / 5);
      const lz = z - row * 5;
      const off = Math.floor(hash2(row, cx, 701) * 9);
      const bw = 6 + Math.floor(hash2(Math.floor((gx + off) / 8), row, 703) * 3) * 2;
      const lx = (gx + off) % bw;
      const block = hash2(Math.floor((gx + off) / bw), row + v * 31, 705);
      if (z < 3 && fbm(gx, z, 5, 707, 2) > 0.52) return set(MOSSY, FACE, z < 1 ? -1 : 0);
      let b = Math.round((block - 0.5) * 2.4 + (valueNoise(gx, z, 4, 709) - 0.5) * 1.2);
      if (lz === 4 || lx === 0) b = -3;
      else if (lz === 0) b += 1;
      if (z > H - 3) b += 1;
      return set(FIELDSTONE, FACE, b);
    }
    case 'timber': {
      // Cream plaster between dark oak: a sill beam, a wall plate, posts, and a brace in one variant.
      if (z < 2) return set(BEAM, FACE, z === 1 ? 1 : 0);
      if (z >= H - 3) return set(BEAM, z === H - 1 ? TOP : FACE, z === H - 1 ? 2 : z === H - 3 ? -1 : 1);
      if (x === 0 || x === 1) return set(BEAM, FACE, x === 0 ? 1 : 0);
      const mid = Math.round(H * 0.52);
      if (z === mid || z === mid + 1) return set(BEAM, FACE, z === mid + 1 ? 1 : -1);
      if (v === 1) {
        // A brace from the post's foot up across the lower panel.
        const t = (x - 2) / 13;
        const bz = 2 + t * (mid - 2);
        if (Math.abs(z - bz) < 1.1) return set(BEAM, FACE, z > bz ? 0 : 1);
      }
      const stain = valueNoise(gx, z, 6, 711) + (hash2(gx, z, 713) - 0.5) * 0.3;
      let b = Math.round((stain - 0.55) * 2.2);
      if (z === 2 || z === mid + 2) b -= 2;
      if (x === 2) b -= 1;
      return set(PLASTER, FACE, b + 1);
    }
    case 'logs': {
      // Stacked logs, rounded, with pale chinking between them.
      const row = Math.floor(z / 5);
      const lz = z - row * 5;
      if (lz === 4) return set(CHINK, FACE, hash2(gx, row, 721) > 0.8 ? -1 : 0);
      const a = ((lz + 0.5) / 4) * Math.PI;
      const n: Vec3 = { x: 0, y: -Math.cos(a) * 0.8 - 0.1, z: Math.sin(a) * 0.8 + 0.25 };
      const grain = hash2(gx >> 1, row * 5 + lz, 723) > 0.82 ? -1 : 0;
      return set(LOG, n, grain + Math.round((hash2(row, cx, 725) - 0.5) * 1.4));
    }
    case 'brick': {
      // Red brick in stretcher bond, a stone band along the top.
      if (z >= H - 3) return set(COPING, z === H - 1 ? TOP : FACE, z === H - 1 ? 2 : 0);
      const row = Math.floor(z / 3);
      const lz = z - row * 3;
      const off = row % 2 ? 3 : 0;
      const lx = (gx + off) % 6;
      if (lz === 2 || lx === 0) return set(BRICK_MORTAR, FACE, 1);
      const t = hash2(Math.floor((gx + off) / 6), row + v * 17, 731);
      return set(BRICK, FACE, Math.round((t - 0.5) * 2.6) + (lz === 0 ? 1 : 0) + (z < 3 ? -1 : 0));
    }
    case 'hedge':
      return leafy(gx, z * 1.3 + 50, FACE, z < 2 ? -1 : 0);
    case 'lowwall': {
      // Two courses of rounded stones under a cap of bigger, domed ones.
      if (z >= H - 4) {
        const w = 5;
        const lx = (gx + 2) % w;
        const d = Math.hypot((lx - w / 2 + 0.5) / (w / 2), (z - (H - 2.5)) / 2);
        if (d > 1.1) return null;
        return set(FIELDSTONE, sphere((lx - w / 2 + 0.5) / (w / 2), (z - (H - 2.5)) / -2.2, 0.8), 1 + Math.round((hash2(Math.floor((gx + 2) / w), 3, 741) - 0.5) * 2));
      }
      const row = Math.floor(z / 3);
      const lz = z - row * 3;
      const off = row % 2 ? 2 : 0;
      const lx = (gx + off) % 4;
      if (lz === 2 || lx === 0) return set(z < 3 && hash2(gx, z, 743) > 0.4 ? MOSSY : FIELDSTONE, FACE, -3);
      return set(FIELDSTONE, FACE, Math.round((hash2(Math.floor((gx + off) / 4), row, 745) - 0.5) * 2));
    }
    default:
      return null;
  }
}

/** Leaves: clumps with their own round normals, lighter where they catch the sun. */
function leafy(x: number, y: number, base: Vec3, bias: number): Paint {
  const G = 4;
  const gx = Math.floor(x / G);
  const gy = Math.floor(y / G);
  let best = -1;
  let n: Vec3 = base;
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const cx = gx + ox;
      const cy = gy + oy;
      const sx = (cx + 0.5 + (hash2(cx, cy, 751) - 0.5) * 0.7) * G;
      const sy = (cy + 0.5 + (hash2(cx, cy, 753) - 0.5) * 0.7) * G;
      const r = 3 + hash2(cx, cy, 755);
      const dx = (x + 0.5 - sx) / r;
      const dy = (y + 0.5 - sy) / r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= 1) continue;
      const z = hash2(cx, cy, 757) * 0.4 + Math.sqrt(1 - d2);
      if (z > best) {
        best = z;
        n = sphere(dx, dy, 0.9);
      }
    }
  }
  if (best < 0) return set(HEDGE, base, bias - 2);
  const tip = hash2(Math.floor(x), Math.floor(y), 759) > 0.86 ? 1 : 0;
  return set(HEDGE, { x: n.x * 0.7 + base.x * 0.3, y: n.y * 0.7 + base.y * 0.3, z: n.z * 0.7 + base.z * 0.3 }, bias + tip);
}

/** A pixel of a wall's top, at (x, y) in its cell. */
function top(mat: string, x: number, y: number, gx: number, gy: number, across: boolean): Paint {
  switch (mat) {
    case 'stone': {
      const along = across ? gx : gy;
      const b = along % 5 === 0 ? -2 : Math.round((hash2(Math.floor(along / 5), 0, 761) - 0.5) * 2) + 1;
      return set(FIELDSTONE, TOP, b + 1);
    }
    case 'timber':
      return set(BEAM, TOP, 2 + (hash2(across ? gx >> 2 : gy >> 2, 1, 763) > 0.6 ? 1 : 0));
    case 'logs': {
      const t = across ? (y - 5) / 6 : (x - 5) / 6;
      const n: Vec3 = across ? { x: 0, y: (t - 0.5) * -1.2, z: 0.8 } : { x: (t - 0.5) * 1.2, y: 0.2, z: 0.8 };
      return set(LOG, n, 1 + (hash2(across ? gx >> 1 : gy >> 1, 2, 765) > 0.8 ? -1 : 0));
    }
    case 'brick':
      return set(COPING, TOP, 2 + ((across ? gx : gy) % 8 === 0 ? -2 : 0));
    case 'hedge':
      return leafy(gx, gy, TOP, 1);
    case 'fence':
      return set(PICKET, TOP, 2);
    default: {
      const along = across ? gx : gy;
      return set(FIELDSTONE, sphere(0, 0, 1), 2 + (along % 5 === 0 ? -2 : 0));
    }
  }
}

// ---------------------------------------------------------------- A wall cell

/**
 * One wall cell: material `mat`, joined to the neighbours in `mask` (bits for
 * north, east, south, west), of kind `kind`, variant `v`. The canvas is 16 x
 * (16 + height); the cell itself fills its bottom 16 rows. A `bare` doorway
 * leaves out the door standing open in it, for a door hung there (art/homeDoor.ts).
 */
export function wallFrame(mat: number, mask: number, kind: WallKind, v: number, bare = false): PixelCanvas {
  const def = WALLS[mat];
  const H = def.height;
  const c = new PixelCanvas(CELL, CELL + H);
  const boxes = wallBoxes(mask, def.thick);
  const across = doorAcross(mask);
  const gx0 = v * 16;
  // Is (x, y) of the cell under the wall's footprint?
  const inside = (x: number, y: number) => boxes.some((b) => x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1);
  // A doorway (or gate) running across, or along, the wall; a window's pane.
  const door = kind === 'door';
  const gap = (x: number, y: number) => door && (across ? Math.abs(x + 0.5 - 8) < DOOR_HW : Math.abs(y + 0.5 - 8) < DOOR_HW);

  if (def.id === 'fence') return fenceFrame(c, mask, door, H);

  // Faces first: every column whose footprint ends inside this cell shows its face below it.
  c.part();
  for (let x = 0; x < CELL; x++) {
    let ys = -1;
    for (let y = 0; y < CELL; y++) if (inside(x, y)) ys = y + 1;
    if (ys < 0 || ys >= CELL) continue;
    for (let z = 0; z < H; z++) {
      const cy = ys + H - 1 - z;
      if (door && across && Math.abs(x + 0.5 - 8) < DOOR_HW) {
        // The doorway: a lit hall seen through an arch for a house, an open gap for a garden gate.
        const archTop = H - 7;
        const dx = Math.abs(x + 0.5 - 8);
        const inArch = z < archTop - 3 || Math.hypot(dx, z - (archTop - 3)) < DOOR_HW;
        if (!def.house) continue;
        if (inArch) {
          // The door itself stands open against the west jamb.
          if (!bare && x < 8 - DOOR_HW + 2 && z < archTop - 2) c.px(x, cy, DOOR_WOOD, { x: 0.5, y: -0.2, z: 0.85 }, { bias: x === 8 - DOOR_HW ? 1 : 0 });
          else doorway(c, x, cy, dx, 1 - z / archTop, z);
          continue;
        }
        // Voussoirs round the arch.
        if (Math.hypot(dx, z - (archTop - 3)) < DOOR_HW + 2 && z >= archTop - 4) {
          const a = Math.atan2(z - (archTop - 3), x + 0.5 - 8);
          const seam = Math.abs(((a / Math.PI) * 5) % 1) < 0.18;
          c.px(x, cy, def.id === 'stone' || def.id === 'brick' ? FIELDSTONE : BEAM, FACE, { bias: seam ? -2 : 2 });
          continue;
        }
      }
      if (kind === 'window' && across && def.house) {
        const wx = x + 0.5 - 8;
        const wz = z - H * 0.45;
        if (Math.abs(wx) < 5 && wz > -5 && wz < 6) {
          const edge = Math.abs(wx) > 4 || wz < -4 || wz > 5;
          if (edge) {
            c.px(x, cy, FRAME, FACE, { bias: wz > 5 ? 2 : 1 });
            continue;
          }
          const mull = Math.abs(wx) < 0.6 || Math.abs(wz - 0.5) < 0.6;
          if (mull) {
            c.px(x, cy, FRAME, FACE, { bias: 2 });
            continue;
          }
          // Glass: a cool sky reflection by day, a streak of glare, and warm lamplight behind it at night.
          const glare = Math.abs(wx + wz - 1.5) < 0.9 || Math.abs(wx + wz + 3) < 0.5;
          c.px(x, cy, GLASS, FACE, { bias: Math.round(2 + wz * 0.25 + (glare ? 2.5 : 0)) });
          c.spark(x, cy, mix3(WARM, INNER, (wz + 4) / 9), 0.75);
          continue;
        }
        if (Math.abs(wx) < 6.5 && Math.abs(wz + 5.5) < 1) {
          // The sill.
          c.px(x, cy, FRAME, wz < -5.5 ? FACE : TOP, { bias: 2 });
          continue;
        }
      }
      const p = face(def.id, x, z, H, gx0 + x, v, mask);
      if (p) c.px(x, cy, p.m, p.n, { bias: p.bias });
    }
  }

  // Then the tops, over the faces.
  c.part();
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      if (!inside(x, y) || (gap(x, y) && (!def.house || !across))) continue;
      const p = top(def.id, x, y, gx0 + x, y, across);
      let bias = p.bias;
      // The top's edges catch the light (north, west) or fall into shade (south, east).
      if (!inside(x, y - 1)) bias += 1;
      if (!inside(x + 1, y) || !inside(x, y + 1)) bias -= 1;
      if (kind === 'window' && !across && Math.abs(x + 0.5 - 8) < 1.5 && Math.abs(y + 0.5 - 8) < 5) {
        // A window in a north-south wall, seen from above: a strip of glass.
        c.px(x, y, GLASS, TOP, { bias: 4 });
        c.spark(x, y, WARM, 0.5);
        continue;
      }
      c.px(x, y, p.m, p.n, { bias });
    }
  }
  if (door && !across && def.house) {
    // A doorway through a north-south wall: posts either side and the door swung back.
    c.part();
    for (const y of [8 - DOOR_HW - 1, 8 + DOOR_HW]) for (let x = 5; x < 11; x++) c.px(x, y, BEAM, TOP, { bias: 1 });
    if (!bare) {
      c.part();
      for (let y = 8 - DOOR_HW; y < 8 - DOOR_HW + 5; y++) c.px(10, y, DOOR_WOOD, TOP, { bias: 2 });
    }
  }
  return c;
}

/** A picket fence: rails, pointed white pickets with gaps between them, and a gate. */
function fenceFrame(c: PixelCanvas, mask: number, gate: boolean, H: number): PixelCanvas {
  const across = doorAcross(mask);
  const run = (x: number) => (x < 8 ? !!(mask & 8) || x >= 7 : !!(mask & 2) || x <= 8);
  if (mask & 10 || !(mask & 5)) {
    // East-west: rails behind, pickets in front.
    const baseY = 9;
    c.part();
    for (const rz of [3, H - 4]) {
      for (let x = 0; x < CELL; x++) {
        if (!run(x)) continue;
        c.px(x, baseY + H - 1 - rz, PICKET, FACE, { bias: -1 });
      }
    }
    c.part();
    for (let x = 0; x < CELL; x++) {
      if (!run(x)) continue;
      const k = ((x % 4) + 4) % 4;
      if (k !== 1 && k !== 2) continue;
      // A gate's pickets are a little shorter and have a latch; the rest are pointed.
      const tall = gate ? H - 2 : H;
      for (let z = 0; z < tall; z++) {
        if (z === tall - 1 && k === 2) continue;
        c.px(x, baseY + H - 1 - z, PICKET, { x: k === 1 ? -0.3 : 0.3, y: -0.35, z: 0.88 }, { bias: z === tall - 1 ? 1 : 0 });
      }
    }
    if (gate) {
      c.part();
      c.px(12, baseY + H - 6, IRON, FACE, { bias: 2 });
    }
  }
  if (mask & 5 && !across) {
    // North-south: seen from above, a rail with the pickets' tips along it.
    c.part();
    for (let y = 0; y < CELL; y++) {
      if ((y < 8 && !(mask & 1)) || (y > 8 && !(mask & 4))) continue;
      if (gate && Math.abs(y + 0.5 - 8) < DOOR_HW) continue;
      c.px(7, y, PICKET, TOP, { bias: 1 });
      if (y % 4 === 1) {
        c.px(8, y, PICKET, TOP, { bias: 2 });
        c.px(7, y, PICKET, TOP, { bias: 3 });
      }
    }
    // The south end's face, where the run stops.
    if (!(mask & 4)) {
      c.part();
      for (let z = 0; z < H; z++) c.px(7, CELL + H - 1 - z - 7, PICKET, FACE, { bias: 0 });
    }
  }
  return c;
}

const mix3 = (a: RGB, b: RGB, t: number): RGB => {
  const k = Math.max(0, Math.min(1, t));
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
};

/** Every frame of one material: `w<mask>_<variant>` for plain walls, `d<mask>` for doorways (or gates), `o<mask>` for a house's doorway with a door hung in it, `n<mask>` for windows. */
export function wallFrames(mat: number): { name: string; canvas: PixelCanvas }[] {
  const out: { name: string; canvas: PixelCanvas }[] = [];
  const house = WALLS[mat].house;
  for (let mask = 0; mask < 16; mask++) {
    out.push({ name: `w${mask}_0`, canvas: wallFrame(mat, mask, 'wall', 0) });
    out.push({ name: `w${mask}_1`, canvas: wallFrame(mat, mask, 'wall', 1) });
    out.push({ name: `d${mask}`, canvas: wallFrame(mat, mask, 'door', 0) });
    if (house) out.push({ name: `n${mask}`, canvas: wallFrame(mat, mask, 'window', 0) });
    if (house) out.push({ name: `o${mask}`, canvas: wallFrame(mat, mask, 'door', 0, true) });
  }
  return out;
}

// ---------------------------------------------------------------- Roofs

/** How far a roof's eaves reach past its walls, and how steeply its slopes rise (px up per px in). */
export const EAVES = 3;
const LIFT = 0.55;
/** A roof sits on house walls this tall. */
export const ROOF_ON = WALLS[0].height;

const ROOF_RAMPS: Record<string, RGB[]> = {
  slate: ramp('#0e1118', '#161b26', '#1f2634', '#293244', '#343f54', '#414e66', '#515f7a', '#66758e'),
  clay: ramp('#2e0e08', '#46160c', '#621f10', '#7e2a16', '#9a381c', '#b24824', '#c65c32', '#d87644'),
  thatch: ramp('#2a1c0a', '#3e2a10', '#574016', '#72571e', '#8e6e28', '#a88834', '#c2a248', '#d8bc62'),
  shingle: ramp('#1c130d', '#2a1d14', '#3a291c', '#4c3624', '#5e452e', '#725539', '#886746', '#9e7a56'),
};
const ROOF_MOSS = ramp('#12240f', '#1a3416', '#26481e', '#335e26', '#437630');
const RIDGE: Record<string, RGB[]> = {
  slate: ramp('#1a1a20', '#2a2a32', '#3c3c46', '#52525e', '#6c6c78', '#86868f'),
  clay: ramp('#3a120a', '#5a1c0e', '#7c2a14', '#9e3a1c', '#bc4e28', '#d46a3c'),
  thatch: ramp('#1e1408', '#2e200c', '#443012', '#5a4218', '#72561e', '#8a6a26'),
  shingle: ramp('#1a120c', '#2a1e14', '#3c2c1e', '#503c28', '#644c32', '#7a5e3e'),
};

export interface RoofArt {
  w: number;
  h: number;
  diffuse: Uint8ClampedArray<ArrayBuffer>;
  normal: Uint8ClampedArray<ArrayBuffer>;
  /** Where its top-left sits on the plot (it rises above the house by the walls' height and its own). */
  x: number;
  y: number;
  /** How far up the roof lifts plot pixel (px, py) of its footprint, for a chimney standing on it. */
  lift(px: number, py: number): number;
  /** The house as a solid, for its sun shadow: per pixel of the footprint frame (at plot x, y), what stands there from `base` px up to `top` (NONE: open ground). */
  solid: HouseSolid;
}

export interface HouseSolid {
  x: number;
  y: number;
  w: number;
  h: number;
  base: Uint8Array;
  top: Uint8Array;
}
/** A pixel of a house solid that holds nothing. */
export const SOLID_NONE = 255;

/** Paint house `h`'s roof, from its roof cells in `l`. */
export function paintRoof(l: HomeLayout, h: House): RoofArt {
  const E = EAVES;
  const fx0 = h.x0 * CELL - E;
  const fy0 = h.y0 * CELL - E;
  const FW = (h.x1 - h.x0 + 1) * CELL + E * 2;
  const FH = (h.y1 - h.y0 + 1) * CELL + E * 2;
  const n = FW * FH;
  const roofAt = (px: number, py: number) => {
    const cx = Math.floor((px + fx0) / CELL);
    const cy = Math.floor((py + fy0) / CELL);
    return inPlot(cx, cy) ? l.roof[cellIndex(cx, cy)] : 0;
  };
  const own = new Set(h.cells);
  // Footprint: the house's roof cells, grown by the eaves.
  const out = new Float32Array(n).fill(1e9);
  for (let y = 0; y < FH; y++) {
    for (let x = 0; x < FW; x++) {
      const cx = Math.floor((x + fx0) / CELL);
      const cy = Math.floor((y + fy0) / CELL);
      if (inPlot(cx, cy) && own.has(cellIndex(cx, cy))) out[y * FW + x] = 0;
    }
  }
  chamfer(out, FW, FH, E + 1);
  // Height: how far in from the eaves, which sets the slopes.
  const hgt = new Float32Array(n);
  // Seeded from the eaves: the ground round the roof, and the frame's own edge
  // (the frame is cut to the eaves, so its edge has no outside pixels beyond it).
  for (let y = 0; y < FH; y++) {
    for (let x = 0; x < FW; x++) {
      const i = y * FW + x;
      hgt[i] = out[i] > E ? 0 : x === 0 || y === 0 || x === FW - 1 || y === FH - 1 ? 1 : 1e9;
    }
  }
  chamfer(hgt, FW, FH, 1e6);
  let maxH = 0;
  for (let i = 0; i < n; i++) if (hgt[i] < 1e8) maxH = Math.max(maxH, hgt[i]);
  const rise = Math.ceil(maxH * LIFT) + 1;
  const W = FW;
  const HH = FH + ROOF_ON + rise;
  const diffuse = new Uint8ClampedArray(W * HH * 4);
  const normal = new Uint8ClampedArray(W * HH * 4);
  const L = KEY_LIGHT;
  const Ll = Math.hypot(L.x, L.y, L.z);
  const flat = L.z / Ll;
  const hAt = (x: number, y: number) => {
    const xx = Math.max(0, Math.min(FW - 1, x));
    const yy = Math.max(0, Math.min(FH - 1, y));
    const v = hgt[yy * FW + xx];
    return v > 1e8 ? 0 : v;
  };
  const inRoof = (x: number, y: number) => x >= 0 && y >= 0 && x < FW && y < FH && out[y * FW + x] <= E;

  for (let x = 0; x < FW; x++) {
    let prev = -1;
    for (let y = 0; y < FH; y++) {
      if (!inRoof(x, y)) continue;
      const hh = hAt(x, y);
      const gx = (hAt(x + 1, y) - hAt(x - 1, y)) / 2;
      const gy = (hAt(x, y + 1) - hAt(x, y - 1)) / 2;
      // Where the slope turns (a ridge, or a hip between two slopes).
      const crease = Math.abs(hAt(x + 1, y) + hAt(x - 1, y) - 2 * hh) + Math.abs(hAt(x, y + 1) + hAt(x, y - 1) - 2 * hh) > 1.2 && hh > 2;
      const pitch = 0.9;
      let nx = -gx * pitch;
      let ny = gy * pitch;
      let nz = 1;
      const kind = ROOFS[Math.max(0, roofAt(x, y) - 1)]?.id ?? 'slate';
      const base = ROOF_RAMPS[kind];
      let r = base;
      let idx = 3.6;
      // Along the course: across the slope. Its courses follow the eaves.
      const along = Math.abs(gx) > Math.abs(gy) ? y + fy0 : x + fx0;
      const CH = kind === 'thatch' ? 6 : kind === 'clay' ? 5 : 4;
      const course = Math.floor(hh / CH);
      const v = hh / CH - course;
      const off = course % 2 ? 3 : 0;
      if (kind === 'slate' || kind === 'shingle') {
        const TW = kind === 'slate' ? 6 : 4;
        const tile = Math.floor((along + off) / TW);
        const lx = (along + off) - tile * TW;
        const t = hash2(tile, course, 781);
        idx += (t - 0.5) * (kind === 'shingle' ? 1.8 : 1.2);
        if (lx === 0) idx -= 1.4;
        if (v > 0.72) idx -= 1.2;
        else if (v < 0.2) idx += 0.5;
        if (kind === 'shingle' && t > 0.93) idx -= 1.6;
        // Moss gathers low on the slopes.
        const moss = fbm(x + fx0, y + fy0, 9, 783, 3) + Math.max(0, 6 - hh) * 0.04;
        if (moss > 0.68) {
          r = ROOF_MOSS;
          idx = 2.4 + (hash2(x, y, 785) - 0.5) * 1.6;
        }
      } else if (kind === 'clay') {
        // Barrel tiles: rounded channels running down the slope.
        const k = (((along + off) % 5) + 5) % 5;
        const roll = Math.cos((k / 5) * Math.PI * 2);
        if (Math.abs(gx) > Math.abs(gy)) ny += roll * 0.35;
        else nx += roll * 0.35;
        idx += roll * 0.9 + (hash2(Math.floor((along + off) / 5), course, 787) - 0.5) * 1.1;
        if (v > 0.78) idx -= 1.5;
      } else {
        // Thatch: straw in thick layers, each with a rounded lip and fibres running down.
        const fibre = hash2(along, Math.floor(hh / 2), 789);
        idx += (fibre - 0.5) * 1.6 + (valueNoise(along, hh, 5, 791) - 0.5) * 1;
        if (v > 0.8) idx -= 1.6;
        else if (v < 0.25) idx += 0.6;
        nz += (v - 0.5) * 0.3;
      }
      if (crease) {
        // Ridge and hip tiles, a little proud of the slope.
        r = RIDGE[kind];
        idx = 3.4 + ((x + y) % 3 === 0 ? -1.2 : 0);
        nx = 0;
        ny = 0.35;
        nz = 1;
      }
      if (hh < 1.3) {
        // The eaves' edge: a dark rim, and for thatch its cut ends.
        idx = kind === 'thatch' ? 1.8 + hash2(along, 7, 793) : 0.8;
        ny -= 0.4;
      }
      const nl = Math.hypot(nx, ny, nz);
      nx /= nl;
      ny /= nl;
      nz /= nl;
      idx += ((nx * L.x + ny * L.y + nz * L.z) / Ll - flat) * 3.2;
      const c = r[Math.max(0, Math.min(r.length - 1, Math.floor(idx + bayer(x, y) * 0.8)))];
      const sy = y + rise - Math.round(hh * LIFT);
      const from = prev < 0 ? sy : Math.min(sy, prev + 1);
      for (let yy = from; yy <= sy; yy++) {
        if (yy < 0 || yy >= HH) continue;
        const o = (yy * W + x) * 4;
        diffuse[o] = c[0];
        diffuse[o + 1] = c[1];
        diffuse[o + 2] = c[2];
        diffuse[o + 3] = 255;
        normal[o] = Math.round(nx * 127.5 + 127.5);
        normal[o + 1] = Math.round(ny * 127.5 + 127.5);
        normal[o + 2] = Math.round(nz * 127.5 + 127.5);
        normal[o + 3] = 255;
      }
      prev = Math.max(prev, sy);
    }
  }
  // An outline all round, dark under the eaves.
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < HH && diffuse[(y * W + x) * 4 + 3] > 0;
  const ink = hex('#0a080c');
  const rim: number[] = [];
  for (let y = 0; y < HH; y++) {
    for (let x = 0; x < W; x++) {
      if (solid(x, y)) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) rim.push(y * W + x);
    }
  }
  for (const i of rim) {
    const o = i * 4;
    diffuse[o] = ink[0];
    diffuse[o + 1] = ink[1];
    diffuse[o + 2] = ink[2];
    diffuse[o + 3] = 255;
    normal[o] = 128;
    normal[o + 1] = 128;
    normal[o + 2] = 255;
    normal[o + 3] = 255;
  }
  // The texture is one pixel wider all round for the outline: shift into a padded copy.
  const PW = W + 2;
  // The house as a solid: walls from the ground up to the eaves, and the
  // roof over them and its overhang, up to its slope.
  const sBase = new Uint8Array(n).fill(SOLID_NONE);
  const sTop = new Uint8Array(n).fill(SOLID_NONE);
  for (let y = 0; y < FH; y++) {
    for (let x = 0; x < FW; x++) {
      const i = y * FW + x;
      if (out[i] > E) continue;
      sBase[i] = out[i] === 0 ? 0 : ROOF_ON;
      sTop[i] = ROOF_ON + Math.round(hAt(x, y) * LIFT);
    }
  }

  const PH = HH + 2;
  const pd = new Uint8ClampedArray(PW * PH * 4);
  const pn = new Uint8ClampedArray(PW * PH * 4);
  for (let y = 0; y < HH; y++) {
    pd.set(diffuse.subarray(y * W * 4, (y + 1) * W * 4), ((y + 1) * PW + 1) * 4);
    pn.set(normal.subarray(y * W * 4, (y + 1) * W * 4), ((y + 1) * PW + 1) * 4);
  }
  return {
    w: PW,
    h: PH,
    diffuse: pd,
    normal: pn,
    x: fx0 - 1,
    y: fy0 - ROOF_ON - rise - 1,
    lift: (px, py) => ROOF_ON + Math.round(hAt(px - fx0, py - fy0) * LIFT),
    solid: { x: fx0, y: fy0, w: FW, h: FH, base: sBase, top: sTop },
  };
}

/** Chamfer distance: 0 at the seeds (zeros), capped at `cap`. */
function chamfer(d: Float32Array, W: number, H: number, cap: number): void {
  const D = Math.SQRT2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let v = d[i];
      if (v === 0) continue;
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
    for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      let v = d[i];
      if (v === 0) continue;
      if (x < W - 1) v = Math.min(v, d[i + 1] + 1);
      if (y < H - 1) {
        v = Math.min(v, d[i + W] + 1);
        if (x < W - 1) v = Math.min(v, d[i + W + 1] + D);
        if (x > 0) v = Math.min(v, d[i + W - 1] + D);
      }
      d[i] = Math.min(v, cap);
    }
  }
}

/** A roof's sample for the build palette: a small hipped roof of it, `size` px square. */
export function roofSwatch(kind: number, size: number, l: HomeLayout): Uint8ClampedArray<ArrayBuffer> {
  for (let y = 0; y < 2; y++) for (let x = 0; x < 3; x++) l.roof[y * COLS + x] = kind;
  const art = paintRoof(l, { id: 0, cells: [0, 1, 2, COLS, COLS + 1, COLS + 2], x0: 0, y0: 0, x1: 2, y1: 1 });
  const out = new Uint8ClampedArray(size * size * 4);
  // The roof's slopes, centred, without the walls' lift under them.
  const ox = Math.round((art.w - size) / 2);
  const oy = Math.max(0, art.h - (CELL * 2 + EAVES * 2 + 2) - Math.round((size - (CELL * 2 + EAVES * 2)) / 2) - ROOF_ON + 6);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = x + ox;
      const sy = y + oy - 8;
      if (sx < 0 || sy < 0 || sx >= art.w || sy >= art.h) continue;
      out.set(art.diffuse.subarray((sy * art.w + sx) * 4, (sy * art.w + sx) * 4 + 4), (y * size + x) * 4);
    }
  }
  return out;
}

// ---------------------------------------------------------------- Chimney

export const CHIMNEY_W = 12;
export const CHIMNEY_H = 22;

/** A fieldstone chimney with a blackened cap, standing on a roof above a hearth. 12x22, its foot at the bottom. */
export function chimney(): PixelCanvas {
  const c = new PixelCanvas(CHIMNEY_W, CHIMNEY_H);
  c.part();
  for (let y = 5; y < CHIMNEY_H; y++) {
    for (let x = 2; x < 10; x++) {
      const row = Math.floor((y - 5) / 4);
      const off = row % 2 ? 2 : 0;
      const joint = (y - 5) % 4 === 3 || (x + off) % 4 === 0;
      c.px(x, y, FIELDSTONE, { x: x < 4 ? -0.3 : x > 7 ? 0.3 : 0, y: -0.3, z: 0.9 }, { bias: joint ? -3 : Math.round((hash2(Math.floor((x + off) / 4), row, 795) - 0.5) * 2) + (x < 4 ? 1 : 0) });
    }
  }
  c.part();
  c.shape(2, 5, () => [1, 11], FIELDSTONE, (_x, y) => (y < 4 ? { x: 0, y: 0.8, z: 0.6 } : FACE), { bias: 2 });
  c.part();
  c.ellipse(6, 3, 3.2, 1.1, IRON, { bias: -3 });
  c.spark(6, 3, [255, 120, 40], 0.35);
  return c;
}

export { HEARTH };
