import type { Hurtbox } from './combat';

// Holding a foe helpless: the binds, roots and snares several heroes use
// (the King's chains, the Druid's roots, a Sith's grip...).

/** Something that can be held: the monsters (bosses shrug it off). */
type Bindable = Hurtbox & { bind(ms: number, lift?: number): boolean; readonly held?: boolean };
const bindable = (h: Hurtbox): h is Bindable => typeof (h as Partial<Bindable>).bind === 'function';

/** Hold a foe helpless for `ms`, lifted `lift` px; false if it can't be held. */
export function bindFoe(h: Hurtbox, ms: number, lift = 0): boolean {
  return bindable(h) && h.bind(ms, lift);
}
