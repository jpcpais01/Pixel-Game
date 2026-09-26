// The Elementinho Temple's shape: a crawl north through a hall for each of
// the four elements, from the Antechamber where heroes arrive, through the
// Hall of Tides with its sacred pool, the Stone Vault, the Gale Gallery and
// the Ember Forge between its lava pits, up to the round Heart of the Temple
// where Elementinho burns. Pure functions of world coordinates, shared by the
// art (art/temple.ts) and the game (world/Temple.ts, the monsters).

import type { SpawnSpot } from '../game/monsters';

export const TEMPLE_W = 600;
export const TEMPLE_H = 1900;
/** How tall the stone faces of the north walls stand, in pixels. */
export const TEMPLE_WALL_H = 28;

export type Element = 'water' | 'earth' | 'air' | 'fire';

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The halls, deepest last. */
export const ANTE: Rect = { x0: 190, y0: 1700, x1: 410, y1: 1860 };
export const TIDES: Rect = { x0: 100, y0: 1400, x1: 500, y1: 1620 };
export const VAULT: Rect = { x0: 80, y0: 1080, x1: 520, y1: 1300 };
export const GALLERY: Rect = { x0: 130, y0: 780, x1: 470, y1: 980 };
export const FORGE: Rect = { x0: 90, y0: 480, x1: 510, y1: 680 };
/** The Heart is round: its centre and radii. */
export const HEART = { cx: 300, cy: 200, rx: 200, ry: 160 };

// Each corridor reaches well into the halls it joins, so the floor stays
// continuous once the walkable margin is taken off every rect. They wind a
// little: centre, right, left, centre, centre.
const CORRIDORS: Rect[] = [
  { x0: 266, y0: 1600, x1: 334, y1: 1720 },
  { x0: 388, y0: 1280, x1: 452, y1: 1420 },
  { x0: 148, y0: 960, x1: 212, y1: 1100 },
  { x0: 266, y0: 660, x1: 334, y1: 800 },
  { x0: 262, y0: 330, x1: 338, y1: 500 },
];

/** The halls and what each is sacred to, for the floor's look. */
export const HALLS: { rect: Rect; el: Element | null }[] = [
  { rect: ANTE, el: null },
  { rect: TIDES, el: 'water' },
  { rect: VAULT, el: 'earth' },
  { rect: GALLERY, el: 'air' },
  { rect: FORGE, el: 'fire' },
];

/** Water no one can walk on: the sacred pool in the Hall of Tides. */
export const TIDE_POOL = { cx: 300, cy: 1500, rx: 66, ry: 32 };
/** The lava pits either side of the Ember Forge. */
export const LAVA_PITS = [
  { cx: 178, cy: 585, rx: 46, ry: 26 },
  { cx: 422, cy: 585, rx: 46, ry: 26 },
];

/** Where heroes arrive: the south end of the Antechamber. */
export const TEMPLE_SPAWN = { x: 300, y: 1830 };

/** Elementinho's place, over the Heart's flame sigil. */
export const ELEMENTINHO_HOME = { x: HEART.cx, y: HEART.cy + 10 };

const inRect = (r: Rect, x: number, y: number, m: number) => x >= r.x0 + m && x < r.x1 - m && y >= r.y0 + m && y < r.y1 - m;
const inOval = (o: { cx: number; cy: number; rx: number; ry: number }, x: number, y: number, m: number) => {
  const u = (x - o.cx) / (o.rx + m);
  const v = (y - o.cy) / (o.ry + m);
  return u * u + v * v < 1;
};

/** Is (x, y) in the tide pool or a lava pit (grown by `m`)? */
export function templeLiquid(x: number, y: number, m = 0): 'water' | 'lava' | null {
  if (inOval(TIDE_POOL, x, y, m)) return 'water';
  for (const p of LAVA_PITS) if (inOval(p, x, y, m)) return 'lava';
  return null;
}

/** In the Heart of the Temple, `m` pixels in from its wall. */
export function inHeart(x: number, y: number, m = 0): boolean {
  const u = (x - HEART.cx) / (HEART.rx - m);
  const v = (y - HEART.cy) / (HEART.ry - m);
  return u * u + v * v < 1;
}

/**
 * Floor, before props: inside a hall or a corridor, `m` pixels in from its
 * walls. The pool and the lava are not floor.
 */
export function templeFloor(x: number, y: number, m = 0): boolean {
  if (templeLiquid(x, y, m)) return false;
  for (const h of HALLS) if (inRect(h.rect, x, y, m)) return true;
  for (const c of CORRIDORS) if (inRect(c, x, y, m)) return true;
  return inHeart(x, y, m);
}

/** The element of the hall at (x, y), if it has one (the Heart holds all four). */
export function hallElement(x: number, y: number): Element | null {
  for (const h of HALLS) if (inRect(h.rect, x, y, -8)) return h.el;
  return null;
}

export type TemplePropKind = 'pillar' | 'brazier' | 'boulder' | 'crystal' | 'obelisk';

export interface TempleProp {
  kind: TemplePropKind;
  x: number;
  y: number;
  /** The element its gem, crystal or sigil burns with. */
  el: Element;
  flip?: boolean;
}

/** Feet-blocking footprints (half-width, half-height) of the props that stand in the way. */
export const TEMPLE_FOOT: Partial<Record<TemplePropKind, [number, number]>> = { pillar: [8, 5], brazier: [6, 4], boulder: [11, 6], obelisk: [9, 5] };

const p = (kind: TemplePropKind, x: number, y: number, el: Element, flip = false): TempleProp => ({ kind, x, y, el, flip });

/** Everything standing in the temple, by hall. */
export const TEMPLE_PROPS: TempleProp[] = [
  // Antechamber: a fire bowl either side of the way in, a pillar of each element down the sides.
  p('brazier', 222, 1722, 'fire'),
  p('brazier', 378, 1722, 'fire'),
  p('pillar', 214, 1790, 'water'),
  p('pillar', 386, 1790, 'earth', true),
  p('crystal', 206, 1846, 'air'),
  p('crystal', 394, 1846, 'fire', true),
  // Hall of Tides: pillars round the sacred pool, fire bowls on the north wall.
  p('pillar', 196, 1446, 'water'),
  p('pillar', 404, 1446, 'water', true),
  p('pillar', 196, 1572, 'water'),
  p('pillar', 404, 1572, 'water', true),
  p('brazier', 150, 1418, 'fire'),
  p('brazier', 300, 1418, 'fire'),
  p('crystal', 124, 1600, 'water'),
  p('crystal', 474, 1500, 'water', true),
  p('crystal', 130, 1470, 'water'),
  // The Stone Vault: fallen boulders and earth-crystals among heavy pillars.
  p('pillar', 170, 1130, 'earth'),
  p('pillar', 430, 1130, 'earth', true),
  p('pillar', 170, 1250, 'earth'),
  p('pillar', 430, 1250, 'earth', true),
  p('boulder', 300, 1150, 'earth'),
  p('boulder', 112, 1190, 'earth', true),
  p('boulder', 486, 1210, 'earth'),
  p('boulder', 250, 1276, 'earth', true),
  p('brazier', 300, 1098, 'fire'),
  p('brazier', 480, 1098, 'fire'),
  p('crystal', 356, 1266, 'earth'),
  p('crystal', 102, 1110, 'earth', true),
  // The Gale Gallery: a colonnade open to the wind, crystals of sky-glass.
  p('pillar', 176, 830, 'air'),
  p('pillar', 176, 930, 'air'),
  p('pillar', 424, 830, 'air', true),
  p('pillar', 424, 930, 'air', true),
  p('brazier', 230, 798, 'fire'),
  p('brazier', 370, 798, 'fire'),
  p('crystal', 300, 960, 'air'),
  p('crystal', 452, 880, 'air', true),
  // The Ember Forge: fire bowls and fire-crystals by the lava.
  p('brazier', 124, 500, 'fire'),
  p('brazier', 476, 500, 'fire'),
  p('pillar', 250, 520, 'fire'),
  p('pillar', 350, 520, 'fire', true),
  p('pillar', 250, 650, 'fire'),
  p('pillar', 350, 650, 'fire', true),
  p('crystal', 110, 650, 'fire'),
  p('crystal', 492, 640, 'fire', true),
  // The Heart: an obelisk of each element at the four corners of the sigil, fire bowls round the wall.
  p('obelisk', 168, 116, 'water'),
  p('obelisk', 432, 116, 'air', true),
  p('obelisk', 160, 292, 'earth'),
  p('obelisk', 440, 292, 'fire', true),
  p('brazier', 300, 58, 'fire'),
  p('brazier', 118, 206, 'fire'),
  p('brazier', 482, 206, 'fire'),
  p('crystal', 232, 338, 'fire'),
  p('crystal', 368, 338, 'fire', true),
];

/** Can feet stand here? On the floor, a little in from the walls, and not in a prop. */
export function templeWalkable(x: number, y: number): boolean {
  // Feet may come right up to a north wall's face, but not into the side walls.
  if (!templeFloor(x, y + 1, 5) || !templeFloor(x, y - 2, 2)) return false;
  for (const q of TEMPLE_PROPS) {
    const f = TEMPLE_FOOT[q.kind];
    if (!f) continue;
    const dx = (x - q.x) / f[0];
    const dy = (y - q.y) / f[1];
    if (dx * dx + dy * dy < 1) return false;
  }
  return true;
}

// Each hall holds its own element's creatures, more and tougher deeper in.
// A fallen elemental reforms a second later, but each spot only has a few
// returns in it, so every hall can be cleared for good.
const RETURN = 1000;
/** Elementinho rekindles long after it goes out, and never on top of the hero. */
export const ELEMENTINHO_RESPAWN = 45000;

const spot = (kind: SpawnSpot['kind'], x: number, y: number, lives: number): SpawnSpot => ({ kind, x, y, respawn: RETURN, lives, keepAway: 0 });

export const TEMPLE_SPAWNS: SpawnSpot[] = [
  // Antechamber: one little blob of each element.
  spot('blob_water', 250, 1760, 1),
  spot('blob_earth', 350, 1760, 1),
  spot('blob_air', 262, 1812, 1),
  spot('blob_fire', 338, 1812, 1),
  // Hall of Tides: water blobs and undines round the pool.
  spot('blob_water', 170, 1500, 2),
  spot('blob_water', 430, 1520, 2),
  spot('blob_water', 300, 1590, 2),
  spot('blob_water', 250, 1440, 1),
  spot('undine', 190, 1520, 2),
  spot('undine', 410, 1470, 2),
  // The Stone Vault: golems among the boulders, earth blobs at their feet.
  spot('golem', 240, 1200, 2),
  spot('golem', 380, 1180, 1),
  spot('blob_earth', 150, 1210, 2),
  spot('blob_earth', 450, 1160, 2),
  spot('blob_earth', 320, 1240, 2),
  spot('blob_earth', 180, 1110, 1),
  // The Gale Gallery: whirling gales and air blobs.
  spot('gale', 260, 860, 2),
  spot('gale', 350, 900, 2),
  spot('gale', 300, 820, 1),
  spot('blob_air', 200, 880, 2),
  spot('blob_air', 400, 880, 2),
  spot('blob_air', 300, 940, 1),
  // The Ember Forge: salamanders by the lava, fire blobs, an undine and a golem who strayed.
  spot('salamander', 220, 600, 2),
  spot('salamander', 380, 600, 2),
  spot('salamander', 300, 520, 1),
  spot('blob_fire', 300, 620, 2),
  spot('blob_fire', 160, 520, 2),
  spot('blob_fire', 440, 650, 2),
  spot('gale', 300, 560, 1),
  // The way up to the Heart.
  spot('salamander', 300, 420, 1),
  // The Heart.
  { kind: 'elementinho', x: ELEMENTINHO_HOME.x, y: ELEMENTINHO_HOME.y, respawn: ELEMENTINHO_RESPAWN },
];
