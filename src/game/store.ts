// The shop's storefront: skins, companions and bundles bought outright with
// gems, beside the two wishing pages. Each day brings its own offers (three
// skins, two companions and two bundles), picked from what the player doesn't
// own yet when the day's first look is taken, and kept on this device until
// the next day so buying one doesn't shuffle the rest.

import { CLASSES } from './characters';
import { collection } from './collection';
import { WISH_SKINS, type SkinEntry, type SkinRarity } from './gacha';
import { PETS, type PetDef } from './pets';

/** What a skin or companion costs bought outright, by rarity: dearer than a wish's odds, but it's the one you want. */
export const SKIN_PRICE: Record<SkinRarity, number> = { rare: 120, epic: 300, legendary: 800 };
export const PET_PRICE: Record<SkinRarity, number> = { rare: 120, epic: 300, legendary: 800 };
/** A bundle's saving on what its pieces would cost alone. */
export const BUNDLE_OFF = 0.3;

const SAVE_KEY = 'pixel-battle.store';
const RANK: Record<SkinRarity, number> = { rare: 0, epic: 1, legendary: 2 };

interface BaseOffer {
  /** Stable within the day: 'skin:wizard:hellfire', 'pet:wyrm', 'set:wizard'... */
  key: string;
  name: string;
  rarity: SkinRarity;
}
export interface SkinOffer extends BaseOffer {
  kind: 'skin';
  entry: SkinEntry;
}
export interface PetOffer extends BaseOffer {
  kind: 'pet';
  pet: PetDef;
}
export interface BundleOffer extends BaseOffer {
  kind: 'bundle';
  /** A line saying what it is: "Every Wizard skin". */
  blurb: string;
  skins: SkinEntry[];
  pets: PetDef[];
}
export type Offer = SkinOffer | PetOffer | BundleOffer;

/** Today, on this device's calendar. */
function dayKey(d = new Date()): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** Milliseconds until the offers change (local midnight). */
export function msToRefresh(now = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

/** A small seeded generator, so a day's picks are the same however often they're made. */
function seeded(text: string): () => number {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const skinByKey = (id: string) => WISH_SKINS.find((s) => s.id === id);
const petByKey = (id: string) => PETS.find((p) => p.id === id && !p.season);

const skinOffer = (e: SkinEntry): SkinOffer => ({ kind: 'skin', key: `skin:${e.id}`, name: e.skin.name, rarity: e.rarity, entry: e });
const petOffer = (p: PetDef): PetOffer => ({ kind: 'pet', key: `pet:${p.id}`, name: p.name, rarity: p.rarity, pet: p });

function bundleOffer(key: string, name: string, blurb: string, skins: SkinEntry[], pets: PetDef[]): BundleOffer {
  const all = [...skins.map((s) => s.rarity), ...pets.map((p) => p.rarity)];
  const rarity = all.reduce<SkinRarity>((a, r) => (RANK[r] > RANK[a] ? r : a), 'rare');
  return { kind: 'bundle', key, name, blurb, rarity, skins, pets };
}

/** Rebuild an offer from its key (as saved). */
function fromKey(key: string): Offer | null {
  const [kind, ...rest] = key.split(':');
  const id = rest.join(':');
  if (kind === 'skin') {
    const e = skinByKey(id);
    return e ? skinOffer(e) : null;
  }
  if (kind === 'pet') {
    const p = petByKey(id);
    return p ? petOffer(p) : null;
  }
  if (kind === 'set') {
    const cls = CLASSES.find((c) => c.id === id);
    const skins = WISH_SKINS.filter((s) => s.cls.id === id);
    return cls && skins.length > 1 ? bundleOffer(key, `${cls.name} set`, `Every ${cls.name} skin`, skins, []) : null;
  }
  if (kind === 'trio') {
    // 'trio:<skin id>|<skin id>|<pet id>'
    const ids = id.split('|');
    const skins = ids.slice(0, 2).map(skinByKey).filter((s): s is SkinEntry => !!s);
    const pets = ids.slice(2).map(petByKey).filter((p): p is PetDef => !!p);
    return skins.length + pets.length > 1 ? bundleOffer(key, 'Explorer pack', 'Two skins and a companion', skins, pets) : null;
  }
  return null;
}

/** Pick today's offers: unowned ones first, each picked from its rarity's pool by the day's seed. */
function pickOffers(day: string): string[] {
  const rnd = seeded(`store:${day}`);
  const choose = <T>(of: T[]): T | undefined => of[Math.floor(rnd() * of.length)];
  const prefer = <T>(of: T[], owned: (t: T) => boolean): T | undefined => choose(of.filter((t) => !owned(t))) ?? choose(of);
  const skinOwned = (s: SkinEntry) => collection.hasSkin(s.id);
  const petOwned = (p: PetDef) => collection.hasPet(p.id);
  const keys: string[] = [];
  const skins: SkinEntry[] = [];
  for (const r of ['legendary', 'epic', 'rare'] as const) {
    const s = prefer(WISH_SKINS.filter((x) => x.rarity === r && !skins.includes(x)), skinOwned);
    if (s) skins.push(s);
  }
  const pets: PetDef[] = [];
  const wild = PETS.filter((p) => !p.season);
  const fine = prefer(wild.filter((p) => p.rarity !== 'rare'), petOwned);
  if (fine) pets.push(fine);
  const plain = prefer(wild.filter((p) => p.rarity === 'rare' && !pets.includes(p)), petOwned);
  if (plain) pets.push(plain);
  keys.push(...skins.map((s) => `skin:${s.id}`), ...pets.map((p) => `pet:${p.id}`));
  // A class's whole set of skins, a class with something left to win if there is one.
  const sets = CLASSES.filter((c) => WISH_SKINS.filter((s) => s.cls.id === c.id).length > 1);
  const set = prefer(sets, (c) => WISH_SKINS.filter((s) => s.cls.id === c.id).every(skinOwned));
  if (set) keys.push(`set:${set.id}`);
  // And a pack: an epic skin, a rare skin and an epic companion, none of them among today's other offers.
  const epic = prefer(WISH_SKINS.filter((s) => s.rarity === 'epic' && !skins.includes(s) && s.cls.id !== set?.id), skinOwned);
  const rare = prefer(WISH_SKINS.filter((s) => s.rarity === 'rare' && !skins.includes(s) && s.cls.id !== set?.id), skinOwned);
  const buddy = prefer(wild.filter((p) => p.rarity === 'epic' && !pets.includes(p)), petOwned);
  if (epic && rare && buddy) keys.push(`trio:${epic.id}|${rare.id}|${buddy.id}`);
  return keys;
}

/** Today's offers, the same all day on this device. */
export function todaysOffers(): Offer[] {
  const day = dayKey();
  let keys: string[] | null = null;
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null') as { day: string; keys: string[] } | null;
    if (saved?.day === day && Array.isArray(saved.keys)) keys = saved.keys;
  } catch {
    keys = null;
  }
  if (!keys) {
    keys = pickOffers(day);
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ day, keys }));
    } catch {
      // Private browsing: the day's picks are made again next time, much the same.
    }
  }
  return keys.map(fromKey).filter((o): o is Offer => !!o);
}

/** Is all of it owned already? */
export function offerOwned(o: Offer): boolean {
  if (o.kind === 'skin') return collection.hasSkin(o.entry.id);
  if (o.kind === 'pet') return collection.hasPet(o.pet.id);
  return o.skins.every((s) => collection.hasSkin(s.id)) && o.pets.every((p) => collection.hasPet(p.id));
}

/** What it would cost alone, piece by piece (for a bundle, only the pieces not owned). */
export function fullPrice(o: Offer): number {
  if (o.kind === 'skin') return SKIN_PRICE[o.rarity];
  if (o.kind === 'pet') return PET_PRICE[o.rarity];
  return o.skins.filter((s) => !collection.hasSkin(s.id)).reduce((n, s) => n + SKIN_PRICE[s.rarity], 0) + o.pets.filter((p) => !collection.hasPet(p.id)).reduce((n, p) => n + PET_PRICE[p.rarity], 0);
}

/** What it costs now: a bundle takes its saving off what's left of it, to the nearest ten. */
export function priceOf(o: Offer): number {
  const full = fullPrice(o);
  return o.kind === 'bundle' ? Math.round((full * (1 - BUNDLE_OFF)) / 10) * 10 : full;
}

/** What one purchase gave, in the order it's shown. */
export type Bought = { kind: 'skin'; entry: SkinEntry } | { kind: 'pet'; pet: PetDef };

/** Buy it: spend the gems and give what isn't owned yet. Null if it's owned or the gems fall short. */
export function buy(o: Offer): Bought[] | null {
  if (offerOwned(o)) return null;
  if (!collection.spendGems(priceOf(o))) return null;
  const skins = o.kind === 'skin' ? [o.entry] : o.kind === 'bundle' ? o.skins : [];
  const pets = o.kind === 'pet' ? [o.pet] : o.kind === 'bundle' ? o.pets : [];
  const out: Bought[] = [];
  for (const s of skins) if (collection.unlockSkin(s.id)) out.push({ kind: 'skin', entry: s });
  for (const p of pets) {
    if (!collection.unlockPet(p.id)) continue;
    // The first companion comes along at once, as when one is wished for.
    if (!collection.pet) collection.pet = p.id;
    out.push({ kind: 'pet', pet: p });
  }
  return out;
}
