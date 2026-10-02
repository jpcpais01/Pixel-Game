import Phaser from 'phaser';
import { bakedCanvas } from '../../art/canvas';
import { sound } from '../../audio';
import { dirOf } from '../Wizard';
import { energy } from '../energy';
import { CHEM_TOX, CRYO_TOX, FOXGLOVE_TOX, HEX_TOX, PLAGUE_TOX, SPIRIT_TOX, type ToxStyle } from '../Toxins';
import type { Aim, CharacterDef, Hero } from '../characters';
import type { WorldScene } from '../../scenes/WorldScene';
import { bloom, easeOut, flare, Fx, Ink, pal, ring, rune, type Pal } from './ink';
import { Inferno, Singularity } from './arcane';
import { DragonRush, MountainWrath, SaberCyclone, Skybreaker } from './martial';
import { HeavensLight, SunWrath } from './holy';
import { BloodMoon, Eclipse, FanOfKnives, SoulStorm } from './shadow';
import { ChemBomb, GreatArrow, Pestilence } from './nature';
import { PowderKeg, Tempest } from './archers';
import { Encore, ThunderOfWar } from './bard';
import { Legion, TimeStop } from './chrono';
import { HundredCuts, quakeGate, SkyQuake } from './samurai';
import { BLADEWIND_KIT, KITSUNE_KIT, ONI_KIT, RONIN_KIT, SAKURA_KIT, SHOGUN_KIT } from '../Samurai';
import { schemePal } from '../Blades';
import { AEON_PAL, ANOMALY_PAL, CLOCKWORK_PAL, KEEPER_PAL, MOON_PAL, RIFT_PAL } from '../Chronos';
import { PrimalStampede, WildWrath } from './druid';
import { Maelstrom } from './tide';
import { ABYSS_MAGIC, TIDE_MAGIC } from '../Tide';
import { AsgardThunder, OdinSpear } from './valkyrie';
import { KingsCrown } from './king';
import { AFONSO_KIT, KING_KIT } from '../King';
import { AUTUMN_MAGIC, FROST_MAGIC, GROVE_PAL, WILD_PAL } from '../Druid';
import { RAVEN_KIT, SPEAR_KIT, STORM_KIT, SUN_KIT, SWAN_KIT } from '../Valkyrie';
import { MECH_KIT, SCRAP_KIT, type Mech } from '../Mech';
import { HIVE_KIT, SYNTH_KIT, VAPOR_KIT } from '../Synth';
import { SIEGE_MS, SwarmProtocol } from './robot';
import { DeadOfNight, HauntedHouse } from './phantom';
import { POLTER_KIT, TEA_KIT } from '../Poltergeist';
import { CALA_KIT, FIREFLY_KIT, WRAITH_KIT } from '../Wraith';
import { ENGINEER_KIT } from '../Engineer';
import { EINSTEIN_KIT, SCIENTIST_KIT } from '../Scientist';
import { chainReaction, megaSentry } from './inventor';
import { BENFICA_KIT, EAGLE_KIT } from '../Eagle';
import { LION_KIT, SPORTING_KIT } from '../Lion';
import { DRAGON_KIT, PORTO_KIT } from '../Dragon';
import { kingsRoar, skySovereign, wyrmWrath } from './beast';
import { DarkDominion } from './sith';
import { SITH_KIT, WARLORD_KIT } from '../Sith';
import * as icons from './icons';
import type { Cast, UltDef, UltSkin } from './types';
import type { Effect } from '../Slash';
import { heroBuffs } from '../buffs';
import { heroTimers, LASTING_MS, type TimeLeft } from '../timers';

/** An effect that can say how long it has left (every `Fx`, the sentry). */
interface TimeTeller {
  timeLeft(): TimeLeft | null;
}

// The Special: each type's most powerful ability, paid for with energy (see
// energy.ts) and cast with Space or the Special button. The hero plants their
// feet and gathers power for a moment, glowing, with a rune turning under
// them and the Special's name rising overhead; then it is unleashed. A skin
// casts its type's Special in its own colours and under its own name.

const toxPal = (t: ToxStyle): Pal => ({ core: t.core, hot: t.hot, mid: t.mid, deep: t.deep, light: t.light, tints: [t.core, t.hot, t.mid, t.deep] });

/** Each type's Special, by `class:type`. */
const ULTS: Record<string, UltDef> = {
  'wizard:arcane': {
    name: 'Singularity',
    cost: 70,
    windup: 650,
    aim: 'spot',
    range: 120,
    pal: pal(0xf2ffff, 0x9ff6ff, 0x39c6f0, 0x3a5ce0, 0x6fe4ff),
    icon: icons.singularityIcon,
    cast: (c) => c.world.addEffect(new Singularity(c.world, c.tx, c.ty, c.pal)),
  },
  'wizard:pyro': {
    name: 'Inferno',
    cost: 80,
    windup: 600,
    aim: 'dir',
    pal: pal(0xfff8e0, 0xffd66b, 0xff9a2e, 0xd9432b, 0xff9a40),
    icon: icons.infernoIcon,
    cast: (c) => c.world.addEffect(new Inferno(c.world, c)),
  },
  'wizard:tide': {
    name: 'Maelstrom',
    cost: 70,
    windup: 600,
    aim: 'spot',
    range: 115,
    pal: TIDE_MAGIC.pal,
    icon: icons.maelstromIcon,
    cast: (c) => c.world.addEffect(new Maelstrom(c.world, c.tx, c.ty, c.pal, c.look === 'lotus')),
  },
  'warrior:knight': {
    name: 'Skybreaker',
    cost: 60,
    windup: 550,
    aim: 'spot',
    range: 95,
    pal: pal(0xffffff, 0xfff4c8, 0xffd66b, 0xb8762a, 0xffe0a0),
    icon: icons.skybreakerIcon,
    cast: (c) => c.world.addEffect(new Skybreaker(c.world, c.tx, c.ty, c.pal)),
  },
  'warrior:king': {
    name: 'Crown of Kings',
    cost: 65,
    windup: 600,
    aim: 'spot',
    range: 100,
    pal: KING_KIT.pal,
    icon: icons.kingsCrownIcon,
    cast: (c) => c.world.addEffect(new KingsCrown(c.world, c.tx, c.ty, c.pal)),
  },
  'paladin:holy': {
    name: "Heaven's Light",
    cost: 70,
    windup: 650,
    aim: 'self',
    pal: pal(0xffffff, 0xfff4c0, 0xffd66b, 0xc8903a, 0xfff0b0),
    icon: icons.heavensLightIcon,
    cast: (c) => c.world.addEffect(new HeavensLight(c.world, c)),
  },
  'paladin:crusader': {
    name: 'Wrath of the Sun',
    cost: 75,
    windup: 650,
    aim: 'self',
    pal: pal(0xfff8e0, 0xffd66b, 0xff8a3a, 0xc8401e, 0xffa050),
    icon: icons.sunWrathIcon,
    cast: (c) => c.world.addEffect(new SunWrath(c.world, c)),
  },
  'jedi:knight': {
    name: 'Saber Cyclone',
    cost: 60,
    windup: 450,
    aim: 'dir',
    pal: pal(0xffffff, 0xa8e0ff, 0x4aa6ff, 0x2a5cd0, 0x6fb8ff),
    icon: icons.saberCycloneIcon,
    cast: (c) => c.world.addEffect(new SaberCyclone(c.world, c)),
  },
  'jedi:sith': {
    name: 'Dark Dominion',
    cost: 70,
    windup: 600,
    aim: 'spot',
    range: 100,
    pal: SITH_KIT.dominion,
    icon: icons.dominionIcon,
    cast: (c) => c.world.addEffect(new DarkDominion(c.world, c)),
  },
  'fighter:brawler': {
    name: 'Dragon Rush',
    cost: 55,
    windup: 320,
    hold: 320,
    aim: 'dir',
    pal: pal(0xfff4d8, 0xffc060, 0xff6a3a, 0xb82a2a, 0xff8a50),
    icon: icons.dragonRushIcon,
    cast: (c) => c.world.addEffect(new DragonRush(c.world, c)),
  },
  'fighter:monk': {
    name: "Mountain's Wrath",
    cost: 65,
    windup: 600,
    aim: 'self',
    pal: pal(0xfffbe0, 0xffe08a, 0xf0a63a, 0x9a5a24, 0xffc060),
    icon: icons.mountainIcon,
    cast: (c) => c.world.addEffect(new MountainWrath(c.world, c)),
  },
  'alchemist:plague': {
    name: 'Pestilence',
    cost: 65,
    windup: 600,
    aim: 'spot',
    range: 110,
    pal: toxPal(PLAGUE_TOX),
    icon: icons.pestilenceIcon,
    cast: (c) => c.world.addEffect(new Pestilence(c.world, c.tx, c.ty, c.look === 'witch' ? HEX_TOX : c.look === 'shaman' ? SPIRIT_TOX : c.look === 'foxglove' ? FOXGLOVE_TOX : PLAGUE_TOX)),
  },
  'alchemist:chem': {
    name: 'Chem Bomb',
    cost: 70,
    windup: 500,
    aim: 'spot',
    range: 120,
    pal: toxPal(CHEM_TOX),
    icon: icons.chemBombIcon,
    cast: (c) => c.world.addEffect(new ChemBomb(c.world, c, c.look === 'cryo' ? CRYO_TOX : CHEM_TOX)),
  },
  'archer:ranger': {
    name: 'Great Arrow',
    cost: 60,
    windup: 650,
    aim: 'dir',
    pal: pal(0xf4ffe8, 0xc8f59a, 0x8ad65a, 0x3f8a4a, 0xb0f080),
    icon: icons.greatArrowIcon,
    cast: (c) => c.world.addEffect(new GreatArrow(c.world, c)),
  },
  'archer:arbalest': {
    name: 'Black Powder',
    cost: 65,
    windup: 500,
    aim: 'spot',
    range: 120,
    pal: pal(0xfffbe8, 0xffd27a, 0xff7a2a, 0x9e2725, 0xffa040),
    icon: icons.powderIcon,
    cast: (c) => c.world.addEffect(new PowderKeg(c.world, c)),
  },
  'archer:wind': {
    name: 'Tempest',
    cost: 60,
    windup: 450,
    aim: 'dir',
    pal: pal(0xffffff, 0xd8fff6, 0x6ef0dc, 0x2a9a9a, 0xa0fff0),
    icon: icons.tempestIcon,
    cast: (c) => c.world.addEffect(new Tempest(c.world, c)),
  },
  'rogue:rogue': {
    name: 'Fan of Knives',
    cost: 55,
    windup: 350,
    aim: 'self',
    pal: pal(0xffffff, 0xffd0d4, 0xe8505a, 0x8a1c2c, 0xff6070),
    icon: icons.fanIcon,
    cast: (c) => c.world.addEffect(new FanOfKnives(c.world, c)),
  },
  'rogue:dancer': {
    name: 'Eclipse',
    cost: 65,
    windup: 450,
    aim: 'self',
    pal: pal(0xf8f0ff, 0xd4b8ff, 0xa878ff, 0x4a2a8a, 0xb890ff),
    icon: icons.eclipseIcon,
    cast: (c) => c.world.addEffect(new Eclipse(c.world, c)),
  },
  'necromancer:necro': {
    name: 'Soul Storm',
    cost: 70,
    windup: 600,
    aim: 'self',
    pal: pal(0xf0fff8, 0xa8ffd8, 0x5cf0b0, 0x1f8a70, 0x7affc8),
    icon: icons.soulStormIcon,
    cast: (c) => c.world.addEffect(new SoulStorm(c.world, c)),
  },
  'necromancer:blood': {
    name: 'Blood Moon',
    cost: 75,
    windup: 650,
    aim: 'spot',
    range: 110,
    pal: pal(0xfff0f0, 0xff8a8a, 0xff3a4a, 0x8a0f1f, 0xff4a5a),
    icon: icons.bloodMoonIcon,
    cast: (c) => c.world.addEffect(new BloodMoon(c.world, c.tx, c.ty, c)),
  },
  'bard:minstrel': {
    name: 'Encore',
    cost: 65,
    windup: 550,
    aim: 'self',
    pal: pal(0xf4fffc, 0xa8fff0, 0x3fd8c8, 0x1a7a8a, 0x6fe8d8),
    icon: icons.encoreIcon,
    cast: (c) => c.world.addEffect(new Encore(c.world, c)),
  },
  'bard:drummer': {
    name: 'Thunder of War',
    cost: 70,
    windup: 600,
    aim: 'self',
    pal: pal(0xfffbe8, 0xffd98a, 0xff9a3a, 0xb8401e, 0xffa850),
    icon: icons.thunderIcon,
    cast: (c) => c.world.addEffect(new ThunderOfWar(c.world, c)),
  },
  'chronomancer:keeper': {
    name: 'Time Stop',
    cost: 75,
    windup: 650,
    aim: 'self',
    pal: KEEPER_PAL,
    icon: icons.timeStopIcon,
    cast: (c) => c.world.addEffect(new TimeStop(c.world, c)),
  },
  'chronomancer:paradox': {
    name: 'Legion of Echoes',
    cost: 70,
    windup: 550,
    aim: 'self',
    pal: RIFT_PAL,
    icon: icons.legionIcon,
    cast: (c) => c.world.addEffect(new Legion(c.world, c)),
  },
  'samurai:bladewind': {
    name: 'Sky Quake',
    cost: 60,
    windup: 220,
    hold: 250,
    aim: 'self',
    pal: schemePal(BLADEWIND_KIT.wind),
    icon: icons.skyQuakeIcon,
    gate: quakeGate,
    cast: (c) => c.world.addEffect(new SkyQuake(c.world, c)),
  },
  'samurai:ronin': {
    name: 'Hundred Cuts',
    cost: 65,
    windup: 400,
    hold: 800,
    aim: 'self',
    pal: schemePal(RONIN_KIT.wind),
    icon: icons.hundredCutsIcon,
    cast: (c) => c.world.addEffect(new HundredCuts(c.world, c)),
  },
  'druid:grove': {
    name: 'Wrath of the Wild',
    cost: 70,
    windup: 600,
    aim: 'spot',
    range: 110,
    pal: GROVE_PAL,
    icon: icons.wrathIcon,
    cast: (c) => c.world.addEffect(new WildWrath(c.world, c.tx, c.ty, c.pal, c.look === 'titania')),
  },
  'druid:wild': {
    name: 'Primal Stampede',
    cost: 65,
    windup: 500,
    aim: 'dir',
    pal: WILD_PAL,
    icon: icons.stampedeIcon,
    cast: (c) => c.world.addEffect(new PrimalStampede(c.world, c)),
  },
  'valkyrie:spear': {
    name: 'Spear of Odin',
    cost: 65,
    windup: 550,
    aim: 'spot',
    range: 105,
    pal: SPEAR_KIT.pal,
    icon: icons.odinIcon,
    cast: (c) => c.world.addEffect(new OdinSpear(c.world, c.tx, c.ty, c.pal, c.look === 'swan')),
  },
  'valkyrie:storm': {
    name: 'Thunder of Asgard',
    cost: 75,
    windup: 600,
    aim: 'self',
    pal: STORM_KIT.pal,
    icon: icons.asgardIcon,
    cast: (c) => c.world.addEffect(new AsgardThunder(c.world, c)),
  },
  'automaton:mech': {
    name: 'Siege Mode',
    cost: 70,
    windup: 500,
    aim: 'self',
    pal: MECH_KIT.boom,
    icon: icons.siegeIcon,
    // The mech plants itself and does the firing (see Mech.siege).
    lasts: SIEGE_MS,
    cast: (c) => (c.hero as Partial<Mech>).siege?.(SIEGE_MS),
  },
  'automaton:synth': {
    name: 'Swarm Protocol',
    cost: 75,
    windup: 600,
    aim: 'self',
    pal: SYNTH_KIT.pal,
    icon: icons.swarmIcon,
    cast: (c) => c.world.addEffect(new SwarmProtocol(c.world, c)),
  },
  'phantom:poltergeist': {
    name: 'Haunted House',
    cost: 70,
    windup: 550,
    aim: 'spot',
    range: 110,
    pal: POLTER_KIT.pal,
    icon: icons.hauntIcon,
    cast: (c) => c.world.addEffect(new HauntedHouse(c.world, c)),
  },
  'phantom:wraith': {
    name: 'Dead of Night',
    cost: 75,
    windup: 600,
    aim: 'self',
    pal: WRAITH_KIT.pal,
    icon: icons.nightIcon,
    cast: (c) => c.world.addEffect(new DeadOfNight(c.world, c)),
  },
  'inventor:engineer': {
    name: 'Mega Sentry',
    cost: 70,
    windup: 550,
    aim: 'spot',
    range: 90,
    pal: ENGINEER_KIT.pal,
    icon: icons.megaSentryIcon,
    cast: megaSentry,
  },
  'inventor:scientist': {
    name: 'Chain Reaction',
    cost: 75,
    windup: 600,
    aim: 'spot',
    range: 110,
    pal: SCIENTIST_KIT.pal,
    icon: icons.chainReactionIcon,
    cast: chainReaction,
  },
  'beast:eagle': {
    name: 'Sky Sovereign',
    cost: 70,
    windup: 550,
    aim: 'dir',
    pal: EAGLE_KIT.pal,
    icon: icons.skySovereignIcon,
    cast: skySovereign,
  },
  'beast:lion': {
    name: "King's Roar",
    cost: 70,
    windup: 600,
    aim: 'self',
    pal: LION_KIT.pal,
    icon: icons.kingsRoarIcon,
    cast: kingsRoar,
  },
  'beast:dragon': {
    name: 'Wrath of the Wyrm',
    cost: 75,
    windup: 650,
    aim: 'spot',
    range: 110,
    pal: DRAGON_KIT.pal,
    icon: icons.wyrmIcon,
    cast: wyrmWrath,
  },
};

/** Skins' colours for their type's Special, by `class:skin` (the name stays the type's). */
const SKINS: Record<string, UltSkin> = {
  'wizard:void': { pal: pal(0xfff0ff, 0xffa8f4, 0xd05cf0, 0x6a2fd0, 0xc47cff) },
  'warrior:jade': { pal: pal(0xf6fff0, 0xb6ffb0, 0x3fd98a, 0x16806a, 0x70f0b0) },
  'alchemist:witch': { pal: toxPal(HEX_TOX) },
  'fighter:lucha': { pal: pal(0xfff8e8, 0xffd35c, 0xff4fa0, 0x9a1c6a, 0xff80b8) },
  'fighter:champ': { pal: pal(0xf8ffe8, 0x9cff5a, 0xff8a2a, 0x1c7a1a, 0x8cf060) },
  'fighter:guardian': { pal: pal(0xfff4d0, 0xffc050, 0xff6a1a, 0xa02a10, 0xff8a30), type: 'monk' },
  'alchemist:shaman': { pal: toxPal(SPIRIT_TOX) },
  'alchemist:foxglove': { pal: toxPal(FOXGLOVE_TOX) },
  'alchemist:cryo': { pal: toxPal(CRYO_TOX), type: 'chem' },
  'archer:scarecrow': { pal: pal(0xfff4d0, 0xffb048, 0xff7a1a, 0x2a7a3a, 0x9cff9a) },
  'archer:hunt': { pal: pal(0xfbf8ff, 0xd8c8ff, 0x9a80f0, 0x4a3a9a, 0xb8a0ff) },
  'archer:wisteria': { pal: pal(0xffffff, 0xe8dcff, 0xb48ae8, 0x5a7a58, 0xd0b8ff), type: 'wind' },
  'archer:briar': { pal: pal(0xfff0f2, 0xffa0b0, 0xe8344a, 0x2e6e24, 0xff6a7a), type: 'arbalest' },
  'rogue:corsair': { pal: pal(0xfffbe0, 0xffe08a, 0xe0a030, 0x8a5018, 0xffc050) },
  'rogue:kitsune': { pal: pal(0xf4fbff, 0xa8e0ff, 0x4a9cff, 0x1a3aa0, 0x70b0ff), type: 'dancer' },
  'rogue:nightbloom': { pal: pal(0xffffff, 0xe4e8fa, 0x8a7ef0, 0x241a6a, 0xc8c0ff), type: 'dancer' },
  'archer:storm': { pal: pal(0xf2fbff, 0xa8e4ff, 0x5ec8ff, 0x3a6ad8, 0x8ad8ff) },
  'chronomancer:moon': { pal: MOON_PAL },
  'chronomancer:aeon': { pal: AEON_PAL, type: 'paradox' },
  'bard:wildsong': { pal: pal(0xfffde6, 0xeaffa0, 0x9ee85a, 0x2e7a3e, 0xb8f070) },
  'necromancer:tomb': { pal: pal(0xf4fbff, 0xa8dcff, 0x3c94f0, 0x1a3894, 0x5aa8ff) },
  'necromancer:wyrm': { pal: pal(0xfff8e0, 0xffc860, 0xff6a1a, 0x8a1e0a, 0xff8a30), type: 'blood' },
  'bard:harlequin': { pal: pal(0xfff4fb, 0xffb0e8, 0xff4ab8, 0x8a1a6a, 0xff6ac8) },
  'bard:vagabond': { pal: pal(0xfbf6ff, 0xe2d0ff, 0xb08cff, 0x5a3aa8, 0xc0a0ff) },
  'bard:fadista': { pal: pal(0xf4f8ff, 0xb8d2ff, 0x3c7cff, 0x1a2e9a, 0x6a9cff) },
  'bard:orpheus': { pal: pal(0xfffdf2, 0xffeeaa, 0xffc84a, 0x7a3ab0, 0xffd870) },
  'bard:howl': { pal: pal(0xf2f4ff, 0xbcc8ff, 0x6c7cff, 0x2c2a9a, 0x8a9aff), type: 'drummer' },
  'chronomancer:clockwork': { pal: CLOCKWORK_PAL },
  'chronomancer:primavera': { pal: pal(0xfffaf2, 0xffd0de, 0xf48cae, 0x3e9a78, 0xd8f4e4) },
  'chronomancer:anomaly': { pal: ANOMALY_PAL, type: 'paradox' },
  'samurai:oni': { pal: schemePal(ONI_KIT.wind) },
  'samurai:sakura': { pal: schemePal(SAKURA_KIT.wind), type: 'ronin' },
  'wizard:astral': { pal: pal(0xfffdf2, 0xfff0a8, 0xffc860, 0x6a5ae0, 0xffe08a) },
  'wizard:hellfire': { pal: pal(0xf4ffe8, 0xc8ff7a, 0x5ee83a, 0x1a8a3a, 0x7aff5a), type: 'pyro' },
  'wizard:pumpkin': { pal: pal(0xfff4d8, 0xffc04a, 0xff7a1a, 0x7a2ad0, 0xff8a30), type: 'pyro' },
  'wizard:abyssal': { pal: ABYSS_MAGIC.pal, type: 'tide' },
  'wizard:lotus': { pal: pal(0xfff4fa, 0xffb8d4, 0x3ed0b0, 0x1a7a78, 0xffa0c8), type: 'tide' },
  'warrior:spartan': { pal: pal(0xfff0e8, 0xff9a80, 0xf03a3a, 0x8a0a1a, 0xff6a50) },
  'warrior:headless': { pal: pal(0xfff4d0, 0xffb040, 0xff6a14, 0x5a1a7a, 0xff8a2a) },
  'warrior:afonso': { pal: AFONSO_KIT.pal, type: 'king' },
  'paladin:seraph': { pal: pal(0xffffff, 0xfff0d0, 0xffc890, 0xff8ab8, 0xffd8b0) },
  'paladin:oathbreaker': { pal: pal(0xf6eeff, 0xd8b0ff, 0xa060ff, 0x4a1a8a, 0xb070ff), type: 'crusader' },
  'jedi:guard': { pal: pal(0xfffdf2, 0xffe680, 0xf2c630, 0xa86a10, 0xffd04a) },
  'jedi:master': { pal: pal(0xf4fff4, 0x9af4a8, 0x2ed058, 0x0e7a32, 0x5aff7a) },
  'jedi:warlord': { pal: WARLORD_KIT.dominion, type: 'sith' },
  'samurai:kitsune': { pal: schemePal(KITSUNE_KIT.wind) },
  'samurai:shogun': { pal: schemePal(SHOGUN_KIT.wind), type: 'ronin' },
  'druid:autumn': { pal: AUTUMN_MAGIC.pal },
  'druid:titania': { pal: pal(0xfffaf0, 0xffd88a, 0xff9ac0, 0xb8487a, 0xffb8d0) },
  'druid:frostfang': { pal: FROST_MAGIC.pal, type: 'wild' },
  'valkyrie:sunshield': { pal: SUN_KIT.pal },
  'valkyrie:swan': { pal: SWAN_KIT.pal },
  'valkyrie:raven': { pal: RAVEN_KIT.pal, type: 'storm' },
  'automaton:scrap': { pal: SCRAP_KIT.boom },
  // Gunmetal and signal-flag red and yellow.
  'automaton:dreadnought': { pal: pal(0xfff6d8, 0xffd040, 0xe02a20, 0x3a3f48, 0xffa040) },
  'automaton:hive': { pal: HIVE_KIT.pal, type: 'synth' },
  'automaton:vaporwave': { pal: VAPOR_KIT.pal, type: 'synth' },
  'phantom:tea': { pal: TEA_KIT.pal },
  'phantom:cala': { pal: CALA_KIT.pal, type: 'wraith' },
  'phantom:firefly': { pal: FIREFLY_KIT.pal, type: 'wraith' },
  'inventor:einstein': { pal: EINSTEIN_KIT.pal, type: 'scientist' },
  'beast:benfica': { pal: BENFICA_KIT.pal, type: 'eagle' },
  'beast:sporting': { pal: SPORTING_KIT.pal, type: 'lion' },
  'beast:porto': { pal: PORTO_KIT.pal, type: 'dragon' },
};

/** The Special as worn: its def, and its name, colours and icon for this look. */
export interface WornUlt {
  def: UltDef;
  name: string;
  pal: Pal;
  icon: string;
}

const iconKey = (cls: string, look: string) => `ult_icon_${cls}_${look}`;

export function ultFor(ch: CharacterDef): WornUlt {
  const def = ULTS[`${ch.id}:${ch.type.id}`] ?? ULTS['wizard:arcane'];
  const skin = ch.skin ? SKINS[`${ch.id}:${ch.skin.id}`] : undefined;
  return { def, name: def.name, pal: skin?.pal ?? def.pal, icon: iconKey(ch.id, ch.look) };
}

/** Paint every Special's icon, in every look, once. */
export function ensureUltIcons(scene: Phaser.Scene): void {
  const add = (key: string, def: UltDef, p: Pal) => {
    if (scene.textures.exists(key)) return;
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(16, 16);
    img.data.set(icons.paintIcon(def.icon, p));
    ctx.putImageData(img, 0, 0);
    scene.textures.addCanvas(key, bakedCanvas(c));
  };
  for (const [k, def] of Object.entries(ULTS)) {
    const [cls, type] = k.split(':');
    add(iconKey(cls, type), def, def.pal);
  }
  for (const [k, skin] of Object.entries(SKINS)) {
    const [cls, id] = k.split(':');
    // A skin belongs to its class's base type unless it names another.
    const def = skin.type ? ULTS[`${cls}:${skin.type}`] : Object.entries(ULTS).find(([u]) => u.startsWith(`${cls}:`))?.[1];
    if (def) add(iconKey(cls, id), def, skin.pal);
  }
}

const HEAD = 44;

/**
 * Casts the worn Special: waits for the hero to finish what they're doing,
 * spends the energy, holds them in a gathering pose, then unleashes it.
 */
export class UltCaster {
  readonly ult: WornUlt;
  private t = -1;
  private released = false;
  private pending: { aim: Aim | null; facing: { x: number; y: number }; left: number } | null = null;
  private cast: Cast | null = null;
  private frames: string[] = [];
  private paused = false;
  private layers: Phaser.GameObjects.Sprite[] | null = null;
  private overlay: Phaser.GameObjects.Sprite;
  private rune: Ink;
  private lamp: Phaser.GameObjects.Light;
  private title: Phaser.GameObjects.BitmapText | null = null;
  private moteT = 0;
  private nagT = 0;
  /** Told each time the Special is cast (online, so the other players see it too). */
  onCast: ((aim: Aim | null, facing: { x: number; y: number }) => void) | null = null;

  constructor(
    private world: WorldScene,
    private hero: Hero,
    private ch: CharacterDef,
  ) {
    this.ult = ultFor(ch);
    this.overlay = world.add.sprite(0, 0, hero.sprite.texture.key).setBlendMode(Phaser.BlendModes.ADD).setTint(this.ult.pal.hot).setVisible(false);
    this.rune = new Ink(world, 80, 50);
    this.lamp = world.lights.addLight(0, 0, 90, this.ult.pal.light, 0);
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  get cost(): number {
    return this.ult.def.cost;
  }

  /** The hero is gathering power (or about to): the world holds back their other abilities. */
  get holding(): boolean {
    return this.t >= 0 || this.pending !== null;
  }

  /** The hero is held in the pose and can't walk. */
  get rooted(): boolean {
    return this.t >= 0 && this.t < this.ult.def.windup + (this.ult.def.hold ?? 0);
  }

  /** C or the Special button: cast once the hero is free, if there's energy for it. `facing` is the way they last walked, for when nothing is aimed at. */
  request(aim: Aim | null, facing: { x: number; y: number }): void {
    if (this.t >= 0) return;
    if (!energy.ready) {
      if (this.nagT <= 0) {
        this.nagT = 900;
        this.world.popNumber(Math.round(this.hero.x), Math.round(this.hero.y) - 40, 'NEED ENERGY', 0x9aa4c8);
      }
      return;
    }
    // A Special that needs a target refuses here, before any energy is spent (another player's is taken as cast).
    const gate = this.ult.def.gate;
    const ghost = (this.world as unknown as { __ghost?: boolean }).__ghost;
    const refused = gate && !ghost ? gate(this.world, this.hero) : null;
    if (refused) {
      if (this.nagT <= 0) {
        this.nagT = 900;
        this.world.popNumber(Math.round(this.hero.x), Math.round(this.hero.y) - 40, refused, 0x9aa4c8);
      }
      return;
    }
    this.pending = { aim, facing, left: 700 };
  }

  cancel(): void {
    this.pending = null;
    if (this.t >= 0) this.finish();
  }

  update(dt: number): void {
    this.nagT -= dt;
    const pend = this.pending;
    if (pend) {
      pend.left -= dt;
      const key = this.hero.sprite.anims.currentAnim?.key ?? '';
      if (/_(idle|walk|move)_/.test(key)) {
        this.pending = null;
        this.start(pend.aim, pend.facing);
      } else if (pend.left <= 0) this.pending = null;
    }
    if (this.t < 0) return;
    this.t += dt;
    const def = this.ult.def;
    const p = this.ult.pal;
    const h = this.hero;
    const t = this.t;
    const W = def.windup;
    const pose = W + (def.hold ?? 0);

    if (t < pose) this.pose(t / W);
    else if (this.paused) this.unpose();
    if (!this.released && t >= W) this.release();

    // Power gathering: the body lit from within, a rune under the feet, motes drawn up round them.
    const g = Math.min(1, t / W);
    const glow = t < W ? 0.25 + 0.5 * g * (0.8 + 0.2 * Math.sin(t * 0.03)) : Math.max(0, 0.75 * (1 - (t - W) / 250));
    const body = h.sprite;
    this.overlay
      .setVisible(glow > 0.01)
      .setTexture(body.texture.key, body.frame.name)
      .setOrigin(body.originX, body.originY)
      .setPosition(body.x, body.y)
      .setFlipX(body.flipX)
      .setDepth(body.depth + 0.05)
      .setAlpha(glow * h.alpha);
    const r = this.rune.begin(h.x, h.y, 2.6);
    const open = t < W ? easeOut(t / (W * 0.7)) : 1 - Math.min(1, (t - W) / 300);
    rune(r, h.x, h.y, 22 * open, t * 0.006, p, open);
    if (t < W) ring(r, h.x, h.y, 26 * (1 - g) + 4, 1, p, g);
    r.end();
    this.lamp.setPosition(h.x, h.y - 12);
    this.lamp.intensity = 2.4 * (t < W ? g : Math.max(0, 1 - (t - W) / 400));
    this.moteT -= dt;
    if (t < W && this.moteT <= 0) {
      this.moteT = 45;
      const a = Math.random() * Math.PI * 2;
      this.world.debris(p.tints, h.x + Math.cos(a) * 14, h.y - 2 + Math.sin(a) * 6, 1, h.y + 2, 'spores');
    }
    this.title?.setPosition(Math.round(h.x), Math.round(h.y) - HEAD - Math.round(4 * easeOut(g)));

    if (t >= pose + 400) this.finish();
  }

  private start(aim: Aim | null, facing: { x: number; y: number }): void {
    if (!energy.spend()) return;
    this.onCast?.(aim, facing);
    const def = this.ult.def;
    const h = this.hero;
    let dx = aim?.x ?? facing.x;
    let dy = aim?.y ?? facing.y;
    const l = Math.hypot(dx, dy) || 1;
    dx /= l;
    dy /= l;
    let tx = h.x;
    let ty = h.y;
    if (def.aim === 'spot') {
      const range = def.range ?? 100;
      const r = aim?.dist !== undefined ? Phaser.Math.Clamp(aim.dist, 24, range) : range * 0.65;
      // A mouse (or an auto-aimed foe) is measured from the chest; its spot on the ground is lower.
      const lift = aim?.dist !== undefined ? -14 + 10 : 0;
      for (let d = r; d >= 0; d -= 4) {
        tx = h.x + dx * d;
        ty = h.y + lift + dy * d;
        if (this.world.walkable(tx, ty)) break;
      }
    }
    this.cast = { world: this.world, hero: h, x: h.x, y: h.y, dx, dy, tx, ty, pal: this.ult.pal, look: this.ch.look };
    this.t = 0;
    this.released = false;

    // The pose: the look's big casting animation, turned the way it's aimed.
    const dir = dirOf(dx, dy);
    const anim = this.world.anims.get(this.ch.preview.chosen.replace(/_down$/, `_${dir}`)) ?? this.world.anims.get(this.ch.preview.chosen);
    this.frames = anim ? anim.frames.map((f) => String(f.textureFrame)) : [];
    if (!this.layers) {
      // The body's glow and sun-shadow layers use the same frames, from their own textures.
      const body = h.sprite;
      const find = (key: string) =>
        this.world.children.list
          .filter((o): o is Phaser.GameObjects.Sprite => o instanceof Phaser.GameObjects.Sprite && o.texture.key === key)
          .sort((a, b) => Math.hypot(a.x - body.x, a.y - body.y) - Math.hypot(b.x - body.x, b.y - body.y))[0];
      this.layers = [find(`${body.texture.key}_e`), find(`${body.texture.key}_s`)].filter((s) => !!s);
    }
    this.world.evade(def.windup + (def.hold ?? 0) + 150);
    sound.ultCharge(def.windup / 1000);

    this.title?.destroy();
    this.title = this.world.add
      .bitmapText(Math.round(h.x), Math.round(h.y) - HEAD, 'pixel', this.ult.name.toUpperCase())
      .setLetterSpacing(-1)
      .setOrigin(0.5, 1)
      .setTint(this.ult.pal.hot)
      .setDepth(10003)
      .setAlpha(0);
    this.world.tweens.add({ targets: this.title, alpha: 1, duration: 180 });
  }

  /** Hold the hero in the casting pose: its frames play through the windup, then hold at their height. */
  private pose(k: number): void {
    const body = this.hero.sprite;
    if (body.anims.isPlaying) {
      body.anims.pause();
      this.paused = true;
    }
    const n = this.frames.length;
    if (!n) return;
    const name = this.frames[Math.min(n - 1, Math.floor(Math.min(1, k) * Math.max(1, n * 0.75)))];
    if (!body.texture.has(name)) return;
    body.setFrame(name);
    for (const s of this.layers ?? []) if (s.texture.has(name)) s.setFrame(name);
  }

  private unpose(): void {
    const body = this.hero.sprite;
    if (this.paused && body.anims.currentAnim) body.anims.resume();
    this.paused = false;
  }

  private release(): void {
    this.released = true;
    const c = this.cast!;
    const w = this.world;
    const p = this.ult.pal;
    const h = this.hero;
    c.x = h.x;
    c.y = h.y;
    if (this.ult.def.aim === 'self') {
      c.tx = h.x;
      c.ty = h.y;
    }
    sound.ultRelease(w.pan(h.x));
    w.cameras.main.shake(140, 0.0018);
    w.debris(p.tints, h.x, h.y - 14, 16, h.y + 20, 'burst');
    flare(w, h.x, h.y - 14, 150, p.light, 3, 500);
    bloom(w, h.x, h.y - 14, p.hot, 2.4, 320, h.y + 20);
    w.addEffect(new Shock(w, h.x, h.y, p));
    const fresh = heroBuffs.active.filter((b) => b.left >= b.def.duration);
    const made = w.castSpecial(() => this.ult.def.cast(c));
    this.time(made, fresh.length);
    if (this.title) {
      const title = this.title;
      this.title = null;
      w.tweens.add({ targets: title, y: title.y - 10, alpha: 0, delay: 350, duration: 650, ease: 'Sine.In', onComplete: () => title.destroy() });
    }
  }

  /**
   * A Special that lasts gets a timer badge in the HUD, following the longest
   * lived thing it set going. One that only buffs the hero is already shown by
   * that buff's badge.
   */
  private time(made: Effect[], buffsBefore: number): void {
    const def = this.ult.def;
    const key = 'special';
    if (def.lasts) {
      heroTimers.run(key, 'special', this.ult.icon, this.ult.pal.hot, def.lasts);
      return;
    }
    if (heroBuffs.active.filter((b) => b.left >= b.def.duration).length > buffsBefore) return;
    let best: TimeTeller | null = null;
    let most = LASTING_MS;
    for (const e of made) {
      const t = (e as Partial<TimeTeller>).timeLeft?.();
      if (t && t.left >= most) {
        most = t.left;
        best = e as unknown as TimeTeller;
      }
    }
    if (best) {
      const teller = best;
      heroTimers.follow(key, 'special', this.ult.icon, this.ult.pal.hot, () => teller.timeLeft());
    }
  }

  private finish(): void {
    this.unpose();
    this.t = -1;
    this.overlay.setVisible(false);
    this.rune.begin(0, 0, 0).end();
    this.lamp.intensity = 0;
    this.title?.destroy();
    this.title = null;
  }

  private destroy(): void {
    this.overlay.destroy();
    this.rune.destroy();
    this.title?.destroy();
  }
}

/** The ring of force that bursts off the hero as a Special is unleashed. */
class Shock extends Fx {
  private pix: Ink;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private p: Pal,
  ) {
    super(world, 320);
    this.pix = this.ink(90, 56);
  }

  protected step(): void {
    const k = this.t / 320;
    const g = this.pix.begin(this.x, this.y, 2.7);
    ring(g, this.x, this.y, 4 + 36 * easeOut(k), 2.5 * (1 - k) + 0.8, this.p, 1 - k);
    g.end();
  }
}

/** A mote's two twinkle frames in a palette: a small plus, and a fuller glint with a white heart. */
function moteTextures(scene: Phaser.Scene, p: Pal): [string, string] {
  const keys: [string, string] = [`emote_${p.hot}_0`, `emote_${p.hot}_1`];
  if (scene.textures.exists(keys[1])) return keys;
  const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;
  const shapes: [number, number, number][][] = [
    // Small: a white heart and four hot arms.
    [[2, 2, p.core], [1, 2, p.hot], [3, 2, p.hot], [2, 1, p.hot], [2, 3, p.hot]],
    // Full: longer arms fading to the mid tone, a hot ring round the heart.
    [
      [2, 2, 0xffffff], [1, 2, p.core], [3, 2, p.core], [2, 1, p.core], [2, 3, p.core],
      [0, 2, p.mid], [4, 2, p.mid], [2, 0, p.mid], [2, 4, p.mid],
      [1, 1, p.hot], [3, 1, p.hot], [1, 3, p.hot], [3, 3, p.hot],
    ],
  ];
  shapes.forEach((px, i) => {
    const c = document.createElement('canvas');
    c.width = c.height = 5;
    const g = c.getContext('2d')!;
    for (const [x, y, col] of px) {
      g.fillStyle = hex(col);
      g.fillRect(x, y, 1, 1);
    }
    scene.textures.addCanvas(keys[i], bakedCanvas(c));
  });
  return keys;
}

interface Mote {
  img: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  tail: Phaser.GameObjects.Image[];
  /** Tail points, easing after the mote. */
  tx: number[];
  ty: number[];
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** When it stops drifting and heads for the hero, and where from. */
  at: number;
  fx: number;
  fy: number;
  /** Which way its flight bows, and how long the flight takes. */
  side: number;
  dur: number;
  gone: boolean;
}

/**
 * Energy leaving a slain foe: little glints of light pop out of the body,
 * hang in the air for a breath, then one after another curve in to the
 * hero, each soaked up with a soft chime a step higher than the last, and
 * the Special's ring fills with them.
 */
export class EnergyMotes extends Fx {
  private motes: Mote[] = [];
  private share: number;
  private left: number;
  private keys: [string, string];
  /** A soft glow on the hero that swells each time a mote arrives. */
  private aura: Phaser.GameObjects.Image;
  private auraK = 0;
  private soaked = 0;

  constructor(
    world: WorldScene,
    x: number,
    y: number,
    private hero: Hero,
    amount: number,
    private p: Pal,
  ) {
    super(world, 2600);
    const n = Math.max(3, Math.min(8, Math.round(amount / 3)));
    this.share = amount / n;
    this.left = n;
    this.keys = moteTextures(world, p);
    this.aura = this.own(world.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(p.hot).setAlpha(0).setDepth(9499));
    // A small soft pop where the foe fell.
    bloom(world, x, y, p.hot, 0.9, 260, 9499, 0.7);
    const spin = Math.random() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      // Fanned out and mostly upwards, like sparks thrown off the body.
      const a = spin + (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const s = 38 + Math.random() * 26;
      const img = this.own(world.add.image(x, y, this.keys[1]).setDepth(9501));
      const glow = this.own(world.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(p.hot).setScale(0.2).setAlpha(0.75).setDepth(9500));
      const tail = [0, 1].map((j) => this.own(world.add.image(x, y, this.keys[0]).setAlpha(j ? 0.3 : 0.55).setDepth(9500)));
      this.motes.push({
        img,
        glow,
        tail,
        tx: [x, x],
        ty: [y, y],
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s * 0.7 - 34,
        // They set off one after another, so they land in a quick ripple.
        at: 300 + i * 70 + Math.random() * 20,
        fx: x,
        fy: y,
        side: i % 2 ? 1 : -1,
        dur: 0,
        gone: false,
      });
    }
  }

  protected step(dt: number): void {
    const s = dt / 1000;
    const hx = this.hero.x;
    const hy = this.hero.y - 14;
    const follow = 1 - Math.exp(-dt / 22);
    for (const [i, m] of this.motes.entries()) {
      if (m.gone) continue;
      if (this.t < m.at) {
        // Thrown out, slowing to a hang with a gentle bob.
        const drag = Math.exp(-dt / 110);
        m.vx *= drag;
        m.vy *= drag;
        m.x += m.vx * s;
        m.y += m.vy * s + Math.sin(this.t * 0.012 + i) * 0.08;
        m.fx = m.x;
        m.fy = m.y;
        m.dur = Math.max(260, Math.min(620, 200 + Math.hypot(hx - m.x, hy - m.y) * 2.2));
      } else {
        // Then an accelerating curve into the hero, bowed to one side.
        const k = Math.min(1, (this.t - m.at) / m.dur);
        const e = k * k * (1.6 - 0.6 * k);
        const dx = hx - m.fx;
        const dy = hy - m.fy;
        const bow = Math.min(26, Math.hypot(dx, dy) * 0.35) * m.side * Math.sin(k * Math.PI) * (1 - k * 0.4);
        const d = Math.hypot(dx, dy) || 1;
        m.x = m.fx + dx * e - (dy / d) * bow;
        m.y = m.fy + dy * e + (dx / d) * bow;
        if (k >= 1) {
          this.soak(m);
          continue;
        }
      }
      if (this.t > 2300) {
        this.soak(m);
        continue;
      }
      m.tx[0] += (m.x - m.tx[0]) * follow;
      m.ty[0] += (m.y - m.ty[0]) * follow;
      m.tx[1] += (m.tx[0] - m.tx[1]) * follow;
      m.ty[1] += (m.ty[0] - m.ty[1]) * follow;
      const twinkle = Math.floor((this.t + i * 53) / 90) % 3 === 0;
      m.img.setTexture(this.keys[twinkle ? 0 : 1]).setPosition(Math.round(m.x), Math.round(m.y));
      m.glow.setPosition(Math.round(m.x), Math.round(m.y));
      m.tail.forEach((t, j) => t.setPosition(Math.round(m.tx[j]), Math.round(m.ty[j])));
    }
    this.auraK = Math.max(0, this.auraK - dt / 260);
    this.aura.setPosition(Math.round(hx), Math.round(hy)).setScale(0.55 + 0.35 * this.auraK).setAlpha(0.55 * this.auraK);
    if (this.left <= 0 && this.auraK <= 0) this.destroy();
  }

  private soak(m: Mote): void {
    m.gone = true;
    for (const o of [m.img, m.glow, ...m.tail]) o.setVisible(false);
    this.left--;
    const h = this.hero;
    this.auraK = 1;
    this.world.debris([this.p.core, this.p.hot], h.x, h.y - 14, 1, h.y + 20, 'gather');
    sound.energy(this.world.pan(h.x), this.soaked++);
    if (energy.gain(this.share)) {
      this.world.popNumber(Math.round(h.x), Math.round(h.y) - 42, 'SPECIAL READY', this.p.hot);
      this.world.debris(this.p.tints, h.x, h.y - 14, 14, h.y + 20, 'burst');
      sound.ultReady();
    } else if (this.left === 0) {
      // The last one lands with a soft swell of light.
      bloom(this.world, h.x, h.y - 14, this.p.hot, 1.3, 300, h.y + 20, 0.6);
    }
  }
}
