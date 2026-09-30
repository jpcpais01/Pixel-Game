// Everything the player can build their Home from (see homeLayout.ts for how
// a home is laid out, art/homeFloors.ts, homeWalls.ts and homeProps.ts for how
// each part looks, and world/Home.ts for how they stand in the world).
//
// A home has four layers on its grid: floors painted over the lawn, walls
// (with doors and windows) joining up with their neighbours, roofs over them,
// and things placed on it: plants, furniture, lights, and decorations hung on
// walls. The build palette lists these in order, tab by tab.

/** The palette's tabs, in order; each is a layer or a kind of thing to place. */
export type BuildTab = 'floor' | 'wall' | 'roof' | 'garden' | 'furniture' | 'light' | 'decor';

export const TABS: { id: BuildTab; name: string }[] = [
  { id: 'floor', name: 'Floors' },
  { id: 'wall', name: 'Walls' },
  { id: 'roof', name: 'Roofs' },
  { id: 'garden', name: 'Garden' },
  { id: 'furniture', name: 'Furniture' },
  { id: 'light', name: 'Lights' },
  { id: 'decor', name: 'Wall decor' },
];

// ---------------------------------------------------------------- Floors

/**
 * Floors, painted a cell at a time. Soft ones (grass, paths, water) melt into
 * their neighbours with ragged, rounded edges; laid ones (boards, tiles,
 * cobbles) keep to their cells. Their index in this list, from 1, is what the
 * layout stores (0 is bare lawn).
 */
export interface FloorDef {
  id: string;
  name: string;
  /** Blends into its neighbours rather than keeping to its cells. */
  soft?: boolean;
  /** Feet can't cross it (the pond). */
  water?: boolean;
}

export const FLOORS: FloorDef[] = [
  { id: 'lawn', name: 'Lawn', soft: true },
  { id: 'meadow', name: 'Wildflowers', soft: true },
  { id: 'soil', name: 'Garden bed' },
  { id: 'path', name: 'Dirt path', soft: true },
  { id: 'gravel', name: 'Gravel', soft: true },
  { id: 'sand', name: 'Sand', soft: true },
  { id: 'pond', name: 'Pond', soft: true, water: true },
  { id: 'cobble', name: 'Cobbles' },
  { id: 'flags', name: 'Flagstones' },
  { id: 'bricks', name: 'Brick paving' },
  { id: 'oak', name: 'Oak boards' },
  { id: 'walnut', name: 'Walnut boards' },
  { id: 'marble', name: 'Marble' },
  { id: 'terracotta', name: 'Terracotta' },
  { id: 'ashlar', name: 'Stone floor' },
];

export const floorIndex = (id: string): number => FLOORS.findIndex((f) => f.id === id) + 1;

// ---------------------------------------------------------------- Walls

/**
 * Wall materials. A wall cell joins the walls beside it into one run; a house
 * wall can also be a door (walked through) or a window, and a garden wall a
 * gate. `height` is how tall its face stands, `thick` how wide its footprint.
 */
export interface WallDef {
  id: string;
  name: string;
  height: number;
  thick: number;
  /** A house wall: it has doors and windows (garden walls have a gate). */
  house: boolean;
}

export const WALLS: WallDef[] = [
  { id: 'stone', name: 'Fieldstone', height: 28, thick: 6, house: true },
  { id: 'timber', name: 'Timber frame', height: 28, thick: 6, house: true },
  { id: 'logs', name: 'Log cabin', height: 28, thick: 6, house: true },
  { id: 'brick', name: 'Red brick', height: 28, thick: 6, house: true },
  { id: 'hedge', name: 'Hedge', height: 15, thick: 8, house: false },
  { id: 'fence', name: 'Picket fence', height: 11, thick: 2, house: false },
  { id: 'lowwall', name: 'Garden wall', height: 10, thick: 8, house: false },
];

/** What a wall cell is: a plain wall, a doorway (or gate), or a window. */
export type WallKind = 'wall' | 'door' | 'window';
const KINDS: WallKind[] = ['wall', 'door', 'window'];

/** A wall cell as the layout stores it: its material (from 1) and kind packed in one number (0 is none). */
export const packWall = (mat: number, kind: WallKind): number => (mat + 1) * 4 + KINDS.indexOf(kind);
export const wallMat = (v: number): number => (v >> 2) - 1;
export const wallKind = (v: number): WallKind => KINDS[v & 3] ?? 'wall';

/** The wall palette: every material's wall, then its door (or gate) and window. */
export const WALL_ITEMS: { id: string; name: string; value: number }[] = WALLS.flatMap((w, i) => [
  { id: `${w.id}`, name: w.name, value: packWall(i, 'wall') },
  { id: `${w.id}_door`, name: w.house ? `${w.name} door` : `${w.name} gate`, value: packWall(i, 'door') },
  ...(w.house ? [{ id: `${w.id}_window`, name: `${w.name} window`, value: packWall(i, 'window') }] : []),
]);

// ---------------------------------------------------------------- Roofs

/** Roofs, painted over a house; each joined patch becomes one roof, hipped to fit whatever shape it covers. */
export const ROOFS: { id: string; name: string }[] = [
  { id: 'slate', name: 'Slate' },
  { id: 'clay', name: 'Clay tiles' },
  { id: 'thatch', name: 'Thatch' },
  { id: 'shingle', name: 'Shingles' },
];

// ---------------------------------------------------------------- Things

/** How a placed thing stops feet: not at all, round its trunk or post, or over its whole footprint. */
export type Block = 'none' | 'post' | 'full';

export interface PartDef {
  id: string;
  name: string;
  tab: 'garden' | 'furniture' | 'light' | 'decor';
  /** Footprint in cells. */
  w: number;
  h: number;
  block: Block;
  /** Lies flat on the floor (rugs, lily pads): under everything, and it can sit under other things. */
  flat?: boolean;
  /** Only on water (lily pads), or allowed on it too (reeds). */
  water?: 'only' | 'too';
  /** Hung on the face of a wall. */
  wall?: boolean;
  /** Can be mirrored. */
  flip?: boolean;
  /** A light it gives off: colour, reach, strength, how much of it the day washes out, and its height above the base. */
  light?: { color: number; radius: number; intensity: number; day: number; y: number; flicker?: boolean };
  /** A chimney rises from the roof above it, smoking. */
  chimney?: boolean;
  /** Shows this many of the owner's caught critters in their jars along its top (see game/critters.ts). */
  jars?: number;
}

export const PARTS: PartDef[] = [
  // Garden
  { id: 'oak', name: 'Oak tree', tab: 'garden', w: 1, h: 1, block: 'post' },
  { id: 'birch', name: 'Birch tree', tab: 'garden', w: 1, h: 1, block: 'post' },
  { id: 'pine', name: 'Pine tree', tab: 'garden', w: 1, h: 1, block: 'post' },
  { id: 'blossom', name: 'Cherry tree', tab: 'garden', w: 1, h: 1, block: 'post' },
  { id: 'bush', name: 'Bush', tab: 'garden', w: 1, h: 1, block: 'post', flip: true },
  { id: 'roses', name: 'Rose bush', tab: 'garden', w: 1, h: 1, block: 'post', flip: true },
  { id: 'fern', name: 'Fern', tab: 'garden', w: 1, h: 1, block: 'none', flip: true },
  { id: 'tulips', name: 'Tulips', tab: 'garden', w: 1, h: 1, block: 'none', flip: true },
  { id: 'lavender', name: 'Lavender', tab: 'garden', w: 1, h: 1, block: 'none', flip: true },
  { id: 'sunflowers', name: 'Sunflowers', tab: 'garden', w: 1, h: 1, block: 'none', flip: true },
  { id: 'cabbages', name: 'Cabbages', tab: 'garden', w: 1, h: 1, block: 'none', flip: true },
  { id: 'pumpkin', name: 'Pumpkin', tab: 'garden', w: 1, h: 1, block: 'post', flip: true },
  { id: 'planter', name: 'Flower box', tab: 'garden', w: 2, h: 1, block: 'full' },
  { id: 'rock', name: 'Mossy rock', tab: 'garden', w: 1, h: 1, block: 'post', flip: true },
  { id: 'stump', name: 'Stump', tab: 'garden', w: 1, h: 1, block: 'post', flip: true },
  { id: 'stepping', name: 'Stepping stones', tab: 'garden', w: 1, h: 1, block: 'none', flat: true, flip: true },
  { id: 'lilypad', name: 'Lily pads', tab: 'garden', w: 1, h: 1, block: 'none', flat: true, water: 'only', flip: true },
  { id: 'reeds', name: 'Reeds', tab: 'garden', w: 1, h: 1, block: 'none', water: 'too', flip: true },
  { id: 'bench', name: 'Garden bench', tab: 'garden', w: 2, h: 1, block: 'full' },
  { id: 'well', name: 'Well', tab: 'garden', w: 2, h: 2, block: 'full' },
  { id: 'birdbath', name: 'Birdbath', tab: 'garden', w: 1, h: 1, block: 'post' },
  { id: 'scarecrow', name: 'Scarecrow', tab: 'garden', w: 1, h: 1, block: 'post', flip: true },
  { id: 'haybale', name: 'Hay bale', tab: 'garden', w: 1, h: 1, block: 'full', flip: true },
  { id: 'mailbox', name: 'Mailbox', tab: 'garden', w: 1, h: 1, block: 'post', flip: true },
  { id: 'signpost', name: 'Signpost', tab: 'garden', w: 1, h: 1, block: 'post', flip: true },

  // Furniture
  { id: 'bed', name: 'Bed', tab: 'furniture', w: 1, h: 2, block: 'full', flip: true },
  { id: 'bigbed', name: 'Double bed', tab: 'furniture', w: 2, h: 2, block: 'full' },
  { id: 'bookshelf', name: 'Bookshelf', tab: 'furniture', w: 2, h: 1, block: 'full' },
  { id: 'wardrobe', name: 'Wardrobe', tab: 'furniture', w: 2, h: 1, block: 'full' },
  { id: 'dresser', name: 'Dresser', tab: 'furniture', w: 1, h: 1, block: 'full', flip: true },
  { id: 'table', name: 'Table', tab: 'furniture', w: 2, h: 1, block: 'full' },
  { id: 'roundtable', name: 'Round table', tab: 'furniture', w: 1, h: 1, block: 'full' },
  { id: 'chair', name: 'Chair', tab: 'furniture', w: 1, h: 1, block: 'post', flip: true },
  { id: 'stool', name: 'Stool', tab: 'furniture', w: 1, h: 1, block: 'post' },
  { id: 'sofa', name: 'Sofa', tab: 'furniture', w: 2, h: 1, block: 'full' },
  { id: 'desk', name: 'Writing desk', tab: 'furniture', w: 2, h: 1, block: 'full', flip: true },
  { id: 'chest', name: 'Chest', tab: 'furniture', w: 1, h: 1, block: 'full', flip: true },
  { id: 'barrel', name: 'Barrel', tab: 'furniture', w: 1, h: 1, block: 'full' },
  { id: 'crate', name: 'Crates', tab: 'furniture', w: 1, h: 1, block: 'full', flip: true },
  { id: 'fireplace', name: 'Fireplace', tab: 'furniture', w: 2, h: 1, block: 'full', chimney: true, light: { color: 0xff9a48, radius: 130, intensity: 1.9, day: 0.35, y: 10, flicker: true } },
  { id: 'cauldron', name: 'Cauldron', tab: 'furniture', w: 1, h: 1, block: 'full', light: { color: 0x7aff8a, radius: 70, intensity: 1.2, day: 0.4, y: 10, flicker: true } },
  { id: 'clock', name: 'Tall clock', tab: 'furniture', w: 1, h: 1, block: 'full' },
  { id: 'armorstand', name: 'Armour stand', tab: 'furniture', w: 1, h: 1, block: 'post', flip: true },
  { id: 'weaponrack', name: 'Weapon rack', tab: 'furniture', w: 2, h: 1, block: 'full' },
  { id: 'jarshelf', name: 'Critter shelf', tab: 'furniture', w: 3, h: 1, block: 'full', jars: 3 },
  { id: 'plant', name: 'Potted plant', tab: 'furniture', w: 1, h: 1, block: 'post', flip: true },
  { id: 'rug', name: 'Red rug', tab: 'furniture', w: 3, h: 2, block: 'none', flat: true },
  { id: 'roundrug', name: 'Round rug', tab: 'furniture', w: 2, h: 2, block: 'none', flat: true },
  { id: 'runner', name: 'Long rug', tab: 'furniture', w: 1, h: 3, block: 'none', flat: true },

  // Lights
  { id: 'lamppost', name: 'Lamppost', tab: 'light', w: 1, h: 1, block: 'post', light: { color: 0xffc47a, radius: 120, intensity: 1.7, day: 0.15, y: 34 } },
  { id: 'lantern', name: 'Stone lantern', tab: 'light', w: 1, h: 1, block: 'post', light: { color: 0xffb060, radius: 90, intensity: 1.5, day: 0.2, y: 14, flicker: true } },
  { id: 'torch', name: 'Torch', tab: 'light', w: 1, h: 1, block: 'post', light: { color: 0xff9444, radius: 110, intensity: 1.8, day: 0.3, y: 24, flicker: true } },
  { id: 'campfire', name: 'Campfire', tab: 'light', w: 1, h: 1, block: 'full', light: { color: 0xff8a3a, radius: 140, intensity: 2.1, day: 0.35, y: 6, flicker: true } },
  { id: 'brazier', name: 'Brazier', tab: 'light', w: 1, h: 1, block: 'post', light: { color: 0xff9444, radius: 140, intensity: 2, day: 0.3, y: 16, flicker: true } },
  { id: 'crystal', name: 'Rune crystal', tab: 'light', w: 1, h: 1, block: 'post', light: { color: 0x9a6cff, radius: 100, intensity: 1.6, day: 0.45, y: 10 } },
  { id: 'candelabra', name: 'Candelabra', tab: 'light', w: 1, h: 1, block: 'post', light: { color: 0xffc070, radius: 90, intensity: 1.5, day: 0.25, y: 22, flicker: true } },
  { id: 'fairylights', name: 'Firefly jar', tab: 'light', w: 1, h: 1, block: 'post', light: { color: 0xc8ff7a, radius: 70, intensity: 1.2, day: 0.2, y: 8 } },

  // Wall decor
  { id: 'painting', name: 'Painting', tab: 'decor', w: 1, h: 1, block: 'none', wall: true, flip: true },
  { id: 'portrait', name: 'Portrait', tab: 'decor', w: 1, h: 1, block: 'none', wall: true },
  { id: 'banner', name: 'Banner', tab: 'decor', w: 1, h: 1, block: 'none', wall: true },
  { id: 'shield', name: 'Crest shield', tab: 'decor', w: 1, h: 1, block: 'none', wall: true },
  { id: 'antlers', name: 'Antlers', tab: 'decor', w: 1, h: 1, block: 'none', wall: true },
  { id: 'wallshelf', name: 'Wall shelf', tab: 'decor', w: 1, h: 1, block: 'none', wall: true, flip: true },
  { id: 'sconce', name: 'Wall sconce', tab: 'decor', w: 1, h: 1, block: 'none', wall: true, light: { color: 0xffb060, radius: 90, intensity: 1.5, day: 0.25, y: 0, flicker: true } },
  { id: 'wreath', name: 'Wreath', tab: 'decor', w: 1, h: 1, block: 'none', wall: true },
];

const byId = new Map(PARTS.map((p) => [p.id, p]));
export const partById = (id: string): PartDef | undefined => byId.get(id);
