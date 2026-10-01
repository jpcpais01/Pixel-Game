// The Home's door (see world/homeParts.ts and world/Home.ts): an arched oak
// door hung in a house's doorway, that swings open as a hero walks up to it
// and shuts behind them. The doorway itself is unchanged (it is still walked
// through, and the house still opens up round the hero inside): the door is a
// thing set in it, drawn over the wall.
//
// The leaf is a real slab in the game's view: 10 px wide, 2 thick, as tall as
// the doorway's arch, turning on its hinge. Each frame is ray cast from the
// view, so whichever face, edge or top of the leaf is nearest shows, lit by
// its own facing; the wall round the doorway is cast too, so a leaf swinging
// into the house is seen through the arch and goes behind the jambs. The
// outer face has planks, iron strap hinges, a ring pull and a little lit
// window; the inner face shows the ledges and brace that hold it together.

import { PixelCanvas, hex, type Material, type RenderedFrame, type RGB, type Vec3 } from './pixel';
import { hash2 } from './env';
import { IRON } from './sanctum';
import { CELL, DOOR_HW } from '../world/homeLayout';
import { WALLS } from '../world/homeParts';

const ramp = (...c: string[]): RGB[] => c.map(hex);

// ---------------------------------------------------------------- Tuning

/** The leaf: as wide as the doorway, this thick, its arch as the doorway's. */
const LEAF_W = DOOR_HW * 2;
const LEAF_T = 2;
/** House walls' height, and how far up the arch's round top starts (as homeWalls.ts draws the doorway). */
const WALL_H = WALLS[0].height;
const ARCH_SPRING = WALL_H - 10;
/** The house walls' footprint across their cell. */
const WALL_A = 8 - WALLS[0].thick / 2;
const WALL_B = 8 + WALLS[0].thick / 2;

/** Frames run from shut to a little past wide open (the leaf overshoots, then settles), this many degrees apart. */
export const DOOR_STEP = 10;
export const DOOR_STEPS = 11;
/** Where it rests when open, in degrees. */
export const DOOR_OPEN = 90;

/** Every frame is this big, the door's cell `DOOR_OX` px in from its left and its ground `DOOR_OY` px down (a wall frame's own place, widened). */
export const DOOR_FW = CELL * 3;
export const DOOR_FH = WALL_H + CELL * 2;
export const DOOR_OX = CELL;
export const DOOR_OY = WALL_H;

/**
 * Which way a door swings, always into its house: north or south for a
 * doorway across an east-west wall, east or west for one in a north-south
 * wall (seen from above, along its top).
 */
export type DoorWay = 'n' | 's' | 'e' | 'w';
export const DOOR_WAYS: DoorWay[] = ['n', 's', 'e', 'w'];

/** A door frame's name on the Home sheet: its way, its hinge side (1: mirrored), and its step open. */
export const doorFrame = (way: DoorWay, hinge: number, step: number): string => `door:${way}${hinge}:${step}`;

// ---------------------------------------------------------------- Materials

export const OAK: Material = { ramp: ramp('#1c0e07', '#2c170c', '#3e2212', '#522e18', '#683c1f', '#7f4b27', '#965c31', '#ad6e3c', '#c4844c'), outline: hex('#0c0604'), outlineLit: hex('#2a1408') };
/** The light behind the little window: warm lamplight, glowing at night. */
const PANE: Material = { ramp: ramp('#5a2a08', '#9a5a18', '#d89a3c', '#ffcc70', '#ffe6a8', '#fff6dc'), outline: hex('#0c0604'), emissive: 0.85, noAO: true };

const n3 = (x: number, y: number, z: number): Vec3 => {
  const l = Math.hypot(x, y, z) || 1;
  return { x: x / l, y: y / l, z: z / l };
};
/** A leaf's top edge, facing up. */
export const TOP: Vec3 = n3(0, 0.35, 0.94);
/** The drawing's normal for an upright face whose facing on the ground is (ax, ay) (y south, toward the viewer). */
export const upright = (ax: number, ay: number): Vec3 => n3(ax * 0.8, -0.42 * Math.max(0, ay), 0.62 + 0.28 * Math.max(0, ay));

// ---------------------------------------------------------------- The leaf's shape and faces

/** How tall the leaf stands at `u` across it from the hinge: straight sides, then the arch's half circle. */
const leafTop = (u: number): number => {
  const d = u - LEAF_W / 2;
  return ARCH_SPRING + Math.sqrt(Math.max(0, DOOR_HW * DOOR_HW - d * d));
};

/** What a pixel of the leaf is, given where on it the view meets it. */
type Surface = 'outer' | 'inner' | 'hinge' | 'latch' | 'top';

export interface Paint {
  m: Material;
  bias: number;
  /** Drawn over the wood, as its own part, so the wood beside it takes a contact shadow. */
  over: boolean;
}

/** The planks: three, the middle one narrower, each its own tone. */
const plankOf = (ui: number): number => (ui < 3 ? 0 : ui < 6 ? 1 : 2);
const SEAMS = new Set([3, 6]);

/** The little window high in the arch: its lit pane, and its iron surround. */
function window(ui: number, zi: number): Paint | null {
  const z0 = ARCH_SPRING - 1;
  if (ui >= 4 && ui <= 5 && zi >= z0 && zi <= z0 + 2) return { m: PANE, bias: zi === z0 + 2 ? 1 : zi === z0 ? -1 : 0, over: true };
  if (ui >= 3 && ui <= 6 && zi >= z0 - 1 && zi <= z0 + 3) return { m: IRON, bias: zi === z0 + 3 ? 1 : 0, over: true };
  return null;
}

/** Wood, by plank, with grain running up it, a knot, worn lower down and a lit rail round the arch. */
function wood(u: number, z: number, side: number): Paint {
  const ui = Math.min(LEAF_W - 1, Math.max(0, Math.floor(u)));
  const zi = Math.max(0, Math.floor(z));
  if (SEAMS.has(ui)) return { m: OAK, bias: -2, over: false };
  const plank = plankOf(ui);
  let b = 1 + Math.round((hash2(plank, side, 1201) - 0.5) * 2);
  // Grain: long streaks a shade darker, the odd lighter one.
  const g = hash2(ui, Math.floor(zi / 4) + plank * 7, 1203 + side);
  if (g > 0.8) b -= 1;
  else if (g < 0.1) b += 1;
  // A knot in the wide plank by the latch.
  if (plank === 2 && Math.hypot(ui - 8, zi - (side > 0 ? 7 : 12)) < 0.8) b -= 2;
  // The edges round off: the hinge stile catches the light, the latch side falls away, the foot is worn dark.
  if (ui === 0) b += 1;
  if (ui === LEAF_W - 1) b -= 1;
  if (zi === 0) b -= 1;
  if (z > leafTop(u) - 1.2) b += 1;
  return { m: OAK, bias: b, over: false };
}

/** The outside: planks, two iron strap hinges with rivets and spear ends, a ring pull, a keyhole, the window. */
function outerFace(u: number, z: number): Paint {
  const ui = Math.min(LEAF_W - 1, Math.max(0, Math.floor(u)));
  const zi = Math.max(0, Math.floor(z));
  const w = window(ui, zi);
  if (w) return w;
  for (const s of [3, ARCH_SPRING - 5]) {
    // A strap two px tall from the hinge, narrowing to a point; its knuckle round the pin stands proud.
    const len = 7;
    const inStrap = (zi === s || zi === s + 1) && ui < len;
    const tip = ui === len && zi === s;
    const knuckle = ui === 0 && (zi === s - 1 || zi === s + 2);
    if (inStrap || tip || knuckle) {
      const rivet = (ui === 2 || ui === 5) && zi === s + 1;
      return { m: IRON, bias: rivet ? 3 : knuckle ? 1 : zi === s ? 1 : 0, over: true };
    }
  }
  // The ring pull: a hollow iron ring on a dark backplate, and a keyhole under it.
  const rx = ui - 8;
  const rz = zi - 10;
  if (Math.abs(rx) <= 1 && Math.abs(rz) <= 1) {
    if (rx === 0 && rz === 0) return { m: IRON, bias: -2, over: true };
    return { m: IRON, bias: rz > 0 ? 3 : rz === 0 ? 1 : 0, over: true };
  }
  if (ui === 8 && zi === 7) return { m: IRON, bias: -3, over: true };
  return wood(u, z, 1);
}

/** The inside: two ledges across, a brace rising from the hinge side between them, and a thumb latch. */
function innerFace(u: number, z: number): Paint {
  const ui = Math.min(LEAF_W - 1, Math.max(0, Math.floor(u)));
  const zi = Math.max(0, Math.floor(z));
  const w = window(ui, zi);
  if (w) return w;
  const lo = 3;
  const hi = ARCH_SPRING - 5;
  for (const s of [lo, hi]) {
    if (zi >= s && zi <= s + 2) return { m: OAK, bias: zi === s + 2 ? 2 : zi === s ? -1 : 1, over: true };
  }
  // The thumb latch: a short iron bar by the latch edge.
  if (zi === 10 && ui >= 7) return { m: IRON, bias: 2, over: true };
  if (zi === 11 && ui === 8) return { m: IRON, bias: 0, over: true };
  // The brace: from just above the low ledge by the hinge up to just under the high one by the latch.
  const bz = lo + 3 + ((u - 0.5) / (LEAF_W - 1)) * (hi - lo - 4);
  if (zi > lo + 2 && zi < hi && Math.abs(z - bz) < 1.1) return { m: OAK, bias: z > bz ? 2 : 1, over: true };
  return wood(u, z, -1);
}

// ---------------------------------------------------------------- Casting the view

/** Each frame is drawn at pixel centres: a pixel at (col, row) sees ground x = col + .5 - ox, and the line y = row + .5 - oy + t, z = t. */
export interface View {
  w: number;
  h: number;
  ox: number;
  oy: number;
}

/** A doorway's hinge, its leaf's shut direction and its outward facing, and the wall round it. */
export interface Hang {
  hx: number;
  hy: number;
  /** From the hinge to the latch, shut. */
  dx: number;
  dy: number;
  /** The outside of the house, which the outer face looks to when shut. */
  ox: number;
  oy: number;
  /** How far along this pixel's line the wall is nearest the viewer, or -Infinity where no wall stands. */
  wall(x: number, y0: number): number;
}

export const NONE = -Infinity;

/** Where the line (x, y0 + t, t) is last inside the box [y0, y1] x [z0, z1] (its x already checked), or NONE. */
export const lastIn = (y0: number, ya: number, yb: number, za: number, zb: number): number => {
  const lo = Math.max(ya - y0, za);
  const hi = Math.min(yb - y0, zb);
  return hi >= lo ? hi : NONE;
};

/** The arch's top over column x: below it the doorway is open. */
const archTop = (x: number): number => {
  const d = Math.abs(x - 8);
  return d >= DOOR_HW ? 0 : ARCH_SPRING + Math.sqrt(DOOR_HW * DOOR_HW - d * d);
};

/** A doorway across an east-west wall: the wall all along the cell, the arch cut through it (as homeWalls.ts paints it, by whole px up). */
const acrossWall = (x: number, y0: number): number => lastIn(y0, WALL_A, WALL_B, archTop(x) + 0.5, WALL_H);
/** A doorway in a north-south wall: the wall runs on north and south of the gap, open to the sky over it. */
const alongWall = (x: number, y0: number): number => {
  if (x < WALL_A || x > WALL_B) return NONE;
  return Math.max(lastIn(y0, -CELL, 8 - DOOR_HW, 0, WALL_H), lastIn(y0, 8 + DOOR_HW, CELL * 2, 0, WALL_H));
};

function hang(way: DoorWay, hinge: number): Hang {
  const m = hinge ? -1 : 1;
  switch (way) {
    // Into a house to the north: hung at the back of the doorway, the outer face out to the viewer.
    case 'n':
      return { hx: 8 - DOOR_HW * m, hy: WALL_A + 4.5, dx: m, dy: 0, ox: 0, oy: 1, wall: acrossWall };
    // Into a house to the south: hung at the front, its inner face to the viewer, swinging out over the floor.
    case 's':
      return { hx: 8 - DOOR_HW * m, hy: WALL_B - 0.5, dx: m, dy: 0, ox: 0, oy: -1, wall: acrossWall };
    // In a north-south wall: hinged on the north post (or the south one, mirrored).
    case 'e':
      return { hx: 8, hy: 8 - DOOR_HW * m, dx: 0, dy: m, ox: -1, oy: 0, wall: alongWall };
    case 'w':
      return { hx: 8, hy: 8 - DOOR_HW * m, dx: 0, dy: m, ox: 1, oy: 0, wall: alongWall };
  }
}

/**
 * A leaf that swings on a hinge: a slab `w` across, `t` thick and up to
 * `zMax` tall, `solid` where it has wood or iron (a gate's open slats leave
 * holes the view passes through), each pixel painted by what it shows.
 */
export interface Leaf {
  w: number;
  t: number;
  zMax: number;
  /** Is the leaf there at `u` across from the hinge and `z` up? (Through its thickness.) */
  solid(u: number, z: number): boolean;
  /** A face: `outer` the one that looks out of its doorway (Hang.ox, oy) when shut. */
  face(outer: boolean, u: number, z: number): Paint;
  /** An edge seen end on: the hinge side or the latch side of a member, at its top or down its side. */
  edge(u: number, z: number, top: boolean): Paint;
}

/** The door's leaf: solid oak, arched, with its faces as above. */
const DOOR_LEAF: Leaf = {
  w: LEAF_W,
  t: LEAF_T,
  zMax: ARCH_SPRING + DOOR_HW + 0.01,
  solid: (u, z) => z <= leafTop(u),
  face: (outer, u, z) => (outer ? outerFace(u, z) : innerFace(u, z)),
  // End grain on the edges, the top a touch lighter where it catches the sky.
  edge: (_u, _z, top) => ({ m: OAK, bias: top ? 1 : 0, over: false }),
};

/**
 * The leaf `leaf` hung as `g`, open `deg` degrees, as a lit frame seen from
 * the game's view in a canvas `view`. `walls` false leaves the wall out (a
 * palette picture).
 */
export function castLeaf(leaf: Leaf, g: Hang, deg: number, view: View, walls = true): RenderedFrame {
  const a = (deg * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  // Turning away from its outer side: the latch edge leads, the outer face turns after it.
  const dx = g.dx * ca - g.ox * sa;
  const dy = g.dy * ca - g.oy * sa;
  const nx = g.ox * ca + g.dx * sa;
  const ny = g.oy * ca + g.dy * sa;
  const { w: W, h: H } = view;
  const c = new PixelCanvas(W, H);
  const leafT = new Float32Array(W * H).fill(NONE);
  const over: { x: number; y: number; p: Paint; n: Vec3 }[] = [];
  const zMax = leaf.zMax;
  const T2 = leaf.t / 2;
  const LW = leaf.w;

  // Only the pixels the leaf could reach, however it turns.
  const reach = LW + leaf.t;
  const col0 = Math.max(0, Math.floor(g.hx - reach + view.ox));
  const col1 = Math.min(W - 1, Math.ceil(g.hx + reach + view.ox));
  const row0 = Math.max(0, Math.floor(g.hy - reach - zMax + view.oy));
  const row1 = Math.min(H - 1, Math.ceil(g.hy + reach + view.oy));

  c.part();
  for (let row = row0; row <= row1; row++) {
    for (let col = col0; col <= col1; col++) {
      const x = col + 0.5 - view.ox;
      const y0 = row + 0.5 - view.oy;
      // The leaf's slab along the line: u across it, v through it, both straight in t.
      const U0 = (x - g.hx) * dx + (y0 - g.hy) * dy;
      const V0 = (x - g.hx) * nx + (y0 - g.hy) * ny;
      let lo = 0;
      let hi = zMax;
      let face = 'top' as Surface;
      const slab = (A: number, B: number, min: number, max: number, low: Surface, high: Surface): boolean => {
        if (Math.abs(B) < 1e-6) return A >= min && A <= max;
        // The end the line leaves by, toward the viewer, is the face it shows.
        const ta = (min - A) / B;
        const tb = (max - A) / B;
        lo = Math.max(lo, Math.min(ta, tb));
        if (Math.max(ta, tb) < hi) {
          hi = Math.max(ta, tb);
          face = tb > ta ? high : low;
        }
        return true;
      };
      if (!slab(U0, dy, 0, LW, 'hinge', 'latch') || !slab(V0, ny, -T2, T2, 'inner', 'outer') || hi < lo) continue;
      // March down the line from the viewer's side to the first point inside the leaf.
      let hit = NONE;
      let prevU = U0 + hi * dy;
      let prevZ = hi;
      for (let t = hi; t >= lo; t -= 0.125) {
        const u = U0 + t * dy;
        if (leaf.solid(u, t)) {
          hit = t;
          break;
        }
        prevU = u;
        prevZ = t;
      }
      if (hit === NONE) continue;
      const u = U0 + hit * dy;
      const z = hit;
      // Met at once: the slab's own face or edge. Further in: the top of a member, or the side of one past a gap.
      let surf: Surface = face;
      if (hit < hi) surf = !leaf.solid(u, prevZ) || prevZ > zMax - 0.01 ? 'top' : prevU < u ? 'hinge' : 'latch';
      leafT[row * W + col] = hit;
      let p: Paint;
      let n: Vec3;
      if (surf === 'outer' || surf === 'inner') {
        p = leaf.face(surf === 'outer', u, z);
        n = surf === 'outer' ? upright(nx, ny) : upright(-nx, -ny);
      } else if (surf === 'top') {
        p = leaf.edge(u, z, true);
        n = TOP;
      } else {
        const s = surf === 'latch' ? 1 : -1;
        p = leaf.edge(u, z, false);
        n = upright(dx * s, dy * s);
      }
      if (p.over) over.push({ x: col, y: row, p, n });
      else c.px(col, row, p.m, n, { bias: p.bias });
    }
  }
  // Iron and battens over the wood, so the planks take their shadow.
  c.part();
  for (const o of over) c.px(o.x, o.y, o.p.m, o.n, { bias: o.p.bias });

  const r = c.render();
  // The wall stands in front of the leaf where it is nearer the viewer: clear those pixels (the wall's own frame draws there).
  // An outline pixel goes with the leaf it rings.
  if (walls) {
    for (let row = 0; row < H; row++) {
      for (let col = 0; col < W; col++) {
        const i = row * W + col;
        if (!r.diffuse[i * 4 + 3]) continue;
        let t = leafT[i];
        if (t === NONE) {
          if (col > 0) t = Math.max(t, leafT[i - 1]);
          if (col < W - 1) t = Math.max(t, leafT[i + 1]);
          if (row > 0) t = Math.max(t, leafT[i - W]);
          if (row < H - 1) t = Math.max(t, leafT[i + W]);
        }
        if (t !== NONE && t > g.wall(col + 0.5 - view.ox, row + 0.5 - view.oy)) continue;
        r.diffuse[i * 4 + 3] = r.normal[i * 4 + 3] = 0;
        r.emissive[i * 4] = r.emissive[i * 4 + 1] = r.emissive[i * 4 + 2] = r.emissive[i * 4 + 3] = 0;
      }
    }
  }
  return r;
}

/** The door hung `way` with hinge side `hinge`, open `deg` degrees. */
export const doorArt = (way: DoorWay, hinge: number, deg: number, view: View = { w: DOOR_FW, h: DOOR_FH, ox: DOOR_OX, oy: DOOR_OY }, walls = true): RenderedFrame => castLeaf(DOOR_LEAF, hang(way, hinge), deg, view, walls);

/** Every door frame: each way, each hinge side, each step open. */
export function doorFrames(): { name: string; r: RenderedFrame }[] {
  const out: { name: string; r: RenderedFrame }[] = [];
  for (const way of DOOR_WAYS) for (let hinge = 0; hinge < 2; hinge++) for (let s = 0; s < DOOR_STEPS; s++) out.push({ name: doorFrame(way, hinge, s), r: doorArt(way, hinge, s * DOOR_STEP) });
  return out;
}

/** The palette's picture (and the build cursor's ghost): the door shut, face on, in a wall frame's size. */
export const DOOR_ICON_W = CELL;
export const DOOR_ICON_H = WALL_H + CELL;
export const doorIcon = (hinge: number): RenderedFrame => doorArt('n', hinge, 0, { w: DOOR_ICON_W, h: DOOR_ICON_H, ox: 0, oy: WALL_H }, false);
