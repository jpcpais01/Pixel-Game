// Aurendel, the realm the arenas lie in: where each arena sits on the world
// map, the road between them, the lands' names and a line of lore for each
// place. Plain data, so the map's art (drawn in a worker) and the arena
// select both read it. Also what the player has done there: places walked
// into (their fog parts on the map) and bosses slain (a flag is planted).
//
// A new arena needs a place here to stand on the map; until it has one it
// is given a spare spot along the south coast with a waymarker.

/** The world map's size, in art pixels. */
export const MAP_W = 640;
export const MAP_H = 448;

export const REALM_NAME = 'Aurendel';

export interface Boss {
  kind: string;
  name: string;
  rank: 'legend' | 'myth';
}

export interface Place {
  /** The arena's id. */
  id: string;
  /** The landmark's foot on the map. */
  x: number;
  y: number;
  /** Where the road ends and the hero stands, when it isn't just in front and to the left. */
  stand?: { x: number; y: number };
  region: string;
  lore: string;
  /** A short line under the lore when the place has no boss (bosses are listed instead). */
  note?: string;
  bosses?: Boss[];
  /** Glowing points on the landmark (offsets from its foot) and their colour. */
  glows?: { dx: number; dy: number; r: number; tint: number }[];
}

export const PLACES: Place[] = [
  {
    id: 'clearing',
    x: 300,
    y: 318,
    region: 'Heartvale',
    lore: 'Where every legend begins. The Rune Temple keeps the old stones awake.',
    note: 'Home of Nyx and Tharn',
    glows: [
      { dx: 0, dy: -9, r: 10, tint: 0xffb45a },
      { dx: 0, dy: -30, r: 8, tint: 0x7ae8ff },
    ],
  },
  {
    id: 'garden',
    x: 204,
    y: 352,
    region: 'Bloomhollow',
    lore: 'A drowned palace of the first kings, lost under flowers tall as towers.',
    note: 'Frogs, beetles, puffcaps',
    glows: [{ dx: 0, dy: -6, r: 10, tint: 0x9ae8ff }],
  },
  {
    id: 'spirit',
    x: 124,
    y: 236,
    region: 'The Gloamwood',
    lore: 'In the Gloamwood the dead do not rest. Their queen still keeps her court.',
    bosses: [{ kind: 'queen', name: 'The Hollow Queen', rank: 'legend' }],
    glows: [{ dx: 0, dy: -8, r: 12, tint: 0x6af4dc }],
  },
  {
    id: 'temple',
    x: 454,
    y: 266,
    region: 'The Emberwaste',
    lore: 'Four elements were bound here. One small flame refused to go out.',
    bosses: [{ kind: 'elementinho', name: 'Elementinho', rank: 'legend' }],
    glows: [{ dx: 0, dy: -30, r: 12, tint: 0xff8a2a }],
  },
  {
    id: 'deep',
    x: 340,
    y: 180,
    region: 'Shardspine Mountains',
    lore: 'Beneath the Shardspine, a cave lit by living light. Something feeds there.',
    bosses: [
      { kind: 'sporemother', name: 'The Sporemother', rank: 'legend' },
      { kind: 'wyrm', name: 'Amethrax', rank: 'myth' },
    ],
    glows: [{ dx: 0, dy: -6, r: 12, tint: 0xb37aff }],
  },
  {
    id: 'cosmos',
    x: 262,
    y: 106,
    stand: { x: 248, y: 114 },
    region: 'Starfall Peak',
    lore: 'Atop Starfall Peak the sky wears thin, and the stars come down to fight.',
    bosses: [{ kind: 'warden', name: 'The Astral Warden', rank: 'myth' }],
    glows: [{ dx: 0, dy: -44, r: 16, tint: 0xb89cff }],
  },
  {
    id: 'rift',
    x: 150,
    y: 132,
    region: 'The Sundered Reach',
    lore: 'The land split open in the Sundering. Things still crawl out of the tear.',
    note: 'How long can you last?',
    glows: [{ dx: 0, dy: -4, r: 16, tint: 0xff5ac0 }],
  },
  {
    id: 'island',
    x: 574,
    y: 340,
    stand: { x: 572, y: 322 },
    region: 'The Glass Sea',
    lore: 'A ring of marble adrift above the Glass Sea, where champions settle scores.',
    note: 'Duels for two, online',
  },
];

/**
 * The road: each leg joins two places (by id) through a few waypoints. From
 * waypoint `skyFrom` on, a leg leaves the land: a faint trail of light over
 * the sea (the Floating Island is reached from the Windward Cliffs).
 */
export interface Leg {
  a: string;
  b: string;
  via: [number, number][];
  skyFrom?: number;
}

/** The cliff's edge the Floating Island is reached from (and, one day, glided from). */
export const WINDWARD_CLIFFS = { x: 514, y: 318 };

export const LEGS: Leg[] = [
  { a: 'clearing', b: 'garden', via: [[262, 338], [236, 352]] },
  { a: 'clearing', b: 'deep', via: [[304, 288], [318, 250], [316, 214]] },
  { a: 'clearing', b: 'temple', via: [[336, 320], [376, 310], [410, 290]] },
  { a: 'garden', b: 'spirit', via: [[172, 334], [160, 300], [138, 268]] },
  { a: 'spirit', b: 'rift', via: [[106, 206], [118, 172], [132, 150]] },
  { a: 'deep', b: 'cosmos', via: [[312, 172], [292, 156], [272, 144], [256, 130]] },
  { a: 'temple', b: 'island', via: [[478, 292], [WINDWARD_CLIFFS.x, WINDWARD_CLIFFS.y], [540, 324]], skyFrom: 1 },
];

/** Names written across the map, centred on these spots. */
export const LABELS: { text: string; x: number; y: number; sea?: boolean; big?: boolean }[] = [
  { text: 'Heartvale', x: 300, y: 370 },
  { text: 'Bloomhollow', x: 150, y: 396 },
  { text: 'The Gloamwood', x: 92, y: 290 },
  { text: 'Shardspine Mountains', x: 414, y: 98 },
  { text: 'The Emberwaste', x: 452, y: 216 },
  { text: 'The Sundered Reach', x: 98, y: 156 },
  { text: 'Windward Cliffs', x: 510, y: 346 },
  { text: 'The Glass Sea', x: 580, y: 250, sea: true, big: true },
  { text: 'The Dusk Sea', x: 44, y: 400, sea: true, big: true },
];

/** Spots for arenas that have no place of their own yet (a waymarker stands there). */
const SPARE: [number, number][] = [
  [410, 372],
  [250, 404],
  [440, 330],
  [120, 332],
];

export function placeFor(id: string, index: number): Place {
  const known = PLACES.find((p) => p.id === id);
  if (known) return known;
  const [x, y] = SPARE[index % SPARE.length];
  return { id, x, y, region: REALM_NAME, lore: 'A place not yet on the old maps.' };
}

/** Where the hero stands at a place: the road's end. */
export const standAt = (p: Place): { x: number; y: number } => p.stand ?? { x: p.x - 18, y: p.y + 6 };

export interface Pt {
  x: number;
  y: number;
}

/** A smooth line through the points (Catmull-Rom), as points `step` px apart along it. */
export function smoothLine(pts: Pt[], step = 1): Pt[] {
  if (pts.length < 2) return pts.slice();
  const dense: Pt[] = [];
  const cr = (a: number, b: number, c: number, d: number, t: number) =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < 24; k++) {
      const t = k / 24;
      dense.push({ x: cr(p0.x, p1.x, p2.x, p3.x, t), y: cr(p0.y, p1.y, p2.y, p3.y, t) });
    }
  }
  dense.push(pts[pts.length - 1]);
  // Even spacing, so dots along it sit evenly and a walk along it is steady.
  const out: Pt[] = [dense[0]];
  let carry = 0;
  for (let i = 1; i < dense.length; i++) {
    const a = dense[i - 1];
    const b = dense[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    let d = step - carry;
    while (d <= len) {
      const t = d / len;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      d += step;
    }
    carry = len - (d - step);
  }
  const last = dense[dense.length - 1];
  if (Math.hypot(out[out.length - 1].x - last.x, out[out.length - 1].y - last.y) > step * 0.25) out.push(last);
  return out;
}

/** A leg's road from `a` to `b`, 1 px apart: the walked part, then the part over the sea (if any). */
export function legRoad(leg: Leg, places: Place[]): { walk: Pt[]; sky: Pt[] } {
  const a = places.find((p) => p.id === leg.a);
  const b = places.find((p) => p.id === leg.b);
  if (!a || !b) return { walk: [], sky: [] };
  const pts: Pt[] = [standAt(a), ...leg.via.map(([x, y]) => ({ x, y })), standAt(b)];
  if (leg.skyFrom === undefined) return { walk: smoothLine(pts), sky: [] };
  const k = leg.skyFrom + 1;
  return { walk: smoothLine(pts.slice(0, k + 1)), sky: smoothLine(pts.slice(k)) };
}

// ---------------------------------------------------------------- What the player has done

const KEY = 'pixel-battle.realm';

interface Progress {
  /** Places walked into. */
  seen: string[];
  /** Places whose fog has already parted on the map. */
  unveiled: string[];
  /** Bosses slain, by monster kind. */
  slain: string[];
  /** Bosses whose flag has already been planted on the map. */
  flagged: string[];
}

function load(): Progress {
  let p: Partial<Progress> = {};
  try {
    p = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Progress>;
  } catch {
    // Blocked or broken: start again.
  }
  // Home is always known. So is the arena last played, for players from before the map.
  let last: string | null = null;
  try {
    last = localStorage.getItem('pixel-battle.arena');
  } catch {
    last = null;
  }
  const seen = new Set(p.seen ?? []);
  const unveiled = new Set(p.unveiled ?? []);
  for (const id of ['clearing', last]) {
    if (!id) continue;
    if (!p.seen) unveiled.add(id);
    seen.add(id);
  }
  return { seen: [...seen], unveiled: [...unveiled], slain: p.slain ?? [], flagged: p.flagged ?? [] };
}

function save(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Not kept; the map just shows it again next time.
  }
}

export const realm = {
  get: load,
  /** The player went into a place. */
  visit(id: string): void {
    const p = load();
    if (!p.seen.includes(id)) p.seen.push(id);
    save(p);
  },
  /** A boss fell (only a boss's kind is ever passed). */
  slay(kind: string): void {
    const p = load();
    if (p.slain.includes(kind)) return;
    p.slain.push(kind);
    save(p);
  },
  /** The map has shown these places' fog parting and these flags going up: don't play it again. */
  shown(unveiled: string[], flagged: string[]): void {
    const p = load();
    for (const id of unveiled) if (!p.unveiled.includes(id)) p.unveiled.push(id);
    for (const k of flagged) if (!p.flagged.includes(k)) p.flagged.push(k);
    save(p);
  },
};
