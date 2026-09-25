// The world's regions, south to north. Each has a name (shown as the hero
// walks in) and its own monsters. A new region is an entry here, its shape
// in layout.ts and its ground in art/ground.ts.

import type { SpawnSpot } from '../game/monsters';
import { GLADES, PLAZA_Y, pathHalfW, pathX, walkable } from './layout';

export interface Region {
  id: string;
  name: string;
  /** World y where the region begins (its southern edge is the next region's top). */
  top: number;
}

export const REGIONS: Region[] = [
  { id: 'forest', name: 'Sunveil Wood', top: 0 },
  { id: 'plaza', name: 'Runestone Clearing', top: PLAZA_Y },
];

/**
 * The region at world y. Crossing a border counts only a little way past it,
 * so walking along the line doesn't flicker between the two.
 */
export function regionAt(y: number, current: Region | null): Region {
  const found = [...REGIONS].reverse().find((r) => y >= r.top) ?? REGIONS[0];
  if (!current || found === current) return found;
  const border = Math.max(found.top, current.top);
  return Math.abs(y - border) < 24 ? current : found;
}

/**
 * The forest's monsters, in small groups beside the path as it winds north:
 * frogs and puffcaps as on the plaza, barklings (slow, rooted in the earth)
 * and glowmoths (fluttering divers). The glades hold bigger packs.
 */
export const FOREST_SPAWNS: SpawnSpot[] = (() => {
  type Kind = SpawnSpot['kind'];
  const groups: { y: number; side: -1 | 1; kinds: Kind[] }[] = [
    { y: PLAZA_Y - 150, side: 1, kinds: ['frog'] },
    { y: PLAZA_Y - 300, side: -1, kinds: ['puffcap', 'puffcap', 'puffcap'] },
    { y: PLAZA_Y - 430, side: 1, kinds: ['glowmoth', 'glowmoth'] },
    { y: 1110, side: -1, kinds: ['barkling'] },
    { y: 900, side: 1, kinds: ['frog', 'puffcap', 'puffcap'] },
    { y: 780, side: -1, kinds: ['glowmoth', 'frog'] },
    { y: 640, side: 1, kinds: ['barkling', 'puffcap'] },
    { y: 330, side: 1, kinds: ['glowmoth', 'glowmoth', 'glowmoth'] },
    { y: 200, side: -1, kinds: ['barkling', 'frog'] },
    { y: 70, side: 1, kinds: ['barkling', 'glowmoth', 'puffcap', 'puffcap'] },
  ];
  // Each glade is a den: a barkling guarding a few others.
  for (const g of GLADES) {
    groups.push({ y: g.y, side: g.side as -1 | 1, kinds: ['barkling', 'glowmoth', 'puffcap', 'puffcap', 'frog'] });
  }
  const spots: SpawnSpot[] = [];
  for (const g of groups) {
    g.kinds.forEach((kind, i) => {
      const y = g.y + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 12;
      const px = pathX(y);
      // Just off the path, nearer the trees for the later ones; step back toward the path if that is blocked.
      let off = pathHalfW(y) + 16 + i * 9;
      let x = px + g.side * off;
      while (!walkable(x, y) && off > 0) {
        off -= 4;
        x = px + g.side * off;
      }
      spots.push({ kind, x: Math.round(x), y: Math.round(y) });
    });
  }
  return spots;
})();
