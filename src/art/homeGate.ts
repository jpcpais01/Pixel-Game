// The gates in garden walls (see world/homeParts.ts: every hedge, picket
// fence and garden wall has its gate), hung in their gap and swinging open
// as a hero comes to them, the way a house's door does (art/homeDoor.ts,
// whose ray caster draws them). A gate opens away from whoever walks up, so
// it has a frame for each way through its wall.
//
// Each is made for its wall: a white picket gate with its rails, brace and
// iron hinges for the fence; a little arched oak gate of slats for the hedge;
// a wrought-iron gate with a scroll and gilded spear tips for the stone wall.

import { hex, type Material, type RenderedFrame, type RGB } from './pixel';
import { hash2 } from './env';
import { IRON } from './sanctum';
import { PICKET } from './homeWalls';
import { NONE, OAK, castLeaf, lastIn, type Hang, type Leaf, type Paint } from './homeDoor';
import { CELL, DOOR_HW } from '../world/homeLayout';
import { WALLS } from '../world/homeParts';

const ramp = (...c: string[]): RGB[] => c.map(hex);
const GILT: Material = { ramp: ramp('#2a1804', '#5c3c10', '#94681c', '#c8962e', '#e8bc4a', '#fadc82', '#fff2c0'), outline: hex('#140a02'), shine: true, noOutline: true };
/** Wrought iron is dark enough to stand without an outline, which would fill the gaps between its bars. */
const WROUGHT: Material = { ...IRON, noOutline: true };

/** The ways a gate swings: away from whoever opens it, through an east-west wall (north, south) or a north-south one (east, west). */
export type GateWay = 'n' | 's' | 'e' | 'w';
export const GATE_WAYS: GateWay[] = ['n', 's', 'e', 'w'];

/** The gate's gap, as homeWalls.ts leaves it, and its leaf's width. */
const GATE_W = DOOR_HW * 2;

/** A gate frame: the wall's frame widened a cell each side and a cell below, the gate's cell `CELL` in and its ground `height` down. */
export const gateFrameSize = (mat: number): { w: number; h: number; ox: number; oy: number } => ({ w: CELL * 3, h: WALLS[mat].height + CELL * 2, ox: CELL, oy: WALLS[mat].height });
/** A gate frame's name on the Home sheet: its wall's material, the way it swings, and its step open. */
export const gateFrame = (mat: number, way: GateWay, step: number): string => `gate:${WALLS[mat].id}:${way}:${step}`;

// ---------------------------------------------------------------- The leaves

const P = (m: Material, bias: number, over = false): Paint => ({ m, bias, over });

/** The fence's: three pointed pickets on two rails and a brace, iron hinges on the rails, a thumb latch. */
const PICKET_GATE: Leaf = {
  w: GATE_W,
  t: 2,
  zMax: 10.01,
  solid(u, z) {
    if (z < 0 || u < 0 || u > GATE_W) return false;
    const m = u % 4;
    if (m < 2 && z < (m < 1 ? 10 : 9)) return true;
    if ((z >= 2 && z < 3) || (z >= 6 && z < 7)) return true;
    return z >= 3 && z < 6 && Math.abs(z - (3 + u * 0.3)) < 0.6;
  },
  face(front, u, z) {
    const ui = Math.min(GATE_W - 1, Math.floor(u));
    const zi = Math.floor(z);
    const rail = zi === 2 || zi === 6;
    if (ui <= 1 && rail) return P(IRON, 2, true);
    if (ui === 9 && zi === 4) return P(IRON, 2, true);
    if (!front && ui >= 7 && zi === 4) return P(IRON, 1, true);
    const m = u % 4;
    const picket = m < 2 && z < (m < 1 ? 10 : 9);
    if (front) {
      // Pickets in front, the rails and brace in shadow behind them.
      if (!picket) return P(PICKET, -3);
      return P(PICKET, (m < 1 ? 1 : 0) + (zi >= (m < 1 ? 9 : 8) ? 1 : 0) - (zi === 0 ? 1 : 0));
    }
    // From behind: the rails and brace stand forward, the pickets behind them.
    if (rail || !picket) return P(PICKET, 1);
    return P(PICKET, -1);
  },
  edge: (_u, _z, top) => P(PICKET, top ? 2 : 0),
};

/** The hedge's: a little oak gate, its top rail arched, slats between stiles, iron straps and a ring. */
const archOf = (u: number): number => 10.5 + 1.5 * Math.sin((Math.max(0, Math.min(GATE_W, u)) / GATE_W) * Math.PI);
const SLATS = [3, 5, 7];
const OAK_GATE: Leaf = {
  w: GATE_W,
  t: 2,
  zMax: 12.01,
  solid(u, z) {
    if (z < 0 || u < 0 || u > GATE_W) return false;
    const top = archOf(u);
    if (z > top) return false;
    if (u < 1.5 || u > GATE_W - 1.5) return true;
    if (z > top - 2 || z < 2 || (z >= 5.5 && z < 7)) return true;
    return SLATS.some((s) => Math.abs(u - s) < 0.5);
  },
  face(front, u, z) {
    const ui = Math.min(GATE_W - 1, Math.floor(u));
    const zi = Math.floor(z);
    const top = archOf(u);
    // Iron: straps across the top and bottom rails from the hinge, a ring on the latch stile.
    if (front && ui <= 3 && (zi === 1 || zi === Math.floor(top) - 1)) return P(IRON, ui === 3 ? 0 : 1, true);
    if (front && ui === 9 && (zi === 6 || zi === 8)) return P(IRON, 2, true);
    if (front && ui === 8 && zi === 7) return P(IRON, 1, true);
    if (!front && ui >= 7 && zi === 7) return P(IRON, 1, true);
    const stile = u < 1.5 || u > GATE_W - 1.5;
    const rail = z > top - 2 || z < 2 || (z >= 5.5 && z < 7);
    let b = 1 + Math.round((hash2(ui, front ? 1 : 2, 1301) - 0.5) * 1.6);
    if (hash2(ui, zi >> 2, 1303) > 0.82) b -= 1;
    if (stile) b += ui === 0 ? 1 : 0;
    else if (rail) b += z > top - 1 ? 1 : zi === 0 || zi === 5 ? 0 : -1;
    else b -= 1;
    return P(OAK, b);
  },
  edge: (_u, _z, top) => P(OAK, top ? 2 : 0),
};

/** The garden wall's: wrought-iron bars between two rails, a scroll in the middle, gilded spear tips, a stout latch stile. */
const BARS = [0.5, 2.5, 4.5, 6.5, 8.5];
/** Each bar's spear tip: the middle ones tallest, so the tips make a low arch. */
const tipOf = (b: number): number => 9.8 + 1.6 * Math.sin((b / GATE_W) * Math.PI);
const barAt = (u: number): number => BARS.find((b) => Math.abs(u - b) < 0.5) ?? -1;
const scroll = (u: number, z: number): boolean => Math.abs(Math.hypot(u - 5, z - 4.8) - 1.9) < 0.55 && z > 2 && z < 7.5;
const IRON_GATE: Leaf = {
  w: GATE_W,
  t: 1,
  zMax: 11.41,
  solid(u, z) {
    if (z < 0 || u < 0 || u > GATE_W) return false;
    const bar = barAt(u);
    if (bar >= 0 && z < tipOf(bar)) return true;
    if (u > GATE_W - 1 && z < 9) return true;
    if ((z >= 1 && z < 2) || (z >= 8 && z < 9)) return true;
    return scroll(u, z);
  },
  face(_front, u, z) {
    const zi = Math.floor(z);
    const bar = barAt(u);
    if (bar >= 0 && z >= tipOf(bar) - 1.3) return P(GILT, z >= tipOf(bar) - 0.6 ? 2 : 1);
    if (u > GATE_W - 1 && zi === 5) return P(GILT, 2);
    if (zi === 1 || zi === 8) return P(WROUGHT, 2);
    if (scroll(u, z)) return P(WROUGHT, z > 4.8 ? 2 : 0);
    return P(WROUGHT, 1 - (zi === 0 ? 1 : 0));
  },
  edge: (u, z, top) => (barAt(u) >= 0 && z >= tipOf(barAt(u)) - 1.3 ? P(GILT, top ? 3 : 1) : P(WROUGHT, top ? 3 : 1)),
};

const LEAVES: Record<string, Leaf> = { fence: PICKET_GATE, hedge: OAK_GATE, lowwall: IRON_GATE };

/** A gate's leaf, whichever face it shows the viewer shut (the south one, or the west one in a north-south wall) its front, whichever way it swings. */
function gateLeaf(mat: number, way: GateWay): Leaf {
  const leaf = LEAVES[WALLS[mat].id];
  // Hang.ox, oy point at the side it swings away from; that face is `outer` to the caster.
  return way === 's' || way === 'w' ? { ...leaf, face: (outer, u, z) => leaf.face(!outer, u, z) } : leaf;
}

/** Hung on the gap's west side (or north, in a north-south wall), in the wall's middle, swinging away from the side `way` is from. */
function gateHang(mat: number, way: GateWay): Hang {
  const W = WALLS[mat];
  const a = 8 - W.thick / 2;
  const b = 8 + W.thick / 2;
  const H = W.height;
  const across = way === 'n' || way === 's';
  const wall = across
    ? (x: number, y0: number) => (x > 8 - DOOR_HW && x < 8 + DOOR_HW ? NONE : lastIn(y0, a, b, 0, H))
    : (x: number, y0: number) => (x < a || x > b ? NONE : Math.max(lastIn(y0, -CELL, 8 - DOOR_HW, 0, H), lastIn(y0, 8 + DOOR_HW, CELL * 2, 0, H)));
  const o = { n: [0, 1], s: [0, -1], e: [-1, 0], w: [1, 0] }[way];
  return across ? { hx: 8 - DOOR_HW, hy: 8, dx: 1, dy: 0, ox: o[0], oy: o[1], wall } : { hx: 8, hy: 8 - DOOR_HW, dx: 0, dy: 1, ox: o[0], oy: o[1], wall };
}

/** Garden walls' materials, which have gates. */
export const GATE_MATS: number[] = WALLS.flatMap((w, i) => (!w.house && LEAVES[w.id] ? [i] : []));

/** Every gate frame: each garden wall's gate, each way, each step open (steps as the door's). */
export function gateFrames(steps: number, step: number): { name: string; r: RenderedFrame }[] {
  const out: { name: string; r: RenderedFrame }[] = [];
  for (const mat of GATE_MATS) {
    const view = gateFrameSize(mat);
    for (const way of GATE_WAYS) for (let s = 0; s < steps; s++) out.push({ name: gateFrame(mat, way, s), r: castLeaf(gateLeaf(mat, way), gateHang(mat, way), s * step, view) });
  }
  return out;
}
