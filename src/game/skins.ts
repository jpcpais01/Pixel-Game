// Character skins (subtypes): alternate looks, and since the Pyromancer
// sometimes their own stats and abilities too. A character lists its skins in
// its registry entry (the first is its default look); the pick for each
// character is remembered in localStorage. Gameplay differences live in the
// hero's spawn, which gets the worn skin's id.

import type { CharacterDef } from './characters';

const KEY = 'pixel-battle.skins';

export interface SkinDef {
  id: string;
  name: string;
  /** What changes on the select card and the HUD while this skin is worn. */
  role?: string;
  accent?: number;
  /** A subtype that plays differently shows its own pips. */
  stats?: CharacterDef['stats'];
  attack?: string;
  special?: string;
  preview?: CharacterDef['preview'];
  buttons?: CharacterDef['buttons'];
}

function load(): Record<string, string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Record<string, string>;
  } catch {
    // Storage unavailable or corrupt: everyone wears their default look.
  }
  return {};
}

const chosen = load();

/** The skin a character is wearing (its first skin unless another was picked). */
export function skinOf(def: CharacterDef): SkinDef | undefined {
  const skins = def.skins;
  if (!skins?.length) return undefined;
  return skins.find((s) => s.id === chosen[def.id]) ?? skins[0];
}

export function setSkin(def: CharacterDef, skinId: string): void {
  chosen[def.id] = skinId;
  try {
    localStorage.setItem(KEY, JSON.stringify(chosen));
  } catch {
    // Not persisted; the pick still applies for this visit.
  }
}

/** The character as it looks in its current skin, spawning in that skin. */
export function wear(def: CharacterDef): CharacterDef {
  const skin = skinOf(def);
  if (!skin) return def;
  const { id: _id, name: _name, ...looks } = skin;
  return { ...def, ...looks, spawn: (world, x, y) => def.spawn(world, x, y, skin.id) };
}
