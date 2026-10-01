// The character and skin each class is played in (see characters.ts),
// remembered in localStorage. Each class stores its kit and a look id ("kit:look"):
// the look is a type's own id or one of that type's skins' ids, so the two
// give both the type and the skin. Each type also remembers its last skin, so
// switching characters and back keeps the look.
//
// Before the classes were regrouped, each class was a kit and stored one look
// id under its kit's id. Those picks are still written (the kits' ids didn't
// change), and the first time a class is opened it starts from them: from the
// kit last played if it is in this class, else from its first kit.

import { classById, kitById, kitOf, type CharacterDef, type ClassDef, type SkinDef, type TypeDef } from './characters';
import { collection } from './collection';

/** Kit id -> look id. */
const KEY = 'pixel-battle.skins';
/** Class id -> "kit:look". */
const LOOKS_KEY = 'pixel-battle.looks';
/** "kit.type" -> look id. */
const TYPE_SKINS_KEY = 'pixel-battle.typeSkins';
/** The class picked last (a kit's id, in saves from before the regrouping). */
const HERO_KEY = 'pixel-battle.hero';

function load(key: string): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as Record<string, string>;
  } catch {
    // Storage unavailable or corrupt: everyone plays their base look.
  }
  return null;
}

function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  } catch {
    // Not persisted; the pick still applies for this visit.
  }
}

function heroSaved(): string | null {
  try {
    return localStorage.getItem(HERO_KEY);
  } catch {
    return null;
  }
}

/** Kit id -> look id. */
const chosen = load(KEY) ?? {};
/** "kit.type" -> look id, for each type's last look. */
const typeLooks = load(TYPE_SKINS_KEY) ?? {};
/** Class id -> "kit:look"; filled in the first time it's asked for (the classes aren't built yet while this module loads). */
let picks: Record<string, string> | null = null;

export interface Look {
  type: TypeDef;
  /** Null: the type's own look. */
  skin: SkinDef | null;
}

/** The type and skin a look id names within a kit, if any. */
export function lookIn(kit: string | undefined, look: string | undefined): Look | null {
  if (!look) return null;
  for (const type of kitById(kit)?.types ?? []) {
    if (type.id === look) return { type, skin: null };
    const skin = type.skins?.find((s) => s.id === look);
    if (skin) return { type, skin };
  }
  return null;
}

/** The type and skin a "kit:look" names within a class, if any. */
function find(cls: ClassDef, pick: string | undefined): Look | null {
  const at = pick?.indexOf(':') ?? -1;
  if (!pick || at < 0) return null;
  const found = lookIn(pick.slice(0, at), pick.slice(at + 1));
  return found && cls.types.includes(found.type) ? found : null;
}

/** The classes' picks, carried over from the kits' on the first visit after the regrouping. */
function classPicks(): Record<string, string> {
  if (picks) return picks;
  picks = load(LOOKS_KEY);
  if (picks) return picks;
  picks = {};
  const hero = heroSaved();
  const cls = classById(hero ?? undefined);
  const kits = [...new Set(cls.types.map((t) => kitOf(t).id))];
  // The kit last played opens its class; every other class opens at its first kit's pick.
  const kit = kits.includes(hero ?? '') ? hero! : kits[0];
  if (lookIn(kit, chosen[kit])) picks[cls.id] = `${kit}:${chosen[kit]}`;
  if (hero) save(HERO_KEY, cls.id);
  save(LOOKS_KEY, picks);
  return picks;
}

/** A class's pick, or where it opens: its first kit's last pick, else its first character's own look. */
function pickOf(cls: ClassDef): Look {
  const found = find(cls, classPicks()[cls.id]);
  if (found) return found;
  const first = kitOf(cls.types[0]).id;
  return lookIn(first, chosen[first]) ?? { type: cls.types[0], skin: null };
}

/** Skins are won from wishes in the shop (see gacha.ts); a type's own look is always there. */
export const ownsSkin = (skin: SkinDef | null): boolean => !skin || collection.hasSkin(`${kitOf(skin).id}:${skin.id}`);

/** A look as the player may wear it: a skin they don't own falls back to its type's own look. */
const owned = (look: Look): Look => (ownsSkin(look.skin) ? look : { type: look.type, skin: null });

/** The character and skin a class is played in (its first character's own look unless another was picked). */
export function lookOf(cls: ClassDef): Look {
  return owned(pickOf(cls));
}

/** The look a character was last worn in. */
export function lastLookOf(_cls: ClassDef, type: TypeDef): Look {
  const kit = kitOf(type).id;
  const found = lookIn(kit, typeLooks[`${kit}.${type.id}`]);
  return owned(found && found.type === type ? found : { type, skin: null });
}

/** Play the class as `type`, in the skin that type was last worn in. */
export function setType(cls: ClassDef, type: TypeDef): void {
  const { skin } = lastLookOf(cls, type);
  setLook(cls, type, skin);
}

/** Play the class as `type` wearing `skin` (null: the type's own look). */
export function setLook(cls: ClassDef, type: TypeDef, skin: SkinDef | null): void {
  const kit = kitOf(type).id;
  const id = skin?.id ?? type.id;
  classPicks()[cls.id] = `${kit}:${id}`;
  chosen[kit] = id;
  typeLooks[`${kit}.${type.id}`] = id;
  save(LOOKS_KEY, picks);
  save(KEY, chosen);
  save(TYPE_SKINS_KEY, typeLooks);
}

/** The class as it plays in this type and skin (by default the chosen ones), spawning in that look. */
export function worn(cls: ClassDef, look: Look = lookOf(cls)): CharacterDef {
  const { type, skin } = look;
  const kit = kitOf(type);
  const id = skin?.id ?? type.id;
  return {
    id: kit.id,
    name: cls.name,
    type,
    skin,
    look: id,
    role: type.role,
    accent: skin?.accent ?? type.accent,
    attack: type.attack,
    special: type.special,
    preview: skin?.preview ?? type.preview,
    buttons: skin?.buttons ?? type.buttons,
    chargeSpecial: kit.chargeSpecial,
    spawn: (world, x, y) => kit.spawn(world, x, y, id),
  };
}

/**
 * Another player's hero, as they sent it: `kit` a kit's id and `look` a look
 * id within it. A kit since retired, or a look not found, plays as the class's
 * own first look.
 */
export function playedAs(kit: string | undefined, look: string | undefined): CharacterDef {
  const cls = classById(kit);
  const k = kitById(kit);
  const found = lookIn(kit, look);
  return worn(cls, found ?? { type: k?.types[0] ?? cls.types[0], skin: null });
}

/** The class picked last on the select screen. */
export const lastHero = (): string | null => {
  classPicks();
  const id = heroSaved();
  return id === null ? null : classById(id).id;
};

export const rememberHero = (id: string): void => save(HERO_KEY, id);
