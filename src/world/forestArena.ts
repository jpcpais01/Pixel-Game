import { CAMPFIRE, CAMPFIRE_FOOT, FPROP_BASE_Y, FPROP_H, FPROP_LOOKS, type FPropKind } from '../art/forest';
import { STRIP_H } from '../art/ground';
import { warmForest } from '../art/arenaLoader';
import { PROP_BASE_Y, PROP_H, TREE_BASE_Y, TREE_H } from '../art/trees';
import type { ArenaDef, PreviewSprite } from './arenas';
import { CHUNK, FOREST_MID, FOREST_WORLD, ForestGen, EVERWOOD_SEED, forestWalkable, type FProp } from './forestGen';

// The Everwood on the arena select: a forest without end, grown from a new
// seed each visit (online, from the room's code, so friends share one). The
// world builds it by id (see world/Forest.ts); what it needs from the entry
// is its size, light, drifting leaves and the window its card looks into,
// which is always the same forest (EVERWOOD_SEED), at its start.

let preview: { gen: ForestGen; col: number; row: number } | null = null;

/** The preview forest and the ground tile its window looks at (the one its start is on). */
function previewSpot(): { gen: ForestGen; col: number; row: number } {
  if (!preview) {
    const gen = new ForestGen(EVERWOOD_SEED);
    const at = gen.spawn();
    preview = { gen, col: Math.floor(at.x / CHUNK), row: Math.floor(at.y / STRIP_H) };
  }
  return preview;
}

/** Undergrowth as a preview sprite: the older forests' art, or the Everwood's own. */
function propSprite(p: FProp): PreviewSprite {
  const flora: Partial<Record<string, string>> = { bush: 'bush0', berry: 'bush1', fern: `fern${p.v % 2}`, stump: `stump${p.v % 2}`, log: 'log0', glowcap: 'shrooms0', redcap: 'shrooms1' };
  if (p.kind === 'rock') return { texture: 'rock', frame: `r${p.v % 3}`, x: p.x, y: p.y, originY: 12 / 14 };
  const f = flora[p.kind];
  if (f) return { texture: 'flora', frame: f, x: p.x, y: p.y, originY: PROP_BASE_Y / PROP_H };
  const k = p.kind as FPropKind;
  return { texture: 'fprop', frame: `${k}${p.v % FPROP_LOOKS[k]}`, glow: k === 'bigshroom' ? 'fprop_e' : undefined, x: p.x, y: p.y, originY: FPROP_BASE_Y / FPROP_H };
}

export const FOREST_ARENA: ArenaDef = {
  id: 'forest',
  name: 'The Everwood',
  blurb: 'A forest without end',
  accent: 0x8ad86a,
  ground: {
    painted: true,
    w: FOREST_WORLD,
    h: FOREST_WORLD,
    warm: warmForest,
    get layers() {
      const p = previewSpot();
      return [{ key: 'fr_preview', x: p.col * CHUNK, y: p.row * STRIP_H }];
    },
  },
  // The world starts the hero at the forest's own start (ForestGen.spawn).
  spawn: { x: FOREST_MID, y: FOREST_MID },
  // Its creatures come and go with the chunks (see ForestSpawner).
  monsters: [],
  scenery: () => ({ trees: [], props: [], rays: [], colliders: [] }),
  walkable: forestWalkable,
  drift: {
    tints: [0x5f9a4b, 0x80b35a, 0x3b753c, 0xd49e34, 0xe8802a],
    frequency: 700,
    where: () => true,
  },
  dayNight: true,
  preview: {
    get x() {
      return previewSpot().col * CHUNK + CHUNK / 2;
    },
    get y() {
      return previewSpot().row * STRIP_H + STRIP_H / 2;
    },
    sprites: () => {
      const { gen, col, row } = previewSpot();
      const out: PreviewSprite[] = [];
      const y0 = row * STRIP_H - TREE_H;
      const y1 = (row + 1) * STRIP_H + TREE_H;
      for (let cy = Math.floor(y0 / CHUNK); cy <= Math.floor(y1 / CHUNK); cy++) {
        const l = gen.layout(col, cy);
        for (const t of l.trees) {
          const old = t.kind === 'oak' || t.kind === 'birch' || t.kind === 'pine';
          out.push({ texture: old ? 'tree' : 'ftree', frame: `${t.kind}${t.v}`, x: t.x, y: t.y, originY: TREE_BASE_Y / TREE_H });
        }
        for (const p of l.props) out.push(propSprite(p));
        for (const p of l.pois) if (p.kind === 'campfire') out.push({ texture: 'fcamp', frame: 'c0', glow: 'fcamp_e', x: p.x, y: p.y, originY: CAMPFIRE_FOOT.y / CAMPFIRE.h });
      }
      return out;
    },
  },
};
