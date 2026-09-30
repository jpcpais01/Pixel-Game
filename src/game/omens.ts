// Omens: now and then, in the monster arenas and dungeons, something happens.
// Each one opens with a banner and a change in the light, so the player knows
// it is coming, and lasts a while:
//   - Blood Moon: the light turns red, monsters hit harder and move quicker,
//     and every piece of gear that drops rolls one rarity higher.
//   - Treasure Imp: a goblin with a sack of dust and gems pops out of a portal
//     and runs. Catch him before he dives back into it.
//   - Meteor Shower: glowing rings mark where rocks will fall; they strike
//     monsters as well as heroes, and leave star ore to break for dust.
//   - Golden Hour: every kill gives twice the energy for the Special.
//   - Whispering Fog: the light all but goes, ghosts drift in out of the
//     mist, and only the hero's own light shows the way.
//   - Rift Tear: a portal opens and a Riftborn elite from another arena
//     steps through.
//   - Wandering Merchant: a hooded trader sells one piece of gear for dust.
//   - Shrine of Unity: a shrine rises; every player standing in its ring
//     together (or one alone, in solo) fills it, and all are blessed.
// The world runs them (world/Omens.ts); this file holds what they are, what
// they do to the fight (`omenMods`, read by the world like `riftMods`), and
// what their overlay shows (`omenHud`, read by scenes/OmenScene.ts).

import type { GearDef } from './gear';
import type { BuffDef } from './buffs';

export type OmenId = 'blood' | 'imp' | 'meteor' | 'golden' | 'fog' | 'rift' | 'merchant' | 'shrine';

type V3 = [number, number, number];

export interface OmenDef {
  id: OmenId;
  name: string;
  /** What it means, in a few words under its name. */
  line: string;
  /** Its colour on the banner and in the HUD. */
  tint: number;
  /** How long it lasts at most, in ms (some end sooner: an imp caught, a champion slain). */
  time: number;
  /** How often it comes, against the others. */
  weight: number;
  /** A threat, a boon or a wonder: the sound it opens with. */
  mood: 'dark' | 'bright' | 'strange';
  /**
   * The light while it lasts, eased in and out: the sun, sky and bounce light
   * are multiplied by these, `add` is added to the sky, and a sun direction
   * swings the sun round to it. `vignette` darkens the edges further.
   */
  grade: { sun: V3; sky: V3; bounce: V3; add?: V3; sunDir?: V3; vignette: number };
  /** Motes drifting over the view while it lasts. */
  motes?: { tints: number[]; every: number; rise: [number, number] };
}

export const OMENS: Record<OmenId, OmenDef> = {
  blood: {
    id: 'blood',
    name: 'Blood Moon',
    line: 'Monsters rage, but every drop is one rarity higher',
    tint: 0xff5a4a,
    time: 60000,
    weight: 1,
    mood: 'dark',
    grade: { sun: [1.55, 0.32, 0.3], sky: [1.3, 0.36, 0.36], bounce: [1.5, 0.3, 0.32], add: [0.1, 0, 0.01], vignette: 0.14 },
    motes: { tints: [0xff3a2a, 0xff7a4a, 0xa01818, 0xffb0a0], every: 55, rise: [-16, -5] },
  },
  imp: {
    id: 'imp',
    name: 'Treasure Imp',
    line: 'Catch him before he escapes with his loot',
    tint: 0xf4d04a,
    time: 30000,
    weight: 1.2,
    mood: 'strange',
    grade: { sun: [1.08, 1.06, 0.88], sky: [1.04, 1.08, 0.92], bounce: [1.1, 1.08, 0.9], vignette: 0.02 },
  },
  meteor: {
    id: 'meteor',
    name: 'Meteor Shower',
    line: 'Stars fall on friend and foe alike',
    tint: 0xffa040,
    time: 36000,
    weight: 1.1,
    mood: 'dark',
    grade: { sun: [0.8, 0.66, 0.62], sky: [0.74, 0.7, 0.9], bounce: [1.1, 0.8, 0.7], add: [0.03, 0.01, 0], vignette: 0.08 },
    motes: { tints: [0xffe0a0, 0xffa040, 0xff6a2a], every: 110, rise: [-6, 2] },
  },
  golden: {
    id: 'golden',
    name: 'Golden Hour',
    line: 'Double energy from every kill',
    tint: 0xffd060,
    time: 30000,
    weight: 1,
    mood: 'bright',
    grade: { sun: [1.4, 1.08, 0.5], sky: [1.12, 0.96, 0.66], bounce: [1.35, 1.02, 0.58], add: [0.1, 0.07, 0], sunDir: [-0.86, 0.22, 0.46], vignette: -0.04 },
    motes: { tints: [0xfff4c0, 0xffd060, 0xffb030, 0xffffff], every: 60, rise: [-10, -2] },
  },
  fog: {
    id: 'fog',
    name: 'Whispering Fog',
    line: 'Something drifts in the mist',
    tint: 0x9ad8e8,
    time: 45000,
    weight: 0.9,
    mood: 'strange',
    grade: { sun: [0.14, 0.15, 0.2], sky: [0.26, 0.3, 0.36], bounce: [0.3, 0.32, 0.4], add: [0.02, 0.03, 0.05], vignette: 0.24 },
  },
  rift: {
    id: 'rift',
    name: 'Rift Tear',
    line: 'Something from another land comes through',
    tint: 0xd070ff,
    time: 75000,
    weight: 1,
    mood: 'dark',
    grade: { sun: [1, 0.55, 1.3], sky: [1.04, 0.66, 1.35], bounce: [1.2, 0.5, 1.4], add: [0.03, 0, 0.05], vignette: 0.1 },
  },
  merchant: {
    id: 'merchant',
    name: 'Wandering Merchant',
    line: 'One piece of gear, for dust',
    tint: 0x7ae0b8,
    time: 60000,
    weight: 0.8,
    mood: 'strange',
    grade: { sun: [0.9, 0.8, 0.66], sky: [0.9, 0.86, 0.94], bounce: [1.1, 0.96, 0.8], vignette: 0.04 },
  },
  shrine: {
    id: 'shrine',
    name: 'Shrine of Unity',
    line: 'Stand in its ring together to be blessed',
    tint: 0xffe68a,
    time: 40000,
    weight: 0.9,
    mood: 'bright',
    grade: { sun: [1.05, 1.04, 0.98], sky: [1.06, 1.1, 1.14], bounce: [1.1, 1.08, 1.04], add: [0.03, 0.04, 0.05], vignette: 0 },
    motes: { tints: [0xfffbe0, 0xffe68a, 0x8af6ff], every: 140, rise: [-12, -4] },
  },
};

/** The Shrine of Unity's blessing. */
export const UNITY: BuffDef = { id: 'unity', name: 'Unity', icon: 'buff_unity', tint: 0xffe68a, duration: 45000, mods: { damage: 1.3, speed: 1.15, regen: 1 } };

/** What the omen now running does to the fight; the world reads these. 1 (or 0) when there is none. */
export interface OmenMods {
  /** Monsters' blows, as times their own. */
  fury: number;
  /** Monsters' pace, as times their own. */
  pace: number;
  /** Special energy from kills, as times its own. */
  energy: number;
  /** Rarity steps added to every gear drop. */
  bump: number;
  /** The light has all but gone: no pollen or fireflies. */
  dark: boolean;
}

export const NEUTRAL_OMEN: OmenMods = { fury: 1, pace: 1, energy: 1, bump: 0, dark: false };

export const omenMods: OmenMods = { ...NEUTRAL_OMEN };

/** A banner across the screen: an omen's name as it comes, or a line as it goes. */
export interface OmenCall {
  title: string;
  sub: string;
  tint: number;
  /** The omen's icon over it, for the big banner as it comes. */
  icon: OmenId | null;
}

/** The Wandering Merchant's offer, while the hero stands at his rug. */
export interface TradeOffer {
  def: GearDef;
  price: number;
  bought: boolean;
}

/** What the omen overlay shows, and the purchase it hands back. */
export const omenHud = {
  /** An arena with omens is being played. */
  active: false,
  /** The omen under way, for the chip at the top. */
  current: null as OmenDef | null,
  /** The chip's bar, 0..1, and the line under the omen's name. */
  bar: 0,
  label: '',
  /** Banners to show, oldest first; the overlay takes them. */
  calls: [] as OmenCall[],
  trade: null as TradeOffer | null,
  /** Set by the overlay when Buy is pressed; the merchant takes it. */
  buy: false,
};

/** No omens: nothing changed, nothing shown. */
export function resetOmens(): void {
  Object.assign(omenMods, NEUTRAL_OMEN);
  Object.assign(omenHud, { active: false, current: null, bar: 0, label: '', calls: [], trade: null, buy: false });
}
