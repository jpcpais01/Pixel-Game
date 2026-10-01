// The Aurora Colosseum's shape: an old arena of ice and stone on the roof of
// the world, its floor an ellipse (a circle seen from a little above) of
// snow-dusted flagstones round a frozen lake. Its wall rings the floor: the
// north half shows its inner face, tiered stands climbing behind it to the
// sky; the south half shows only its parapet, the crag it stands on falling
// away to a sea of cloud. Seven gates let the Long Winter's hosts in: three
// arches in the north wall (the Great Gate in the middle, for its champions)
// and four stairs climbing up the crag through gaps in the parapet. Four
// frozen champions stand on plinths round the lake, cover to fight round.
//
// Pure functions of arena coordinates, shared by the art (art/frost.ts), the
// arena's runtime (world/Frost.ts), the waves (game/frost.ts) and the
// creatures, which may lean on the centre (a boss circling the lake).

export const FROST_W = 800;
export const FROST_H = 720;
/** The floor's centre and its radii. */
export const FROST_CX = 400;
export const FROST_CY = 400;
export const FROST_RX = 250;
export const FROST_RY = 170;
/** The frozen lake in the middle of the floor, as a share of the floor's radii. */
export const LAKE_K = 0.5;
/** How tall the north wall's inner face stands at its middle, and how far its stands climb behind it. */
export const WALL_H = 64;
export const STANDS_H = 92;
/** The wall's thickness on the ground, seen from above (its parapet), as a share of the radii past the floor's edge. */
export const WALL_K = 0.09;

/** The hero stands on the lake's heart. */
export const FROST_SPAWN = { x: FROST_CX, y: FROST_CY + 14 };

/** A point on the floor's edge at angle `deg` (0 east, 90 south), `k` of the way out. */
export function onFloor(deg: number, k = 1): { x: number; y: number } {
  const a = (deg * Math.PI) / 180;
  return { x: FROST_CX + Math.cos(a) * FROST_RX * k, y: FROST_CY + Math.sin(a) * FROST_RY * k };
}

export interface Gate {
  /** Where the wall stands, by angle round the floor (0 east, 90 south). */
  deg: number;
  /** An arch in the north wall, or a stair up through the south parapet. */
  kind: 'arch' | 'stair';
  /** The Great Gate, where the champions come in. */
  great?: boolean;
  /** The foot of the gate on the floor's edge, and where a foe steps out onto the floor. */
  x: number;
  y: number;
  ox: number;
  oy: number;
}

const gate = (deg: number, kind: Gate['kind'], great = false): Gate => {
  const at = onFloor(deg, 1);
  const out = onFloor(deg, 0.86);
  return { deg, kind, great, x: Math.round(at.x), y: Math.round(at.y), ox: Math.round(out.x), oy: Math.round(out.y) };
};

/** The seven gates. The first is the Great Gate. */
export const GATES: Gate[] = [gate(-90, 'arch', true), gate(-124, 'arch'), gate(-56, 'arch'), gate(158, 'stair'), gate(22, 'stair'), gate(66, 'stair'), gate(114, 'stair')];

/** The four frozen champions on their plinths, between the lake and the wall. */
export const STATUES: { x: number; y: number; v: number }[] = [40, 140, 220, 320].map((deg, i) => {
  const p = onFloor(deg, 0.68);
  return { x: Math.round(p.x), y: Math.round(p.y), v: i };
});
/** A plinth's footprint (half width and half depth). */
export const PLINTH_RX = 13;
export const PLINTH_RY = 7;

/** Braziers of blue fire along the parapet, by angle. */
export const BRAZIERS: number[] = [-107, -73, -146, -34, 136, 44, 90];
/** Banners hanging down the north wall's face, under the braziers between its arches. */
export const BANNERS: number[] = [-107, -73, -146, -34];

/** Distance from the centre in floor radii: 1 on the floor's edge. */
export function frostR(x: number, y: number): number {
  return Math.hypot((x - FROST_CX) / FROST_RX, (y - FROST_CY) / FROST_RY);
}

/** On the frozen lake? */
export function onLake(x: number, y: number): boolean {
  return frostR(x, y) < LAKE_K;
}

/** Can feet stand here? On the floor, inside the wall, and clear of the plinths. */
export function frostWalkable(x: number, y: number): boolean {
  const u = (x - FROST_CX) / (FROST_RX - 7);
  const v = (y - FROST_CY) / (FROST_RY - 5);
  if (u * u + v * v > 1) return false;
  for (const s of STATUES) {
    const dx = (x - s.x) / PLINTH_RX;
    const dy = (y - s.y) / PLINTH_RY;
    if (dx * dx + dy * dy < 1) return false;
  }
  return true;
}

// ---------------------------------------------------------------- The wall's rise

/** How tall the parapet stands round the south half, and where the north wall tapers down to it. */
export const PARAPET_H = 7;

/** The angle (degrees, 0 east, 90 south) round the floor of a point. */
export function frostDeg(x: number, y: number): number {
  return (Math.atan2((y - FROST_CY) / FROST_RY, (x - FROST_CX) / FROST_RX) * 180) / Math.PI;
}

/** How whole the north wall and its stands are at angle `deg`: 1 across the north, easing to 0 at the east and west, 0 round the south. */
export function northK(deg: number): number {
  const s = -Math.sin((deg * Math.PI) / 180);
  const t = Math.max(0, Math.min(1, (s - 0.1) / 0.32));
  return t * t * (3 - 2 * t);
}

/** The wall's height at angle `deg`: the full wall in the north, the parapet in the south. */
export function wallH(deg: number): number {
  return PARAPET_H + (WALL_H - PARAPET_H) * northK(deg);
}

/** How far the stands reach out behind the wall, as a share of the floor's radii, where they're whole. */
export const STANDS_K = 0.2;

/** How whole the stands are at angle `deg`: they hold to the north, ending before the wall turns to the flanks. */
export function standsK(deg: number): number {
  const s = -Math.sin((deg * Math.PI) / 180);
  const t = Math.max(0, Math.min(1, (s - 0.42) / 0.3));
  return t * t * (3 - 2 * t);
}

/** An arch's opening on the wall's face: its width along the wall and its height. */
export function archSize(g: Gate): { w: number; h: number } {
  if (g.kind === 'stair') return { w: 30, h: 0 };
  if (g.great) return { w: 48, h: 46 };
  return { w: 26, h: Math.min(36, Math.round(wallH(g.deg) - 10)) };
}

/** A brazier on the wall's top at angle `deg`: where its foot stands in the picture (the wall's height above the floor's edge). */
export function brazierAt(deg: number): { x: number; y: number; foot: number } {
  const p = onFloor(deg, 1 + WALL_K * 0.5);
  const h = wallH(deg);
  return { x: Math.round(p.x), y: Math.round(p.y - h), foot: Math.round(p.y) };
}
