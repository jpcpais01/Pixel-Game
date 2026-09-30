// Build mode in the Home, shared between the HUD that picks what to build
// (ui/buildHud.ts, in UIScene) and the world that builds it (world/Home.ts).
// The HUD writes the pick and the pointer; the world reads them each frame.

import { FLOORS, PARTS, ROOFS, TABS, WALLS, WALL_ITEMS, wallKind, wallMat, type BuildTab } from '../world/homeParts';

/** One thing on the palette: which layer it paints (or thing it places), its value, name and picture. */
export interface PaletteItem {
  layer: 'floor' | 'wall' | 'roof' | 'thing';
  /** The floor, wall or roof value, for the layers. */
  value: number;
  /** The part, for things. */
  id: string;
  name: string;
  icon: { key: string; frame?: string };
}

/** Each tab's palette. The world's art must be warm (see art/homeArt.ts) before these icons exist. */
export function palette(tab: BuildTab, partIcon: (id: string) => { key: string; frame: string }, wallIcon: (mat: number, frame: string) => { key: string; frame: string }): PaletteItem[] {
  switch (tab) {
    case 'floor':
      return FLOORS.map((f, i) => ({ layer: 'floor', value: i + 1, id: f.id, name: f.name, icon: { key: `hs_f${i + 1}` } }));
    case 'wall':
      return WALL_ITEMS.map((w) => {
        const kind = wallKind(w.value);
        const frame = kind === 'door' ? 'd10' : kind === 'window' ? 'n10' : 'w10_0';
        return { layer: 'wall', value: w.value, id: w.id, name: w.name, icon: wallIcon(wallMat(w.value), frame) };
      });
    case 'roof':
      return ROOFS.map((r, i) => ({ layer: 'roof', value: i + 1, id: r.id, name: `${r.name} roof`, icon: { key: `hs_r${i + 1}` } }));
    default:
      return PARTS.filter((p) => p.tab === tab).map((p) => ({ layer: 'thing', value: 0, id: p.id, name: p.name, icon: partIcon(p.id) }));
  }
}

export const build = {
  /** The hero is in a Home, theirs or a friend's (the invite button shows). Set by the world. */
  home: false,
  /** In a Home the player may build: their own (not a friend's they're visiting). Set by the world. */
  available: false,
  /** Build mode is on: the palette shows and taps on the world build. */
  on: false,
  tab: 'floor' as BuildTab,
  /** What's picked: a palette item, or null for the eraser. */
  pick: null as PaletteItem | null,
  /** Things that can be mirrored go down mirrored. */
  flip: false,
  /** Things that turn go down facing this way: 0 front, 1 right, 2 back, 3 left. */
  turn: 0,
  /** The pointer building on the world, in screen pixels: down, and whether it erases (a right click). */
  pointer: { x: 0, y: 0, down: false, erase: false, over: false },
  /** Presses and releases since the world last looked. */
  pressed: false,
  released: false,
  /** Undo asked for (the world takes it); and whether there is anything to undo. */
  undo: false,
  canUndo: false,
  /** The friends panel asked for (the world opens it). */
  friends: false,
};

/** Leave build mode (the world closes, or the HUD's Done). */
export function stopBuilding(): void {
  build.on = false;
  build.pointer.down = build.pointer.over = false;
  build.pressed = build.released = false;
}

export { TABS, WALLS };
