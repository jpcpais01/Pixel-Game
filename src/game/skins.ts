// The type and skin each class is played in (see characters.ts), remembered
// in localStorage. Each class stores one look id: its type's own id, or one of
// that type's skins' ids, so the id alone gives both (and saves from before
// types existed, which stored the same ids, still load). Each type also
// remembers its last skin, so switching types and back keeps the look.

import type { CharacterDef, ClassDef, SkinDef, TypeDef } from './characters';

const KEY = 'pixel-battle.skins';
const TYPE_SKINS_KEY = 'pixel-battle.typeSkins';
const HERO_KEY = 'pixel-battle.hero';

function load(key: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as Record<string, string>;
  } catch {
    // Storage unavailable or corrupt: everyone plays their base look.
  }
  return {};
}

function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  } catch {
    // Not persisted; the pick still applies for this visit.
  }
}

/** Class id -> look id. */
const chosen = load(KEY);
/** "class.type" -> look id, for each type's last look. */
const typeLooks = load(TYPE_SKINS_KEY);

export interface Look {
  type: TypeDef;
  /** Null: the type's own look. */
  skin: SkinDef | null;
}

/** The type and skin a look id names within a class, if any. */
function find(cls: ClassDef, look: string | undefined): Look | null {
  if (!look) return null;
  for (const type of cls.types) {
    if (type.id === look) return { type, skin: null };
    const skin = type.skins?.find((s) => s.id === look);
    if (skin) return { type, skin };
  }
  return null;
}

/** The type and skin a class is played in (its base type's own look unless another was picked). */
export function lookOf(cls: ClassDef): Look {
  return find(cls, chosen[cls.id]) ?? { type: cls.types[0], skin: null };
}

/** The look a type was last worn in within this class. */
export function lastLookOf(cls: ClassDef, type: TypeDef): Look {
  const found = find(cls, typeLooks[`${cls.id}.${type.id}`]);
  return found && found.type === type ? found : { type, skin: null };
}

/** Play the class as `type`, in the skin that type was last worn in. */
export function setType(cls: ClassDef, type: TypeDef): void {
  const { skin } = lastLookOf(cls, type);
  setLook(cls, type, skin);
}

/** Play the class as `type` wearing `skin` (null: the type's own look). */
export function setLook(cls: ClassDef, type: TypeDef, skin: SkinDef | null): void {
  const id = skin?.id ?? type.id;
  chosen[cls.id] = id;
  typeLooks[`${cls.id}.${type.id}`] = id;
  save(KEY, chosen);
  save(TYPE_SKINS_KEY, typeLooks);
}

/** The class as it plays in this type and skin (by default the chosen ones), spawning in that look. */
export function worn(cls: ClassDef, look: Look = lookOf(cls)): CharacterDef {
  const { type, skin } = look;
  const id = skin?.id ?? type.id;
  return {
    id: cls.id,
    name: cls.name,
    type,
    skin,
    look: id,
    role: skin?.role ?? type.role,
    accent: skin?.accent ?? type.accent,
    stats: type.stats,
    attack: skin?.attack ?? type.attack,
    special: skin?.special ?? type.special,
    preview: skin?.preview ?? type.preview,
    buttons: skin?.buttons ?? type.buttons,
    chargeSpecial: cls.chargeSpecial,
    spawn: (world, x, y) => cls.spawn(world, x, y, id),
  };
}

/** The class picked last on the select screen. */
export const lastHero = (): string | null => {
  try {
    return localStorage.getItem(HERO_KEY);
  } catch {
    return null;
  }
};

export const rememberHero = (id: string): void => save(HERO_KEY, id);

/** The type and skin a look id names within a class (another player's hero, online), if any. */
export const lookById = find;
