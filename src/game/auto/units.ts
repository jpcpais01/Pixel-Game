// The Auto Battle roster: every hero type as a piece to buy, place and
// fight with. Each keeps its own stats (stats.ts) and plays its own kit in
// small: its basic attack, its normal ability on a cooldown, and its Special
// when its mana fills. A piece has a cost (1 to 5 gold, which also sets how
// rare it is in the shop), an origin (a family of classes) and a role (from
// its stats), and both count toward traits: bonuses for fielding two or four
// different heroes that share one.

import { heroStats, type Role } from '../stats';

export type Origin = 'arcane' | 'order' | 'shadow' | 'wild' | 'forged' | 'show' | 'blade';
export type TraitId = Origin | Role;

/** How a spell picks where it goes. */
export type Aim = 'target' | 'self' | 'crowd' | 'weak' | 'far' | 'ally';

/**
 * What a spell does, in the sim's own words:
 *  - bolt: one blow to the aimed foe, sent as a missile
 *  - beam: every foe along a line from the caster, `r` cells long
 *  - nova: every foe within `r` of the caster
 *  - blast: every foe within `r` of the aimed spot, `delay` s after the cast
 *  - leap: jump beside the aimed foe, then a nova of `r` where it lands
 *  - dash: cut through to the aimed foe, striking all on the way
 *  - chain: the aimed foe, then `n` more jumps to the next nearest
 *  - rain: `n` strikes shared out over foes within `r` of the aim (all foes if no `r`)
 *  - mend: heals and buffs allies within `r` of the caster (the caster alone if 0)
 */
export type SpellKind = 'bolt' | 'beam' | 'nova' | 'blast' | 'leap' | 'dash' | 'chain' | 'rain' | 'mend';

/** How the fight draws a spell (see scenes/auto/fx.ts). */
export type SpellFx =
  | 'arcane' | 'fire' | 'water' | 'holy' | 'light' | 'saber' | 'lightning' | 'fists' | 'quake' | 'poison' | 'acid'
  | 'arrows' | 'knives' | 'shadow' | 'souls' | 'blood' | 'notes' | 'drums' | 'clock' | 'shards' | 'wind'
  | 'thorns' | 'beasts' | 'spear' | 'missiles' | 'drones' | 'haunt' | 'fear' | 'bullets' | 'feathers' | 'roar' | 'flame' | 'steel';

export interface Spell {
  kind: SpellKind;
  aim: Aim;
  /** Damage to each foe struck, in seconds of the caster's attack damage (a rain's is its whole total). */
  dmg: number;
  /** Cells: a radius, or a line's length. */
  r?: number;
  /** Jumps (chain) or strikes (rain). */
  n?: number;
  /** Seconds before a blast lands, or a rain's span. */
  delay?: number;
  stun?: number;
  /** Seconds foes attack 40% slower. */
  slow?: number;
  /** Seconds foes take 30% more damage (turned to lead). */
  brittle?: number;
  /** Extra damage over 3 s, in seconds of the caster's attack damage. */
  burn?: number;
  /** Cells foes are thrown back. */
  knock?: number;
  /** Share of the damage dealt the caster heals. */
  drain?: number;
  /** Barrier, as a share of the caster's max HP (to allies too when `mend` has a radius). */
  shield?: number;
  /** Heal, as a share of each ally's max HP (mend). */
  heal?: number;
  /** Faster attacks for a while (a share, e.g. 0.3), to the caster or those mended. */
  haste?: number;
  /** Seconds the caster can't be struck. */
  dodge?: number;
  /** How long a haste lasts. */
  dur?: number;
  fx: SpellFx;
  /** The hero's own move played for it. */
  anim: string;
}

/** A basic attack's missile, or none for a blow in reach. */
export type Missile =
  | 'orb' | 'fire' | 'water' | 'flask' | 'chem' | 'arrow' | 'soul' | 'lance' | 'note' | 'hand' | 'shard'
  | 'thorn' | 'bullet' | 'drone' | 'junk' | 'spark' | 'feather' | 'firebolt';

export interface UnitDef {
  /** `class.type`, as in HERO_STATS. */
  key: string;
  cls: string;
  type: string;
  cost: 1 | 2 | 3 | 4 | 5;
  origin: Origin;
  role: Role;
  /** Reach in cells (1: next to it). */
  range: number;
  /** The moves its basic attacks play in turn. */
  attack: string[];
  /** Its missile, if it strikes from afar. */
  missile?: Missile;
  /** The normal ability, used every `cd` seconds when a foe is near. */
  skill: Spell & { name: string; cd: number };
  /** The Special, cast when mana is full. */
  ult: Spell;
  mana: number;
}

type Def = Omit<UnitDef, 'key' | 'cls' | 'type' | 'role'>;

// prettier-ignore
const DEFS: Record<string, Def> = {
  // Arcane
  'wizard.arcane': { cost: 2, origin: 'arcane', range: 3, attack: ['cast'], missile: 'orb', mana: 80,
    skill: { name: 'Charged beam', cd: 6, kind: 'beam', aim: 'target', r: 5, dmg: 2.2, fx: 'arcane', anim: 'beam' },
    ult: { kind: 'blast', aim: 'crowd', r: 1.6, dmg: 4, stun: 1, delay: 0.5, fx: 'arcane', anim: 'charge' } },
  'wizard.pyro': { cost: 1, origin: 'arcane', range: 3, attack: ['cast'], missile: 'fire', mana: 70,
    skill: { name: 'Meteor', cd: 6, kind: 'blast', aim: 'crowd', r: 1.1, dmg: 1.8, burn: 0.8, delay: 0.6, fx: 'fire', anim: 'charge' },
    ult: { kind: 'beam', aim: 'target', r: 5, dmg: 4, burn: 1, fx: 'fire', anim: 'beam' } },
  'wizard.tide': { cost: 3, origin: 'arcane', range: 3, attack: ['cast'], missile: 'water', mana: 80,
    skill: { name: 'Tidal wave', cd: 6, kind: 'beam', aim: 'target', r: 4, dmg: 1.8, knock: 1, fx: 'water', anim: 'beam' },
    ult: { kind: 'blast', aim: 'crowd', r: 1.6, dmg: 4, stun: 1.5, delay: 0.4, fx: 'water', anim: 'charge' } },
  'chronomancer.keeper': { cost: 3, origin: 'arcane', range: 3, attack: ['cast'], missile: 'hand', mana: 90,
    skill: { name: 'Stopped clock', cd: 7, kind: 'blast', aim: 'crowd', r: 1.1, dmg: 1.2, stun: 1.5, delay: 0.3, fx: 'clock', anim: 'field' },
    ult: { kind: 'nova', aim: 'self', r: 3, dmg: 3, stun: 2, fx: 'clock', anim: 'field' } },
  'chronomancer.paradox': { cost: 5, origin: 'arcane', range: 3, attack: ['cast'], missile: 'shard', mana: 80,
    skill: { name: 'Rewind', cd: 8, kind: 'mend', aim: 'self', r: 0, dmg: 0, heal: 0.3, fx: 'clock', anim: 'rewind' },
    ult: { kind: 'rain', aim: 'crowd', n: 12, dmg: 8, delay: 1.4, fx: 'shards', anim: 'cast' } },
  'inventor.scientist': { cost: 4, origin: 'arcane', range: 3, attack: ['zap'], missile: 'spark', mana: 80,
    skill: { name: 'Polarity orb', cd: 6, kind: 'blast', aim: 'crowd', r: 1.4, dmg: 2, stun: 0.6, delay: 0.6, fx: 'lightning', anim: 'toss' },
    ult: { kind: 'chain', aim: 'target', n: 6, dmg: 4.2, stun: 0.4, fx: 'lightning', anim: 'eureka' } },

  // Order
  'archer.arbalest': { cost: 3, origin: 'order', range: 4, attack: ['fire'], missile: 'arrow', mana: 80,
    skill: { name: 'Net bolt', cd: 7, kind: 'blast', aim: 'crowd', r: 1.2, dmg: 0.6, slow: 2.5, stun: 0.5, delay: 0.3, fx: 'arrows', anim: 'brace' },
    ult: { kind: 'blast', aim: 'crowd', r: 1.8, dmg: 4.5, delay: 0.9, fx: 'fire', anim: 'brace' } },
  'warrior.knight': { cost: 1, origin: 'order', range: 1, attack: ['slash1', 'slash2', 'thrust'], mana: 90,
    skill: { name: 'Fire whirlwind', cd: 6, kind: 'nova', aim: 'self', r: 1.5, dmg: 1.6, fx: 'fire', anim: 'slash2' },
    ult: { kind: 'blast', aim: 'target', r: 1.2, dmg: 4, stun: 0.6, delay: 0.5, fx: 'light', anim: 'rise' } },
  'warrior.king': { cost: 5, origin: 'order', range: 1, attack: ['slash1', 'slash2', 'smite'], mana: 100,
    skill: { name: 'Royal decree', cd: 7, kind: 'nova', aim: 'self', r: 1.5, dmg: 1.2, stun: 1, shield: 0.2, fx: 'light', anim: 'decree' },
    ult: { kind: 'blast', aim: 'crowd', r: 2.1, dmg: 4, stun: 1.5, delay: 0.5, fx: 'holy', anim: 'decree' } },
  'paladin.holy': { cost: 2, origin: 'order', range: 1, attack: ['smite'], mana: 100,
    skill: { name: 'Consecrate', cd: 6, kind: 'nova', aim: 'self', r: 1.5, dmg: 1.2, drain: 0.4, fx: 'holy', anim: 'consecrate' },
    ult: { kind: 'mend', aim: 'self', r: 2.2, dmg: 0, heal: 0.2, shield: 0.15, fx: 'holy', anim: 'consecrate' } },
  'paladin.crusader': { cost: 4, origin: 'order', range: 1, attack: ['smite'], mana: 80,
    skill: { name: 'Sunfire', cd: 7, kind: 'nova', aim: 'self', r: 1.5, dmg: 1, knock: 1, shield: 0.15, fx: 'fire', anim: 'consecrate' },
    ult: { kind: 'rain', aim: 'self', n: 8, dmg: 7, delay: 1.2, fx: 'fire', anim: 'consecrate' } },
  'jedi.knight': { cost: 2, origin: 'order', range: 1, attack: ['slash1', 'slash2'], mana: 70,
    skill: { name: 'Force push', cd: 6, kind: 'nova', aim: 'self', r: 1.5, dmg: 1.2, knock: 1, fx: 'wind', anim: 'push' },
    ult: { kind: 'beam', aim: 'target', r: 4, dmg: 4, fx: 'saber', anim: 'slash1' } },
  'valkyrie.spear': { cost: 3, origin: 'order', range: 2, attack: ['slash1', 'slash2', 'thrust'], mana: 70,
    skill: { name: 'Spear of light', cd: 6, kind: 'beam', aim: 'target', r: 4, dmg: 1.8, fx: 'spear', anim: 'thrust' },
    ult: { kind: 'blast', aim: 'crowd', r: 1.6, dmg: 4.5, delay: 0.7, fx: 'spear', anim: 'rise' } },
  'valkyrie.storm': { cost: 4, origin: 'order', range: 1, attack: ['slash1', 'slash2', 'thrust'], mana: 80,
    skill: { name: 'Thunder dive', cd: 7, kind: 'leap', aim: 'crowd', r: 1.2, dmg: 2, stun: 0.5, fx: 'lightning', anim: 'rise' },
    ult: { kind: 'rain', aim: 'self', r: 2.5, n: 8, dmg: 7, delay: 1.2, fx: 'lightning', anim: 'rise' } },

  // Shadow
  'jedi.sith': { cost: 4, origin: 'shadow', range: 1, attack: ['sweep1', 'sweep2'], mana: 80,
    skill: { name: 'Force lightning', cd: 6, kind: 'chain', aim: 'target', n: 3, dmg: 1.5, slow: 2, fx: 'lightning', anim: 'lightning' },
    ult: { kind: 'blast', aim: 'crowd', r: 1.6, dmg: 4, stun: 1.5, drain: 0.5, delay: 0.6, fx: 'shadow', anim: 'grip' } },
  'rogue.rogue': { cost: 1, origin: 'shadow', range: 1, attack: ['stab1', 'stab2', 'cross'], mana: 60,
    skill: { name: 'Shadow dash', cd: 6, kind: 'dash', aim: 'weak', dmg: 1.6, dodge: 0.8, fx: 'shadow', anim: 'dash' },
    ult: { kind: 'nova', aim: 'self', r: 2, dmg: 3.2, burn: 1, fx: 'knives', anim: 'cross' } },
  'rogue.dancer': { cost: 3, origin: 'shadow', range: 1, attack: ['stab1', 'stab2'], mana: 70,
    skill: { name: 'Blink strike', cd: 6, kind: 'chain', aim: 'target', n: 3, dmg: 1.6, dodge: 1, fx: 'shadow', anim: 'dash' },
    ult: { kind: 'nova', aim: 'self', r: 1.6, dmg: 4.5, dodge: 1.5, fx: 'shadow', anim: 'cross' } },
  'necromancer.necro': { cost: 1, origin: 'shadow', range: 3, attack: ['cast'], missile: 'soul', mana: 70,
    skill: { name: 'Raise dead', cd: 6, kind: 'rain', aim: 'target', r: 1.2, n: 3, dmg: 2, delay: 0.9, fx: 'souls', anim: 'raise' },
    ult: { kind: 'nova', aim: 'self', r: 2.2, dmg: 3, drain: 0.5, fx: 'souls', anim: 'raise' } },
  'necromancer.blood': { cost: 3, origin: 'shadow', range: 3, attack: ['cast'], missile: 'lance', mana: 80,
    skill: { name: 'Blood nova', cd: 6, kind: 'nova', aim: 'self', r: 1.6, dmg: 1.5, drain: 0.8, fx: 'blood', anim: 'raise' },
    ult: { kind: 'rain', aim: 'crowd', n: 8, dmg: 7, drain: 0.4, delay: 1.2, fx: 'blood', anim: 'raise' } },
  'phantom.poltergeist': { cost: 2, origin: 'shadow', range: 3, attack: ['throw'], missile: 'junk', mana: 70,
    skill: { name: 'Uprising', cd: 6, kind: 'blast', aim: 'crowd', r: 1.1, dmg: 1.8, stun: 0.8, delay: 0.3, fx: 'haunt', anim: 'rattle' },
    ult: { kind: 'blast', aim: 'crowd', r: 1.6, dmg: 4.5, delay: 0.8, fx: 'haunt', anim: 'cast' } },
  'phantom.wraith': { cost: 4, origin: 'shadow', range: 1, attack: ['swing'], mana: 80,
    skill: { name: 'Possess', cd: 7, kind: 'dash', aim: 'target', dmg: 2, stun: 1, fx: 'fear', anim: 'possess' },
    ult: { kind: 'nova', aim: 'self', r: 2.5, dmg: 3.2, stun: 1, burn: 1, fx: 'fear', anim: 'cast' } },

  // Wild
  'archer.ranger': { cost: 1, origin: 'wild', range: 4, attack: ['shoot'], missile: 'arrow', mana: 70,
    skill: { name: 'Volley', cd: 6, kind: 'rain', aim: 'crowd', r: 1.5, n: 6, dmg: 2.4, delay: 0.9, fx: 'arrows', anim: 'volley' },
    ult: { kind: 'beam', aim: 'target', r: 7, dmg: 4, fx: 'arrows', anim: 'shoot' } },
  'archer.wind': { cost: 2, origin: 'wild', range: 3, attack: ['fan'], missile: 'arrow', mana: 70,
    skill: { name: 'Wind vault', cd: 6, kind: 'beam', aim: 'target', r: 4, dmg: 1.8, knock: 1, dodge: 0.4, fx: 'wind', anim: 'vault' },
    ult: { kind: 'beam', aim: 'target', r: 5, dmg: 4.2, stun: 0.5, fx: 'wind', anim: 'fan' } },
  'beast.eagle': { cost: 2, origin: 'wild', range: 3, attack: ['fling', 'fling2'], missile: 'feather', mana: 70,
    skill: { name: 'Gust', cd: 6, kind: 'nova', aim: 'self', r: 1.5, dmg: 1, knock: 1, fx: 'wind', anim: 'gust' },
    ult: { kind: 'beam', aim: 'target', r: 7, dmg: 4, fx: 'feathers', anim: 'rally' } },
  'beast.lion': { cost: 3, origin: 'wild', range: 1, attack: ['claw', 'claw2', 'maul'], mana: 70,
    skill: { name: 'Cowing strike', cd: 6, kind: 'nova', aim: 'self', r: 1.5, dmg: 1.5, slow: 2, fx: 'roar', anim: 'maul' },
    ult: { kind: 'nova', aim: 'self', r: 2.5, dmg: 3.5, knock: 1, stun: 0.5, fx: 'roar', anim: 'roar' } },
  'beast.dragon': { cost: 5, origin: 'wild', range: 3, attack: ['spit'], missile: 'firebolt', mana: 80,
    skill: { name: 'Flame breath', cd: 6, kind: 'beam', aim: 'target', r: 3, dmg: 2.2, burn: 1, fx: 'flame', anim: 'breath' },
    ult: { kind: 'blast', aim: 'crowd', r: 2, dmg: 5, burn: 1, delay: 0.8, fx: 'flame', anim: 'rally' } },

  // Forged
  'alchemist.plague': { cost: 1, origin: 'forged', range: 3, attack: ['throw'], missile: 'flask', mana: 70,
    skill: { name: 'Great flask', cd: 6, kind: 'blast', aim: 'crowd', r: 1.1, dmg: 0.6, burn: 1.6, delay: 0.5, fx: 'poison', anim: 'throw' },
    ult: { kind: 'blast', aim: 'crowd', r: 1.6, dmg: 1.4, burn: 3, delay: 0.6, fx: 'poison', anim: 'brew' } },
  'alchemist.chem': { cost: 2, origin: 'forged', range: 3, attack: ['throw'], missile: 'chem', mana: 70,
    skill: { name: 'Chem fan', cd: 6, kind: 'rain', aim: 'crowd', r: 1.4, n: 3, dmg: 2.2, delay: 0.5, fx: 'acid', anim: 'throw' },
    ult: { kind: 'blast', aim: 'crowd', r: 1.6, dmg: 4.5, delay: 0.7, fx: 'acid', anim: 'brew' } },
  'automaton.mech': { cost: 4, origin: 'forged', range: 2, attack: ['fireA', 'fireB'], missile: 'bullet', mana: 90,
    skill: { name: 'Missiles', cd: 6, kind: 'rain', aim: 'crowd', n: 3, dmg: 2.2, delay: 0.8, fx: 'missiles', anim: 'launch' },
    ult: { kind: 'mend', aim: 'self', r: 0, dmg: 0, shield: 0.2, haste: 0.6, dur: 5, fx: 'steel', anim: 'deploy' } },
  'automaton.synth': { cost: 5, origin: 'forged', range: 3, attack: ['command'], missile: 'drone', mana: 80,
    skill: { name: 'Laser grid', cd: 6, kind: 'blast', aim: 'crowd', r: 1.2, dmg: 2, slow: 2, delay: 0.3, fx: 'drones', anim: 'grid' },
    ult: { kind: 'rain', aim: 'crowd', n: 16, dmg: 8, delay: 1.6, fx: 'drones', anim: 'open' } },
  'inventor.engineer': { cost: 2, origin: 'forged', range: 1, attack: ['swing', 'swing2', 'bonk'], mana: 80,
    skill: { name: 'Sentry', cd: 7, kind: 'rain', aim: 'target', n: 5, dmg: 2.2, delay: 1.5, fx: 'bullets', anim: 'build' },
    ult: { kind: 'rain', aim: 'crowd', n: 14, dmg: 7, delay: 1.8, fx: 'missiles', anim: 'build' } },

  // Mystics: the Bard's and the Druid's
  'bard.minstrel': { cost: 1, origin: 'show', range: 3, attack: ['strum'], missile: 'note', mana: 80,
    skill: { name: 'Quick song', cd: 7, kind: 'mend', aim: 'self', r: 2, dmg: 0, heal: 0.1, haste: 0.25, dur: 3, fx: 'notes', anim: 'song' },
    ult: { kind: 'mend', aim: 'self', r: 9, dmg: 0, heal: 0.18, haste: 0.3, dur: 4, fx: 'notes', anim: 'song' } },
  'bard.drummer': { cost: 3, origin: 'show', range: 1, attack: ['beat', 'beat2', 'boom'], mana: 90,
    skill: { name: 'Great beat', cd: 7, kind: 'nova', aim: 'self', r: 1.5, dmg: 1.2, knock: 1, haste: 0.3, dur: 4, fx: 'drums', anim: 'boom' },
    ult: { kind: 'nova', aim: 'self', r: 2.2, dmg: 3.6, stun: 1, knock: 1, fx: 'drums', anim: 'roll' } },
  'druid.grove': { cost: 2, origin: 'show', range: 3, attack: ['cast'], missile: 'thorn', mana: 80,
    skill: { name: 'Grove', cd: 7, kind: 'blast', aim: 'crowd', r: 1.1, dmg: 1, stun: 1.2, delay: 0.4, fx: 'thorns', anim: 'charge' },
    ult: { kind: 'blast', aim: 'crowd', r: 2, dmg: 3.5, stun: 1.5, delay: 0.6, fx: 'thorns', anim: 'beam' } },
  'druid.wild': { cost: 4, origin: 'show', range: 1, attack: ['cast'], mana: 70,
    skill: { name: 'Wolf leap', cd: 6, kind: 'leap', aim: 'crowd', r: 1.1, dmg: 2.2, fx: 'beasts', anim: 'charge' },
    ult: { kind: 'beam', aim: 'target', r: 6, dmg: 4.5, knock: 1, fx: 'beasts', anim: 'beam' } },

  // Blademasters
  'fighter.brawler': { cost: 1, origin: 'blade', range: 1, attack: ['jab', 'cross', 'hook', 'upper'], mana: 70,
    skill: { name: 'Chi barrage', cd: 6, kind: 'beam', aim: 'target', r: 3, dmg: 2, fx: 'fists', anim: 'barrage' },
    ult: { kind: 'dash', aim: 'far', dmg: 4, fx: 'fire', anim: 'smash' } },
  'fighter.monk': { cost: 3, origin: 'blade', range: 1, attack: ['palm', 'palm2', 'thrust'], mana: 100,
    skill: { name: 'Leap', cd: 7, kind: 'leap', aim: 'crowd', r: 1.2, dmg: 1.5, knock: 1, fx: 'quake', anim: 'leap' },
    ult: { kind: 'nova', aim: 'self', r: 2, dmg: 3.5, stun: 0.75, shield: 0.2, fx: 'quake', anim: 'thrust' } },
  'samurai.bladewind': { cost: 3, origin: 'blade', range: 1, attack: ['stab', 'slash1', 'slash2'], mana: 70,
    skill: { name: 'Wind dash', cd: 6, kind: 'dash', aim: 'target', dmg: 1.8, stun: 0.75, fx: 'wind', anim: 'dash' },
    ult: { kind: 'blast', aim: 'crowd', r: 1.6, dmg: 4, stun: 1.5, delay: 0.5, fx: 'wind', anim: 'slash2' } },
  'samurai.ronin': { cost: 1, origin: 'blade', range: 1, attack: ['slash1', 'slash2'], mana: 70,
    skill: { name: 'Iaido', cd: 6, kind: 'dash', aim: 'weak', dmg: 2, fx: 'steel', anim: 'dash' },
    ult: { kind: 'nova', aim: 'self', r: 2, dmg: 4, dodge: 0.8, fx: 'steel', anim: 'slash1' } },
  'transmuter.transmuter': { cost: 3, origin: 'forged', range: 3, attack: ['flick'], missile: 'flask', mana: 80,
    skill: { name: 'Transmutation circle', cd: 7, kind: 'blast', aim: 'crowd', r: 1.2, dmg: 0.6, stun: 1.5, brittle: 2.5, delay: 0.5, fx: 'steel', anim: 'inscribe' },
    ult: { kind: 'blast', aim: 'crowd', r: 1.8, dmg: 4.2, stun: 1, delay: 0.9, fx: 'steel', anim: 'opus' } },
};

export const UNITS: Record<string, UnitDef> = {};
for (const [key, d] of Object.entries(DEFS)) {
  const [cls, type] = key.split('.');
  UNITS[key] = { ...d, key, cls, type, role: heroStats(cls, type).role };
}

/** Every piece's key, cheapest first. */
export const UNIT_KEYS = Object.keys(UNITS).sort((a, b) => UNITS[a].cost - UNITS[b].cost || a.localeCompare(b));

export const unitDef = (key: string): UnitDef => UNITS[key] ?? UNITS['warrior.knight'];

export interface TraitDef {
  id: TraitId;
  name: string;
  /** Different heroes needed for each level. */
  levels: number[];
  /** What it gives at each level, a line each. */
  text: string[];
  /** Its badge colour. */
  color: number;
}

export const TRAITS: Record<TraitId, TraitDef> = {
  arcane: { id: 'arcane', name: 'Arcane', levels: [2, 4], text: ['Specials hit 25% harder', 'Specials hit 60% harder'], color: 0x6fe4ff },
  order: { id: 'order', name: 'Order', levels: [2, 4], text: ['Order start with a 20% barrier', 'Order start with a 45% barrier'], color: 0xffe08a },
  shadow: { id: 'shadow', name: 'Shadow', levels: [2, 4], text: ['Shadow crit 25% of blows', 'Shadow crit 45% of blows'], color: 0xb890ff },
  wild: { id: 'wild', name: 'Wild', levels: [2, 4], text: ['Wild attack 20% faster', 'Wild attack 45% faster'], color: 0x8ad65a },
  forged: { id: 'forged', name: 'Forged', levels: [2, 4], text: ['Forged gain 30 Defense', 'Forged gain 70 Defense'], color: 0xf0a63a },
  show: { id: 'show', name: 'Mystic', levels: [2, 4], text: ['Team heals 1.5% HP a second', 'Team heals 3% HP a second'], color: 0x3fd8c8 },
  blade: { id: 'blade', name: 'Blademaster', levels: [2, 4], text: ['25% chance to strike twice', '50% chance to strike twice'], color: 0xe8e8f4 },
  tank: { id: 'tank', name: 'Guardian', levels: [2, 4], text: ['Guardians gain 25% max HP', 'Guardians gain 60% max HP'], color: 0x9aa8c8 },
  melee: { id: 'melee', name: 'Fighter', levels: [2, 4], text: ['Fighters heal 15% of damage', 'Fighters heal 30% of damage'], color: 0xff7a5a },
  ranged: { id: 'ranged', name: 'Marksman', levels: [2, 4], text: ['Marksmen deal 20% more', 'Marksmen deal 50% more'], color: 0xc8f59a },
  caster: { id: 'caster', name: 'Sage', levels: [2, 4], text: ['Team starts with 20 mana', 'Team starts with 45 mana'], color: 0xd4a8ff },
};

export const TRAIT_IDS = Object.keys(TRAITS) as TraitId[];

/**
 * Each trait's count of different heroes in `keys`, and the level it reaches (0: none yet). `bonus` adds to a
 * trait's count (a crest boon), but only once at least one of its heroes is there.
 */
export function traitCounts(keys: Iterable<string>, bonus?: ReadonlyMap<TraitId, number>): { id: TraitId; count: number; level: number }[] {
  const seen = new Set(keys);
  const counts = new Map<TraitId, number>();
  for (const k of seen) {
    const u = UNITS[k];
    if (!u) continue;
    for (const t of [u.origin, u.role] as TraitId[]) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  if (bonus) for (const [t, n] of bonus) if (counts.has(t)) counts.set(t, counts.get(t)! + n);
  return [...counts.entries()]
    .map(([id, count]) => ({ id, count, level: TRAITS[id].levels.filter((n) => count >= n).length }))
    .sort((a, b) => b.level - a.level || b.count - a.count || a.id.localeCompare(b.id));
}

/** Cost tier colours: stone, jade, sapphire, amethyst, gold. */
export const COST_COLORS = [0, 0xa8b0c0, 0x5ad07a, 0x4aa6ff, 0xc47cff, 0xffc94a];
