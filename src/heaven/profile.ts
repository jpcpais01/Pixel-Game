// Who the player is in Heaven Lands: a name and an appearance, and the
// outfits they've saved in the wardrobe. Kept on this device.

import { decodeLook, encodeLook, randomLook, type Appearance } from './look';

const KEY = 'heaven-lands.me';
/** Outfits a wardrobe keeps. */
export const OUTFIT_SLOTS = 8;

interface Saved {
  name: string;
  look: string;
  outfits: (string | null)[];
  made: boolean;
}

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<Saved>;
      return { name: s.name ?? '', look: s.look ?? encodeLook(randomLook()), outfits: s.outfits ?? [], made: !!s.made };
    }
  } catch {
    // A private window or a broken save: start fresh.
  }
  return { name: '', look: encodeLook(randomLook()), outfits: [], made: false };
}

const me = load();

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(me));
  } catch {
    // Nothing to do: it lasts the session.
  }
}

export const profile = {
  /** Made their wanderer yet (the first launch opens the creator). */
  get made(): boolean {
    return me.made;
  },
  get name(): string {
    return me.name || 'Wanderer';
  },
  get rawName(): string {
    return me.name;
  },
  get look(): Appearance {
    return decodeLook(me.look);
  },
  get code(): string {
    return me.look;
  },
  set(name: string, look: Appearance): void {
    me.name = cleanName(name);
    me.look = encodeLook(look);
    me.made = true;
    save();
  },
  outfit(i: number): Appearance | null {
    const c = me.outfits[i];
    return c ? decodeLook(c) : null;
  },
  keepOutfit(i: number, look: Appearance | null): void {
    while (me.outfits.length < OUTFIT_SLOTS) me.outfits.push(null);
    me.outfits[i] = look ? encodeLook(look) : null;
    save();
  },
};

/** Names as the room server takes them: up to 16 letters, digits, spaces and a little punctuation. */
export function cleanName(s: string): string {
  return s.replace(/[^\w .'-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
}
