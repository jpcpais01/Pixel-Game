// Playable characters, in three levels:
//  - a class (the Wizard) is a hero with its own Hero class and art;
//  - a type (the Pyromancer) is a way to play that class, with its own stats
//    and abilities; the first type is the class's base type;
//  - a skin (Void) belongs to a type and changes only its looks.
// The select screen lists CLASSES in order, and the world spawns whichever
// look was picked. A class's spawn gets a look id: a type's own id for its
// base look, or one of its skins' ids. Ids are unique within a class, so the
// look id alone says both the type and the skin (and old saves, which stored
// one id per hero, still load).

import type Phaser from 'phaser';
import type { WorldScene } from '../scenes/WorldScene';
import { ARCANE_SKIN, VOID_SKIN, Wizard } from './Wizard';
import { PYRO_SKIN, Pyromancy } from './Pyro';
import { JADE_SKIN, KNIGHT_SKIN, Warrior } from './Warrior';
import { WARRIOR_H, WARRIOR_ORIGIN_Y } from '../art/warrior';
import { CRUSADER_KIT, HOLY_KIT, Paladin } from './Paladin';
import { PALADIN_H, PALADIN_ORIGIN_Y } from '../art/paladin';
import { Jedi, JEDI_STYLE, SITH_STYLE } from './Jedi';
import { JEDI_H, JEDI_ORIGIN_Y } from '../art/jedi';
import { BRAWLER_STYLE, Fighter, MONK_STYLE } from './Fighter';
import { FIGHTER_H, FIGHTER_ORIGIN_Y } from '../art/fighter';
import { Alchemist, CHEM_STYLE, PLAGUE_STYLE, WITCH_STYLE } from './Alchemist';
import { ALCH_H, ALCH_ORIGIN_Y } from '../art/alchemist';
import { Archer, RANGER_STYLE, STORM_STYLE } from './Archer';
import { ARCHER_H, ARCHER_ORIGIN_Y } from '../art/archer';
import { DANCER_STYLE, Rogue, ROGUE_STYLE } from './Rogue';
import { ROGUE_H, ROGUE_ORIGIN_Y } from '../art/rogue';
import { BLOOD_KIT, NECRO_KIT, Necromancer } from './Necromancer';
import { NECRO_H, NECRO_ORIGIN_Y } from '../art/necromancer';
import { Bard, DRUMMER_KIT, MINSTREL_KIT, WILD_KIT } from './Bard';
import { BARD_H, BARD_ORIGIN_Y } from '../art/bard';
import { CRIMSON_KIT, MARIONETTE_KIT, PORCELAIN_KIT, Puppeteer, WEAVER_KIT } from './Puppeteer';
import { PUPPETEER_H, PUPPETEER_ORIGIN_Y } from '../art/puppeteer';
import { AEON_KIT, Chrono, KEEPER_KIT, MOON_KIT, PARADOX_KIT } from './Chrono';
import { CHRONO_H, CHRONO_ORIGIN_Y } from '../art/chrono';
import { worn } from './skins';
import type { Vitals } from './combat';

/** A unit direction. */
export interface Aim {
  x: number;
  y: number;
  /** How far away the mouse is, in world px, for abilities that land at a spot. */
  dist?: number;
  /** The hero is fighting: it should face this way, even while walking another. */
  look?: boolean;
}

/** What the world needs from the player's character each frame. */
export interface Hero {
  x: number;
  y: number;
  /** 0 = night, 1 = day. */
  daylight: number;
  /** Health (and any barrier). The world deals damage and draws the bar over the head; the hero may heal itself. */
  readonly vitals: Vitals;
  /** The body sprite, tinted red for a moment when struck. */
  readonly sprite: Phaser.GameObjects.Sprite;
  /** 0..1: the world fades the whole figure through this (falling, rising); the hero applies it to its sprites each frame. */
  alpha: number;
  /**
   * `attack` and `special` are the two ability buttons (held = true). `aim` is
   * a unit vector towards the mouse on a computer, or on a touch screen the
   * way an ability button is dragged (else the nearest enemy); abilities go
   * that way instead of the way the hero last walked. Null: no aim.
   */
  update(dt: number, mx: number, my: number, attack: boolean, special: boolean, bounds: Phaser.Geom.Rectangle, aim?: Aim | null): void;
}

type Stats = { power: number; speed: number; range: number };

/** The animated portrait on the select screen. */
export interface Preview {
  texture: string;
  /** Additive glow layer with the same frame names, if any. */
  glow?: string;
  /** Looping idle animation key. */
  idle: string;
  /** Played once when the look is picked. */
  chosen: string;
  /** Feet as a fraction of the frame height, when frames aren't 24x32. */
  originY?: number;
}

/** Icons on the two ability buttons. */
export interface Buttons {
  attack: { texture: string; frame?: string; anim?: string };
  special: { texture: string };
}

/** A skin: the same type in a different look. Its ability names may change with the look, never what they do. */
export interface SkinDef {
  id: string;
  name: string;
  /** Overrides for the type's colour, tagline and ability names while worn. */
  accent?: number;
  role?: string;
  attack?: string;
  special?: string;
  preview: Preview;
  buttons: Buttons;
}

/** A type: a way to play a class, with its own stats and abilities, and its own skins. */
export interface TypeDef {
  id: string;
  name: string;
  /** A few words about how it plays, e.g. "Fire and fury". */
  role: string;
  /** Highlight colour. */
  accent: number;
  /** 1..5 pips each on the select screen. */
  stats: Stats;
  /** Ability names. */
  attack: string;
  special: string;
  /** The type's own look (its first skin). */
  preview: Preview;
  buttons: Buttons;
  /** What its own look is called in the skin list. */
  lookName?: string;
  /** Other looks for this type. */
  skins?: SkinDef[];
}

export interface ClassDef {
  id: string;
  name: string;
  /** One line about the class as a whole. */
  blurb: string;
  /**
   * The special is held to charge and fires on release (the wizard's beam), so
   * its touch button presses at once and dragging steers it, rather than
   * aiming first and firing on release.
   */
  chargeSpecial?: boolean;
  /** The first is the base type. */
  types: TypeDef[];
  /** `look` is a type's id or one of its skins' ids. */
  spawn(world: WorldScene, x: number, y: number, look: string): Hero;
}

/** A class as played: in one type and skin, with everything the HUD and the world need. */
export interface CharacterDef {
  /** The class id. */
  id: string;
  name: string;
  type: TypeDef;
  /** The worn skin, or null for the type's own look. */
  skin: SkinDef | null;
  /** The worn look's id (the type's id or the skin's). */
  look: string;
  role: string;
  accent: number;
  stats: Stats;
  attack: string;
  special: string;
  preview: Preview;
  buttons: Buttons;
  chargeSpecial?: boolean;
  spawn(world: WorldScene, x: number, y: number): Hero;
}

export const CLASSES: ClassDef[] = [
  {
    id: 'wizard',
    name: 'Wizard',
    blurb: 'Master of spells',
    chargeSpecial: true,
    types: [
      {
        id: 'arcane',
        name: 'Arcanist',
        role: 'Arcane caster',
        accent: 0x6fe4ff,
        stats: { power: 4, speed: 3, range: 5 },
        attack: 'Energy ball',
        special: 'Charged beam',
        preview: { texture: 'wizard', glow: 'wizard_e', idle: 'wizard_idle_down', chosen: 'wizard_cast_down' },
        buttons: {
          attack: { texture: 'orb_e', frame: 'o0', anim: 'orb_spin' },
          special: { texture: 'icon_beam' },
        },
        lookName: 'Arcane',
        skins: [
          {
            id: 'void',
            name: 'Void',
            role: 'Void caller',
            accent: 0xc47cff,
            attack: 'Void orb',
            special: 'Umbral beam',
            preview: { texture: 'wizard_void', glow: 'wizard_void_e', idle: 'wizard_void_idle_down', chosen: 'wizard_void_cast_down' },
            buttons: {
              attack: { texture: 'orb_void_e', frame: 'o0', anim: 'orb_void_spin' },
              special: { texture: 'icon_beam_void' },
            },
          },
        ],
      },
      {
        id: 'pyro',
        name: 'Pyromancer',
        role: 'Fire and fury',
        accent: 0xff8a30,
        stats: { power: 5, speed: 3, range: 4 },
        attack: 'Fireball',
        special: 'Meteor',
        preview: { texture: 'wizard_pyro', glow: 'wizard_pyro_e', idle: 'wizard_pyro_idle_down', chosen: 'wizard_pyro_cast_down' },
        buttons: {
          attack: { texture: 'orb_pyro_e', frame: 'o0', anim: 'orb_pyro_spin' },
          special: { texture: 'icon_meteor' },
        },
        lookName: 'Ember',
      },
    ],
    spawn(world, x, y, look) {
      if (look === 'pyro') {
        // Fireballs that blast and burn; a charged meteor called down where it's aimed.
        const fire = new Pyromancy(world);
        const w = new Wizard(
          world,
          x,
          y,
          {
            cast: (x, y, dx, dy) => fire.fireball(x, y, dx, dy),
            beam: (_x, _y, dx, dy, power, dist) => fire.meteor(dx, dy, power, dist),
            target: (dx, dy, level, dist) => fire.target(dx, dy, level, dist),
            untarget: () => fire.untarget(),
          },
          PYRO_SKIN,
        );
        fire.caster = w;
        world.addEffect(fire);
        return w;
      }
      const skin = look === 'void' ? VOID_SKIN : ARCANE_SKIN;
      const w: Wizard = new Wizard(
        world,
        x,
        y,
        {
          cast: (x, y, dx, dy) => world.castEnergyBall(x, y, dx, dy, skin.style),
          beam: (x, y, dx, dy, power) => world.fireBeam(x, y, dx, dy, power, w.depthAhead(), skin.style),
        },
        skin,
      );
      return w;
    },
  },
  {
    id: 'warrior',
    name: 'Warrior',
    blurb: 'Blade in the front line',
    types: [
      {
        id: 'knight',
        name: 'Knight',
        role: 'Sword and steel',
        accent: 0xffb54a,
        stats: { power: 5, speed: 4, range: 2 },
        attack: 'Three-hit combo',
        special: 'Whirlwind',
        preview: { texture: 'warrior', glow: 'warrior_e', idle: 'warrior_idle_down', chosen: 'warrior_thrust_down', originY: WARRIOR_ORIGIN_Y / WARRIOR_H },
        buttons: {
          attack: { texture: 'icon_sword' },
          special: { texture: 'icon_whirl' },
        },
        lookName: 'Steel',
        skins: [
          {
            id: 'jade',
            name: 'Jade',
            role: 'Blade of the jade wind',
            accent: 0x4fe0a0,
            attack: 'Katana combo',
            special: 'Jade gale',
            preview: { texture: 'warrior_jade', glow: 'warrior_jade_e', idle: 'warrior_jade_idle_down', chosen: 'warrior_jade_thrust_down', originY: WARRIOR_ORIGIN_Y / WARRIOR_H },
            buttons: {
              attack: { texture: 'icon_sword_jade' },
              special: { texture: 'icon_whirl_jade' },
            },
          },
        ],
      },
    ],
    spawn: (world, x, y, look) => new Warrior(world, x, y, look === 'jade' ? JADE_SKIN : KNIGHT_SKIN),
  },
  {
    id: 'paladin',
    name: 'Paladin',
    blurb: 'Holy shield of the party',
    types: [
      {
        id: 'holy',
        name: 'Templar',
        role: 'Tank and healer',
        accent: 0x7fb2ff,
        stats: { power: 3, speed: 2, range: 2 },
        attack: 'Smite',
        special: 'Consecration',
        preview: { texture: 'paladin', glow: 'paladin_e', idle: 'paladin_idle_down', chosen: 'paladin_consecrate_down', originY: PALADIN_ORIGIN_Y / PALADIN_H },
        buttons: {
          attack: { texture: 'icon_mace' },
          special: { texture: 'icon_sanctuary' },
        },
        lookName: 'Holy',
      },
      {
        // Harder, slower hammer blows and a burst of sunfire instead of healing ground.
        id: 'crusader',
        name: 'Crusader',
        role: 'Hammer and sunfire',
        accent: 0xff8a3a,
        stats: { power: 5, speed: 3, range: 2 },
        attack: 'Sunhammer',
        special: 'Sunfall',
        preview: { texture: 'paladin_crusader', glow: 'paladin_crusader_e', idle: 'paladin_crusader_idle_down', chosen: 'paladin_crusader_consecrate_down', originY: PALADIN_ORIGIN_Y / PALADIN_H },
        buttons: {
          attack: { texture: 'icon_hammer' },
          special: { texture: 'icon_sunfall' },
        },
        lookName: 'Sunforged',
      },
    ],
    spawn: (world, x, y, look) => new Paladin(world, x, y, look === 'crusader' ? CRUSADER_KIT : HOLY_KIT),
  },
  {
    id: 'jedi',
    name: 'Jedi',
    blurb: 'Saber and the Force',
    types: [
      {
        id: 'knight',
        name: 'Jedi knight',
        role: 'Saber and Force',
        accent: 0x5fb4ff,
        stats: { power: 4, speed: 5, range: 3 },
        attack: 'Saber flurry',
        special: 'Force push',
        preview: { texture: 'jedi', glow: 'jedi_e', idle: 'jedi_idle_down', chosen: 'jedi_push_down', originY: JEDI_ORIGIN_Y / JEDI_H },
        buttons: {
          attack: { texture: 'icon_saber' },
          special: { texture: 'icon_force' },
        },
        lookName: 'Light side',
        skins: [
          {
            id: 'sith',
            name: 'Sith',
            role: 'Dark side',
            accent: 0xff4a4a,
            special: 'Force storm',
            preview: { texture: 'jedi_sith', glow: 'jedi_sith_e', idle: 'jedi_sith_idle_down', chosen: 'jedi_sith_push_down', originY: JEDI_ORIGIN_Y / JEDI_H },
            buttons: {
              attack: { texture: 'icon_saber_sith' },
              special: { texture: 'icon_force_sith' },
            },
          },
        ],
      },
    ],
    spawn: (world, x, y, look) => new Jedi(world, x, y, look === 'sith' ? SITH_STYLE : JEDI_STYLE),
  },
  {
    id: 'fighter',
    name: 'Fighter',
    blurb: 'Bare hands, no mercy',
    types: [
      {
        id: 'brawler',
        name: 'Brawler',
        role: 'Fists of fury',
        accent: 0xff6a4a,
        stats: { power: 4, speed: 4, range: 2 },
        attack: 'Five-hit combo',
        special: 'Barrage',
        preview: { texture: 'fighter', glow: 'fighter_e', idle: 'fighter_idle_down', chosen: 'fighter_smash_down', originY: FIGHTER_ORIGIN_Y / FIGHTER_H },
        buttons: {
          attack: { texture: 'icon_fist' },
          special: { texture: 'icon_barrage' },
        },
        lookName: 'Street',
      },
      {
        id: 'monk',
        name: 'Iron monk',
        role: 'Palms of stone',
        accent: 0xf0a63a,
        stats: { power: 5, speed: 2, range: 3 },
        attack: 'Iron palm',
        special: 'Earthshaker',
        preview: { texture: 'fighter_monk', glow: 'fighter_monk_e', idle: 'fighter_monk_idle_down', chosen: 'fighter_monk_leap_down', originY: FIGHTER_ORIGIN_Y / FIGHTER_H },
        buttons: {
          attack: { texture: 'icon_palm' },
          special: { texture: 'icon_quake' },
        },
        lookName: 'Temple',
      },
    ],
    spawn: (world, x, y, look) => new Fighter(world, x, y, look === 'monk' ? MONK_STYLE : BRAWLER_STYLE),
  },
  {
    id: 'alchemist',
    name: 'Alchemist',
    blurb: 'Brews that melt foes',
    types: [
      {
        id: 'plague',
        name: 'Plague doctor',
        role: 'Poisons and potions',
        accent: 0x8cff5a,
        stats: { power: 3, speed: 3, range: 4 },
        attack: 'Poison flask',
        special: 'Plague bog',
        preview: { texture: 'alchemist', glow: 'alchemist_e', idle: 'alchemist_idle_down', chosen: 'alchemist_brew_down', originY: ALCH_ORIGIN_Y / ALCH_H },
        buttons: {
          attack: { texture: 'icon_flask' },
          special: { texture: 'icon_bog' },
        },
        lookName: 'Plague',
        skins: [
          {
            id: 'witch',
            name: 'Hex witch',
            role: 'Hexes and brews',
            accent: 0xe060ff,
            attack: 'Hex flask',
            special: 'Hex mire',
            preview: { texture: 'alchemist_witch', glow: 'alchemist_witch_e', idle: 'alchemist_witch_idle_down', chosen: 'alchemist_witch_brew_down', originY: ALCH_ORIGIN_Y / ALCH_H },
            buttons: {
              attack: { texture: 'icon_flask_witch' },
              special: { texture: 'icon_bog_witch' },
            },
          },
        ],
      },
      {
        // Quicker, shorter throws, corrosive chem that stacks higher, and a
        // fan of three canisters on the special.
        id: 'chem',
        name: 'Chemtech',
        role: 'Chem canisters',
        accent: 0xd4f030,
        stats: { power: 3, speed: 4, range: 3 },
        attack: 'Chem canister',
        special: 'Chem barrage',
        preview: { texture: 'alchemist_chem', glow: 'alchemist_chem_e', idle: 'alchemist_chem_idle_down', chosen: 'alchemist_chem_brew_down', originY: ALCH_ORIGIN_Y / ALCH_H },
        buttons: {
          attack: { texture: 'icon_flask_chem' },
          special: { texture: 'icon_bog_chem' },
        },
        lookName: 'Hazmat',
      },
    ],
    spawn: (world, x, y, look) => new Alchemist(world, x, y, look === 'chem' ? CHEM_STYLE : look === 'witch' ? WITCH_STYLE : PLAGUE_STYLE),
  },
  {
    id: 'archer',
    name: 'Archer',
    blurb: 'Death from afar',
    types: [
      {
        id: 'ranger',
        name: 'Ranger',
        role: 'Bow and arrow',
        accent: 0x9ad65a,
        stats: { power: 3, speed: 4, range: 5 },
        attack: 'Quick shot',
        special: 'Arrow rain',
        preview: { texture: 'archer', glow: 'archer_e', idle: 'archer_idle_down', chosen: 'archer_volley_down', originY: ARCHER_ORIGIN_Y / ARCHER_H },
        buttons: {
          attack: { texture: 'icon_bow' },
          special: { texture: 'icon_rain' },
        },
        lookName: 'Forest',
        skins: [
          {
            id: 'storm',
            name: 'Storm',
            role: 'Arrows of lightning',
            accent: 0x5ec8ff,
            attack: 'Lightning shot',
            special: 'Thunder rain',
            preview: { texture: 'archer_storm', glow: 'archer_storm_e', idle: 'archer_storm_idle_down', chosen: 'archer_storm_volley_down', originY: ARCHER_ORIGIN_Y / ARCHER_H },
            buttons: {
              attack: { texture: 'icon_bow_storm' },
              special: { texture: 'icon_rain_storm' },
            },
          },
        ],
      },
    ],
    spawn: (world, x, y, look) => new Archer(world, x, y, look === 'storm' ? STORM_STYLE : RANGER_STYLE),
  },
  {
    id: 'rogue',
    name: 'Rogue',
    blurb: 'Strike from the shadows',
    types: [
      {
        id: 'rogue',
        name: 'Cutthroat',
        role: 'Daggers and shadows',
        accent: 0xe8505a,
        stats: { power: 4, speed: 5, range: 2 },
        attack: 'Bleeding stabs',
        special: 'Shadowstep',
        preview: { texture: 'rogue', glow: 'rogue_e', idle: 'rogue_idle_down', chosen: 'rogue_cross_down', originY: ROGUE_ORIGIN_Y / ROGUE_H },
        buttons: {
          attack: { texture: 'icon_daggers' },
          special: { texture: 'icon_shadowstep' },
        },
        lookName: 'Crimson',
      },
      {
        // A lighter, wider four-cut chain ending in a spin, and a dance that
        // blinks from foe to foe instead of a dash.
        id: 'dancer',
        name: 'Shadow dancer',
        role: 'Blades in the dark',
        accent: 0xa878ff,
        stats: { power: 3, speed: 5, range: 3 },
        attack: 'Shadow cuts',
        special: 'Shadow dance',
        preview: { texture: 'rogue_dancer', glow: 'rogue_dancer_e', idle: 'rogue_dancer_idle_down', chosen: 'rogue_dancer_cross_down', originY: ROGUE_ORIGIN_Y / ROGUE_H },
        buttons: {
          attack: { texture: 'icon_daggers_dancer' },
          special: { texture: 'icon_shadowstep_dancer' },
        },
        lookName: 'Dusk',
      },
    ],
    spawn: (world, x, y, look) => new Rogue(world, x, y, look === 'dancer' ? DANCER_STYLE : ROGUE_STYLE),
  },
  {
    id: 'necromancer',
    name: 'Necromancer',
    blurb: 'Lord of the restless dead',
    types: [
      {
        id: 'necro',
        name: 'Bonecaller',
        role: 'Bone and soul',
        accent: 0x5cf0b0,
        stats: { power: 3, speed: 3, range: 4 },
        attack: 'Soul bolt',
        special: 'Raise dead',
        preview: { texture: 'necro', glow: 'necro_e', idle: 'necro_idle_down', chosen: 'necro_raise_down', originY: NECRO_ORIGIN_Y / NECRO_H },
        buttons: {
          attack: { texture: 'icon_soul' },
          special: { texture: 'icon_raise' },
        },
        lookName: 'Grave',
      },
      {
        // Tougher, with fast lances that pierce and heal, and a nova paid for
        // in his own blood instead of raising the dead.
        id: 'blood',
        name: 'Blood mage',
        role: 'Blood and sacrifice',
        accent: 0xff3a4a,
        stats: { power: 5, speed: 3, range: 3 },
        attack: 'Blood lance',
        special: 'Crimson nova',
        preview: { texture: 'necro_blood', glow: 'necro_blood_e', idle: 'necro_blood_idle_down', chosen: 'necro_blood_raise_down', originY: NECRO_ORIGIN_Y / NECRO_H },
        buttons: {
          attack: { texture: 'icon_lance' },
          special: { texture: 'icon_nova' },
        },
        lookName: 'Sanguine',
      },
    ],
    spawn: (world, x, y, look) => new Necromancer(world, x, y, look === 'blood' ? BLOOD_KIT : NECRO_KIT),
  },
  {
    id: 'bard',
    name: 'Bard',
    blurb: 'Songs that win battles',
    types: [
      {
        // Notes that leap from foe to foe, and a song that quickens and heals.
        id: 'minstrel',
        name: 'Minstrel',
        role: 'Lute and song',
        accent: 0x5ee8d6,
        stats: { power: 3, speed: 4, range: 4 },
        attack: 'Leaping notes',
        special: 'Song of haste',
        preview: { texture: 'bard', glow: 'bard_e', idle: 'bard_idle_down', chosen: 'bard_song_down', originY: BARD_ORIGIN_Y / BARD_H },
        buttons: {
          attack: { texture: 'icon_lute' },
          special: { texture: 'icon_song' },
        },
        lookName: 'Troubadour',
        skins: [
          {
            // A hooded wanderer out of the deep wood, wisps of light drifting round him.
            id: 'wildsong',
            name: 'Wildsong',
            role: 'Songs of the deep wood',
            accent: 0x9ee85a,
            attack: 'Wisp notes',
            special: 'Song of the grove',
            preview: { texture: 'bard_wild', glow: 'bard_wild_e', idle: 'bard_wild_idle_down', chosen: 'bard_wild_song_down', originY: BARD_ORIGIN_Y / BARD_H },
            buttons: {
              attack: { texture: 'icon_lute_wild' },
              special: { texture: 'icon_song_wild' },
            },
          },
        ],
      },
      {
        // Tougher and slower: drum blows that throw foes back, and a rhythm that makes every blow hit harder.
        id: 'drummer',
        name: 'War drummer',
        role: 'Drums of war',
        accent: 0xffa040,
        stats: { power: 5, speed: 3, range: 2 },
        attack: 'Drum blows',
        special: 'Battle rhythm',
        preview: { texture: 'bard_drum', glow: 'bard_drum_e', idle: 'bard_drum_idle_down', chosen: 'bard_drum_boom_down', originY: BARD_ORIGIN_Y / BARD_H },
        buttons: {
          attack: { texture: 'icon_drum' },
          special: { texture: 'icon_rhythm' },
        },
        lookName: 'Warband',
      },
    ],
    spawn: (world, x, y, look) => new Bard(world, x, y, look === 'drummer' ? DRUMMER_KIT : look === 'wildsong' ? WILD_KIT : MINSTREL_KIT),
  },
  {
    id: 'chronomancer',
    name: 'Chronomancer',
    blurb: 'Time bends to his will',
    types: [
      {
        // Second hands that slow what they strike, and a clock on the ground that all but stops time.
        id: 'keeper',
        name: 'Timekeeper',
        role: 'Slows and stops time',
        accent: 0xffc860,
        stats: { power: 3, speed: 3, range: 4 },
        attack: 'Second hand',
        special: 'Stasis clock',
        preview: { texture: 'chrono', glow: 'chrono_e', idle: 'chrono_idle_down', chosen: 'chrono_field_down', originY: CHRONO_ORIGIN_Y / CHRONO_H },
        buttons: {
          attack: { texture: 'icon_hand' },
          special: { texture: 'icon_stasis' },
        },
        lookName: 'Brass',
        skins: [
          {
            id: 'moon',
            name: 'Moonclock',
            role: 'Keeper of the night hours',
            accent: 0x9ccaff,
            attack: 'Moon hand',
            special: 'Moon dial',
            preview: { texture: 'chrono_moon', glow: 'chrono_moon_e', idle: 'chrono_moon_idle_down', chosen: 'chrono_moon_field_down', originY: CHRONO_ORIGIN_Y / CHRONO_H },
            buttons: {
              attack: { texture: 'icon_hand_moon' },
              special: { texture: 'icon_stasis_moon' },
            },
          },
        ],
      },
      {
        // Quicker and tougher: shards thrown again by his echo a moment behind him, and a rewind that undoes his wounds.
        id: 'paradox',
        name: 'Paradox',
        role: 'Echoes and rewinds',
        accent: 0xb890ff,
        stats: { power: 4, speed: 4, range: 3 },
        attack: 'Echo shards',
        special: 'Rewind',
        preview: { texture: 'chrono_rift', glow: 'chrono_rift_e', idle: 'chrono_rift_idle_down', chosen: 'chrono_rift_rewind_down', originY: CHRONO_ORIGIN_Y / CHRONO_H },
        buttons: {
          attack: { texture: 'icon_shards' },
          special: { texture: 'icon_rewind' },
        },
        lookName: 'Rift',
        skins: [
          {
            id: 'aeon',
            name: 'Aeon',
            role: 'Echoes of a green age',
            accent: 0x6ff0c0,
            attack: 'Aeon shards',
            special: 'Aeon rewind',
            preview: { texture: 'chrono_aeon', glow: 'chrono_aeon_e', idle: 'chrono_aeon_idle_down', chosen: 'chrono_aeon_rewind_down', originY: CHRONO_ORIGIN_Y / CHRONO_H },
            buttons: {
              attack: { texture: 'icon_shards_aeon' },
              special: { texture: 'icon_rewind_aeon' },
            },
          },
        ],
      },
    ],
    spawn(world, x, y, look) {
      const kit = { keeper: KEEPER_KIT, moon: MOON_KIT, paradox: PARADOX_KIT, aeon: AEON_KIT }[look] ?? KEEPER_KIT;
      return new Chrono(world, x, y, kit);
    },
  },
  {
    id: 'puppeteer',
    name: 'Puppeteer',
    blurb: 'Pulls every string',
    types: [
      {
        // Fights through his puppet: it lunges out to cut and chop, and pirouettes among his foes.
        id: 'marionette',
        name: 'Marionettist',
        role: 'His puppet fights',
        accent: 0xffc25a,
        stats: { power: 4, speed: 3, range: 3 },
        attack: 'Puppet strike',
        special: 'Pirouette',
        preview: { texture: 'puppeteer', glow: 'puppeteer_e', idle: 'puppeteer_idle_down', chosen: 'puppeteer_twirl_down', originY: PUPPETEER_ORIGIN_Y / PUPPETEER_H },
        buttons: {
          attack: { texture: 'icon_puppet' },
          special: { texture: 'icon_pirouette' },
        },
        lookName: 'Carnival',
        skins: [
          {
            id: 'porcelain',
            name: 'Porcelain',
            role: 'A doll of cracked porcelain',
            accent: 0x8ad0ff,
            attack: 'Doll strike',
            special: 'Porcelain spin',
            preview: { texture: 'puppeteer_porcelain', glow: 'puppeteer_porcelain_e', idle: 'puppeteer_porcelain_idle_down', chosen: 'puppeteer_porcelain_twirl_down', originY: PUPPETEER_ORIGIN_Y / PUPPETEER_H },
            buttons: {
              attack: { texture: 'icon_puppet_porcelain' },
              special: { texture: 'icon_pirouette_porcelain' },
            },
          },
        ],
      },
      {
        // No puppet: her threads cut, snag and reel foes in, and her strings hold whole crowds helpless.
        id: 'weaver',
        name: 'Stringweaver',
        role: 'Strings up her foes',
        accent: 0xc08cff,
        stats: { power: 3, speed: 4, range: 4 },
        attack: 'Razor thread',
        special: 'Marionette',
        preview: { texture: 'weaver', glow: 'weaver_e', idle: 'weaver_idle_down', chosen: 'weaver_weave_down', originY: PUPPETEER_ORIGIN_Y / PUPPETEER_H },
        buttons: {
          attack: { texture: 'icon_thread' },
          special: { texture: 'icon_marionette' },
        },
        lookName: 'Silk',
        skins: [
          {
            id: 'crimson',
            name: 'Red thread',
            role: 'Threads of fate',
            accent: 0xff4a5a,
            attack: 'Fate thread',
            special: 'Bound by fate',
            preview: { texture: 'weaver_crimson', glow: 'weaver_crimson_e', idle: 'weaver_crimson_idle_down', chosen: 'weaver_crimson_weave_down', originY: PUPPETEER_ORIGIN_Y / PUPPETEER_H },
            buttons: {
              attack: { texture: 'icon_thread_crimson' },
              special: { texture: 'icon_marionette_crimson' },
            },
          },
        ],
      },
    ],
    spawn(world, x, y, look) {
      const kit = look === 'porcelain' ? PORCELAIN_KIT : look === 'weaver' ? WEAVER_KIT : look === 'crimson' ? CRIMSON_KIT : MARIONETTE_KIT;
      return new Puppeteer(world, x, y, kit);
    },
  },
];

export const classById = (id: string | undefined): ClassDef => CLASSES.find((c) => c.id === id) ?? CLASSES[0];

/** The class as played in its chosen type and skin. */
export function characterById(id: string | undefined): CharacterDef {
  return worn(classById(id));
}
