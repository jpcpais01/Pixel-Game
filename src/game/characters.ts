// Playable characters, in four levels:
//  - a class (the Mage) is what the select screen lists (CLASSES), gathering
//    the characters of one or more kits;
//  - a kit (the Wizard) is a Hero class with its own art and spawn, shared by
//    its characters; its id keys stats, Specials, skins owned and the rest;
//  - a type, called a character on screen (the Pyromancer), is a way to play
//    a kit, with its own stats and abilities;
//  - a skin (Void) belongs to a type and changes only its looks.
// A kit's spawn gets a look id: a type's own id for its base look, or one of
// its skins' ids. Ids are unique within a kit, so the kit and the look id
// together say both the type and the skin (and old saves, which stored one
// look id per kit, still load).

import type Phaser from 'phaser';
import type { WorldScene } from '../scenes/WorldScene';
import { ARCANE_SKIN, ASTRAL_SKIN, VOID_SKIN, Wizard } from './Wizard';
import { EMBER_FIRE, HELL_FIRE, HELL_SKIN, PUMPKIN_FIRE, PUMPKIN_SKIN, PYRO_SKIN, Pyromancy } from './Pyro';
import { ABYSS_MAGIC, ABYSS_SKIN, TIDE_MAGIC, TIDE_SKIN, Tidecraft } from './Tide';
import { LOTUS_MAGIC, LOTUS_SKIN } from './Tide';
import { HEADLESS_SKIN, JADE_SKIN, KNIGHT_SKIN, SPARTAN_SKIN, Warrior } from './Warrior';
import { AFONSO_KIT, King, KING_KIT } from './King';
import { WARRIOR_H, WARRIOR_ORIGIN_Y } from '../art/warrior';
import { CRUSADER_KIT, HOLY_KIT, OATH_KIT, Paladin, SERAPH_KIT } from './Paladin';
import { PALADIN_H, PALADIN_ORIGIN_Y } from '../art/paladin';
import { GUARD_STYLE, Jedi, JEDI_STYLE, MASTER_STYLE } from './Jedi';
import { Sith, SITH_KIT, WARLORD_KIT } from './Sith';
import { JEDI_H, JEDI_ORIGIN_Y } from '../art/jedi';
import { DUNE_KIT, Twin, TWIN_KIT } from './Twin';
import { TWIN_H, TWIN_ORIGIN_Y } from '../art/twin';
import { BRAWLER_STYLE, CHAMP_STYLE, Fighter, GUARDIAN_STYLE, LUCHA_STYLE, MONK_STYLE } from './Fighter';
import { FIGHTER_H, FIGHTER_ORIGIN_Y } from '../art/fighter';
import { Alchemist, CHEM_STYLE, CRYO_STYLE, FOXGLOVE_STYLE, PLAGUE_STYLE, SHAMAN_STYLE, WITCH_STYLE } from './Alchemist';
import { ALCH_H, ALCH_ORIGIN_Y } from '../art/alchemist';
import { Archer, HUNT_STYLE, RANGER_STYLE, SCARECROW_STYLE, STORM_STYLE } from './Archer';
import { Arbalest, BRIAR_STYLE } from './Arbalest';
import { Windrunner, WISTERIA_STYLE } from './Windrunner';
import { ARCHER_H, ARCHER_ORIGIN_Y } from '../art/archer';
import { CORSAIR_STYLE, DANCER_STYLE, KITSUNE_STYLE, NIGHTBLOOM_STYLE, Rogue, ROGUE_STYLE } from './Rogue';
import { ROGUE_H, ROGUE_ORIGIN_Y } from '../art/rogue';
import { BLOOD_KIT, NECRO_KIT, Necromancer, TOMB_KIT, WYRM_KIT } from './Necromancer';
import { NECRO_H, NECRO_ORIGIN_Y } from '../art/necromancer';
import { Bard, DRUMMER_KIT, FADISTA_KIT, HARLEQUIN_KIT, HOWL_KIT, MINSTREL_KIT, ORPHEUS_KIT, VAGABOND_KIT, WILD_KIT } from './Bard';
import { BARD_H, BARD_ORIGIN_Y } from '../art/bard';
import { AEON_KIT, ANOMALY_KIT, CLOCKWORK_KIT, Chrono, KEEPER_KIT, MOON_KIT, PARADOX_KIT, PRIMAVERA_KIT } from './Chrono';
import { CHRONO_H, CHRONO_ORIGIN_Y } from '../art/chrono';
import { BLADEWIND_KIT, KITSUNE_KIT, ONI_KIT, RONIN_KIT, SAKURA_KIT, Samurai, SHOGUN_KIT } from './Samurai';
import { SAMURAI_H, SAMURAI_ORIGIN_Y } from '../art/samurai';
import { AUTUMN_MAGIC, AUTUMN_SKIN, FROST_MAGIC, FROST_SKIN, GROVE_MAGIC, GROVE_SKIN, Grovecraft, WILD_MAGIC, WILD_SKIN, Wildcraft } from './Druid';
import { TITANIA_MAGIC, TITANIA_SKIN } from './Druid';
import { RAVEN_KIT, SPEAR_KIT, STORM_KIT, SUN_KIT, SWAN_KIT, Valkyrie } from './Valkyrie';
import { MECH_KIT, Mech, SCRAP_KIT } from './Mech';
import { HIVE_KIT, SYNTH_KIT, Synth } from './Synth';
import { MECH_H, MECH_ORIGIN_Y } from '../art/mech';
import { SYNTH_H, SYNTH_ORIGIN_Y } from '../art/synth';
import { POLTER_KIT, Poltergeist, TEA_KIT } from './Poltergeist';
import { CALA_KIT, FIREFLY_KIT, WRAITH_KIT, Wraith } from './Wraith';
import { POLTER_H, POLTER_ORIGIN_Y } from '../art/poltergeist';
import { WRAITH_H, WRAITH_ORIGIN_Y } from '../art/wraith';
import { ENGINEER_KIT, Engineer } from './Engineer';
import { EINSTEIN_KIT, SCIENTIST_KIT, Scientist } from './Scientist';
import { INV_H, INV_ORIGIN_Y } from '../art/inventor';
import { BENFICA_KIT, EAGLE_KIT, Eagle } from './Eagle';
import { LION_KIT, Lion, SPORTING_KIT } from './Lion';
import { DRAGON_KIT, Dragon, PORTO_KIT } from './Dragon';
import { BEAST_H, BEAST_ORIGIN_Y } from '../art/beast';
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
  /** A blow is about to land: returning true, the hero slips through it unharmed (a ghost's phasing). */
  dodge?(): boolean;
  /** The Special has thrown the hero's weapon (true) or it has come back (false): drawn empty-handed and unable to strike meanwhile. */
  holdSaber?(away: boolean): void;
}

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
  /**
   * The highlight colour while worn. A skin is only a look: the character's
   * name, tagline, ability names and Special always stay the character's own.
   */
  accent?: number;
  preview: Preview;
  buttons: Buttons;
  /**
   * A seasonal skin (a season's id, see game/season.ts): bought with that
   * season's currency at its stall while the season runs, never wished for.
   * Once owned it stays for good.
   */
  season?: string;
}

/** A type: a way to play a class, with its own stats and abilities, and its own skins. */
export interface TypeDef {
  id: string;
  name: string;
  /** A few words about how it plays, e.g. "Fire and fury". */
  role: string;
  /** Highlight colour. */
  accent: number;
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

/**
 * A kit: the heroes that share one Hero class, its art and its spawn (the
 * Wizard's Arcanist, Pyromancer and Tidecaller). Its id keys everything
 * about how they play: stats, Specials, skins owned, Auto Battle pieces,
 * Rift bests. Kits were the classes until the classes were regrouped; the
 * select screen now shows CLASSES, each gathering the characters of one or
 * more kits.
 */
export interface KitDef {
  id: string;
  name: string;
  /** One line about the kit as a whole. */
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

/** A class as the select screen shows it: characters gathered from one or more kits. */
export interface ClassDef {
  id: string;
  name: string;
  /** One line about the class as a whole. */
  blurb: string;
  /** Every kit's characters, in order; the first is where the class opens. */
  types: TypeDef[];
}

/** A class as played: in one type and skin, with everything the HUD and the world need. */
export interface CharacterDef {
  /** The kit's id (see KitDef): what stats, Specials and skins are keyed by. */
  id: string;
  /** The class's name. */
  name: string;
  type: TypeDef;
  /** The worn skin, or null for the type's own look. */
  skin: SkinDef | null;
  /** The worn look's id (the type's id or the skin's). */
  look: string;
  role: string;
  accent: number;
  attack: string;
  special: string;
  preview: Preview;
  buttons: Buttons;
  chargeSpecial?: boolean;
  spawn(world: WorldScene, x: number, y: number): Hero;
}

const KITS: KitDef[] = [
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
            accent: 0xc47cff,
            preview: { texture: 'wizard_void', glow: 'wizard_void_e', idle: 'wizard_void_idle_down', chosen: 'wizard_void_cast_down' },
            buttons: {
              attack: { texture: 'orb_void_e', frame: 'o0', anim: 'orb_void_spin' },
              special: { texture: 'icon_beam_void' },
            },
          },
          {
            // A reader of the stars: silver hair under a gold circlet, a crown of stars, a robe strewn with them.
            id: 'astral',
            name: 'Astral',
            accent: 0xffe08a,
            preview: { texture: 'wizard_astral', glow: 'wizard_astral_e', idle: 'wizard_astral_idle_down', chosen: 'wizard_astral_cast_down' },
            buttons: {
              attack: { texture: 'orb_astral_e', frame: 'o0', anim: 'orb_astral_spin' },
              special: { texture: 'icon_beam_astral' },
            },
          },
        ],
      },
      {
        id: 'pyro',
        name: 'Pyromancer',
        role: 'Fire and fury',
        accent: 0xff8a30,
        attack: 'Fireball',
        special: 'Meteor',
        preview: { texture: 'wizard_pyro', glow: 'wizard_pyro_e', idle: 'wizard_pyro_idle_down', chosen: 'wizard_pyro_cast_down' },
        buttons: {
          attack: { texture: 'orb_pyro_e', frame: 'o0', anim: 'orb_pyro_spin' },
          special: { texture: 'icon_meteor' },
        },
        lookName: 'Ember',
        skins: [
          {
            // A horned, crimson-skinned warlock in black and blood red, burning with green hellfire.
            id: 'hellfire',
            name: 'Hellfire',
            accent: 0x7aff5a,
            preview: { texture: 'wizard_hell', glow: 'wizard_hell_e', idle: 'wizard_hell_idle_down', chosen: 'wizard_hell_cast_down' },
            buttons: {
              attack: { texture: 'orb_hell_e', frame: 'o0', anim: 'orb_hell_spin' },
              special: { texture: 'icon_meteor_hell' },
            },
          },
          {
            // Hallow's Eve: a witch under a crooked hat, flame-orange hair, a pale green face with glowing eyes, and a staff crowned with a carved jack-o'-lantern.
            id: 'pumpkin',
            name: 'Pumpkin Witch',
            accent: 0xff8a24,
            preview: { texture: 'wizard_pumpkin', glow: 'wizard_pumpkin_e', idle: 'wizard_pumpkin_idle_down', chosen: 'wizard_pumpkin_cast_down' },
            buttons: {
              attack: { texture: 'orb_pumpkin_e', frame: 'o0', anim: 'orb_pumpkin_spin' },
              special: { texture: 'icon_meteor_pumpkin' },
            },
            season: 'hallows',
          },
        ],
      },
      {
        // A sea sorceress: bolts that splash foes back, and a charged tidal wave that carries them away.
        id: 'tide',
        name: 'Tidecaller',
        role: 'Waves and currents',
        accent: 0x4ad8f0,
        attack: 'Water bolt',
        special: 'Tidal wave',
        preview: { texture: 'wizard_tide', glow: 'wizard_tide_e', idle: 'wizard_tide_idle_down', chosen: 'wizard_tide_cast_down' },
        buttons: {
          attack: { texture: 'orb_tide_e', frame: 'o0', anim: 'orb_tide_spin' },
          special: { texture: 'icon_wave' },
        },
        lookName: 'Coral',
        skins: [
          {
            // A witch of the trench: black robes lit with living light, pale skin, and an anglerfish's lure over her brow.
            id: 'abyssal',
            name: 'Abyssal',
            accent: 0x3ae0d0,
            preview: { texture: 'wizard_abyss', glow: 'wizard_abyss_e', idle: 'wizard_abyss_idle_down', chosen: 'wizard_abyss_cast_down' },
            buttons: {
              attack: { texture: 'orb_abyss_e', frame: 'o0', anim: 'orb_abyss_spin' },
              special: { texture: 'icon_wave_abyss' },
            },
          },
          {
            // A water-lily priestess: ink-black hair in a high bun with a lotus, jade robes over white silk, lily-pad shoulders, and a lotus staff cradling a pearl.
            id: 'lotus',
            name: 'Lotus',
            accent: 0xff9ec8,
            preview: { texture: 'wizard_lotus', glow: 'wizard_lotus_e', idle: 'wizard_lotus_idle_down', chosen: 'wizard_lotus_cast_down' },
            buttons: {
              attack: { texture: 'orb_lotus_e', frame: 'o0', anim: 'orb_lotus_spin' },
              special: { texture: 'icon_wave_lotus' },
            },
          },
        ],
      },
    ],
    spawn(world, x, y, look) {
      if (look === 'pyro' || look === 'hellfire' || look === 'pumpkin') {
        // Fireballs that blast and burn; a charged meteor called down where it's aimed.
        const hell = look === 'hellfire';
        const pumpkin = look === 'pumpkin';
        const fire = new Pyromancy(world, pumpkin ? PUMPKIN_FIRE : hell ? HELL_FIRE : EMBER_FIRE);
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
          pumpkin ? PUMPKIN_SKIN : hell ? HELL_SKIN : PYRO_SKIN,
        );
        fire.caster = w;
        world.addEffect(fire);
        return w;
      }
      if (look === 'tide' || look === 'abyssal' || look === 'lotus') {
        // Bolts that splash and throw back; a charged tidal wave that rolls out and carries foes away.
        const abyss = look === 'abyssal';
        const lotus = look === 'lotus';
        const craft = new Tidecraft(world, lotus ? LOTUS_MAGIC : abyss ? ABYSS_MAGIC : TIDE_MAGIC);
        const w = new Wizard(
          world,
          x,
          y,
          {
            cast: (x, y, dx, dy) => craft.bolt(x, y, dx, dy),
            beam: (_x, _y, dx, dy, power) => craft.wave(dx, dy, power),
          },
          lotus ? LOTUS_SKIN : abyss ? ABYSS_SKIN : TIDE_SKIN,
        );
        craft.caster = w;
        world.addEffect(craft);
        return w;
      }
      const skin = look === 'void' ? VOID_SKIN : look === 'astral' ? ASTRAL_SKIN : ARCANE_SKIN;
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
            accent: 0x4fe0a0,
            preview: { texture: 'warrior_jade', glow: 'warrior_jade_e', idle: 'warrior_jade_idle_down', chosen: 'warrior_jade_thrust_down', originY: WARRIOR_ORIGIN_Y / WARRIOR_H },
            buttons: {
              attack: { texture: 'icon_sword_jade' },
              special: { texture: 'icon_whirl_jade' },
            },
          },
          {
            // Bronze and crimson: a crested Corinthian helm, a round shield and a leaf-bladed sword.
            id: 'spartan',
            name: 'Spartan',
            accent: 0xf0a050,
            preview: { texture: 'warrior_spartan', glow: 'warrior_spartan_e', idle: 'warrior_spartan_idle_down', chosen: 'warrior_spartan_thrust_down', originY: WARRIOR_ORIGIN_Y / WARRIOR_H },
            buttons: {
              attack: { texture: 'icon_sword_spartan' },
              special: { texture: 'icon_whirl_spartan' },
            },
          },
          {
            // Hallow's Eve: blackened, rusting plate, a tattered cloak, and a jack-o'-lantern burning where his head should be.
            id: 'headless',
            name: 'Headless Knight',
            accent: 0xff8a2a,
            preview: { texture: 'warrior_headless', glow: 'warrior_headless_e', idle: 'warrior_headless_idle_down', chosen: 'warrior_headless_thrust_down', originY: WARRIOR_ORIGIN_Y / WARRIOR_H },
            buttons: {
              attack: { texture: 'icon_sword_headless' },
              special: { texture: 'icon_whirl_headless' },
            },
            season: 'hallows',
          },
        ],
      },
      {
        // A crowned king with an ermine mantle and a greatsword: heavy chops, and a decree that brings his foes to their knees.
        id: 'king',
        name: 'King',
        role: 'Crown and greatsword',
        accent: 0xffcf5a,
        attack: 'Royal blade',
        special: 'Royal decree',
        preview: { texture: 'warrior_king', glow: 'warrior_king_e', idle: 'warrior_king_idle_down', chosen: 'warrior_king_decree_down', originY: WARRIOR_ORIGIN_Y / WARRIOR_H },
        buttons: {
          attack: { texture: 'icon_sword_king' },
          special: { texture: 'icon_decree' },
        },
        lookName: 'Regal',
        skins: [
          {
            // The first king of Portugal as his statue in Guimarães stands: a crowned conical helm, mail, a long beard, the blue cross on white.
            id: 'afonso',
            name: 'Afonso Henriques',
            accent: 0x5a8aff,
            preview: { texture: 'warrior_afonso', glow: 'warrior_afonso_e', idle: 'warrior_afonso_idle_down', chosen: 'warrior_afonso_decree_down', originY: WARRIOR_ORIGIN_Y / WARRIOR_H },
            buttons: {
              attack: { texture: 'icon_sword_afonso' },
              special: { texture: 'icon_decree_afonso' },
            },
          },
        ],
      },
    ],
    spawn(world, x, y, look) {
      if (look === 'king' || look === 'afonso') return new King(world, x, y, look === 'afonso' ? AFONSO_KIT : KING_KIT);
      return new Warrior(world, x, y, look === 'jade' ? JADE_SKIN : look === 'spartan' ? SPARTAN_SKIN : look === 'headless' ? HEADLESS_SKIN : KNIGHT_SKIN);
    },
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
        attack: 'Smite',
        special: 'Consecration',
        preview: { texture: 'paladin', glow: 'paladin_e', idle: 'paladin_idle_down', chosen: 'paladin_consecrate_down', originY: PALADIN_ORIGIN_Y / PALADIN_H },
        buttons: {
          attack: { texture: 'icon_mace' },
          special: { texture: 'icon_sanctuary' },
        },
        lookName: 'Holy',
        skins: [
          {
            // A winged guardian in pearl plate, a halo over golden hair, light the colour of dawn.
            id: 'seraph',
            name: 'Seraph',
            accent: 0xffc8a8,
            preview: { texture: 'paladin_seraph', glow: 'paladin_seraph_e', idle: 'paladin_seraph_idle_down', chosen: 'paladin_seraph_consecrate_down', originY: PALADIN_ORIGIN_Y / PALADIN_H },
            buttons: {
              attack: { texture: 'icon_mace_seraph' },
              special: { texture: 'icon_sanctuary_seraph' },
            },
          },
        ],
      },
      {
        // Harder, slower hammer blows and a burst of sunfire instead of healing ground.
        id: 'crusader',
        name: 'Crusader',
        role: 'Hammer and sunfire',
        accent: 0xff8a3a,
        attack: 'Sunhammer',
        special: 'Sunfall',
        preview: { texture: 'paladin_crusader', glow: 'paladin_crusader_e', idle: 'paladin_crusader_idle_down', chosen: 'paladin_crusader_consecrate_down', originY: PALADIN_ORIGIN_Y / PALADIN_H },
        buttons: {
          attack: { texture: 'icon_hammer' },
          special: { texture: 'icon_sunfall' },
        },
        lookName: 'Sunforged',
        skins: [
          {
            // A fallen crusader: horned helm, spiked black-violet plate, a torn cloak and an eclipse for a sun.
            id: 'oathbreaker',
            name: 'Oathbreaker',
            accent: 0xb070ff,
            preview: { texture: 'paladin_oath', glow: 'paladin_oath_e', idle: 'paladin_oath_idle_down', chosen: 'paladin_oath_consecrate_down', originY: PALADIN_ORIGIN_Y / PALADIN_H },
            buttons: {
              attack: { texture: 'icon_hammer_oath' },
              special: { texture: 'icon_sunfall_oath' },
            },
          },
        ],
      },
    ],
    spawn(world, x, y, look) {
      const kit = { holy: HOLY_KIT, seraph: SERAPH_KIT, crusader: CRUSADER_KIT, oathbreaker: OATH_KIT }[look] ?? HOLY_KIT;
      return new Paladin(world, x, y, kit);
    },
  },
  {
    id: 'jedi',
    name: 'Jedi',
    blurb: 'The light and the dark',
    types: [
      {
        id: 'knight',
        name: 'Jedi knight',
        role: 'Saber and Force',
        accent: 0x5fb4ff,
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
            // A masked sentinel of the temple in cream and gold, with a long-hilted golden saber.
            id: 'guard',
            name: 'Temple guard',
            accent: 0xffd04a,
            preview: { texture: 'jedi_guard', glow: 'jedi_guard_e', idle: 'jedi_guard_idle_down', chosen: 'jedi_guard_push_down', originY: JEDI_ORIGIN_Y / JEDI_H },
            buttons: {
              attack: { texture: 'icon_saber_guard' },
              special: { texture: 'icon_force_guard' },
            },
          },
          {
            // An old master of the order: white hair and a long white beard, indigo robes edged in silver, a green blade.
            id: 'master',
            name: 'Grand Master',
            accent: 0x4ae070,
            preview: { texture: 'jedi_master', glow: 'jedi_master_e', idle: 'jedi_master_idle_down', chosen: 'jedi_master_push_down', originY: JEDI_ORIGIN_Y / JEDI_H },
            buttons: {
              attack: { texture: 'icon_saber_master' },
              special: { texture: 'icon_force_master' },
            },
          },
        ],
      },
      {
        // The dark side: a saberstaff that cuts both ways, Force lightning, and a grip that crushes.
        id: 'sith',
        name: 'Sith',
        role: 'The dark side',
        accent: 0xff4a4a,
        attack: 'Saberstaff',
        special: 'Force lightning',
        preview: { texture: 'jedi_sith', glow: 'jedi_sith_e', idle: 'jedi_sith_idle_down', chosen: 'jedi_sith_grip_down', originY: JEDI_ORIGIN_Y / JEDI_H },
        buttons: {
          attack: { texture: 'icon_staff' },
          special: { texture: 'icon_lightning' },
        },
        lookName: 'Hooded',
        skins: [
          {
            // A horned, tattooed reaver in black and old blood, with an ember-red saberstaff.
            id: 'warlord',
            name: 'Warlord',
            accent: 0xff5a2a,
            preview: { texture: 'jedi_warlord', glow: 'jedi_warlord_e', idle: 'jedi_warlord_idle_down', chosen: 'jedi_warlord_grip_down', originY: JEDI_ORIGIN_Y / JEDI_H },
            buttons: {
              attack: { texture: 'icon_staff_warlord' },
              special: { texture: 'icon_lightning_warlord' },
            },
          },
        ],
      },
      {
        // A Jar'Kai duelist, a saber in each hand: a four-cut flurry ending in an X, a parry that answers, a storm of blinks.
        id: 'twin',
        name: 'Twin Blade',
        role: 'Two sabers, no openings',
        accent: 0x3ee6ff,
        attack: 'Twin flurry',
        special: 'Riposte',
        preview: { texture: 'jedi_twin', glow: 'jedi_twin_e', idle: 'jedi_twin_idle_down', chosen: 'jedi_twin_draw_down', originY: TWIN_ORIGIN_Y / TWIN_H },
        buttons: {
          attack: { texture: 'icon_twin' },
          special: { texture: 'icon_riposte' },
        },
        lookName: 'Duelist',
        skins: [
          {
            // A desert nomad: sand wraps, an indigo face scarf, goggles on the headwrap, a sun-bleached cloak, bronze hilts, amber and violet blades.
            id: 'dune',
            name: 'Dune Wanderer',
            accent: 0xffb040,
            preview: { texture: 'jedi_dune', glow: 'jedi_dune_e', idle: 'jedi_dune_idle_down', chosen: 'jedi_dune_draw_down', originY: TWIN_ORIGIN_Y / TWIN_H },
            buttons: {
              attack: { texture: 'icon_twin_dune' },
              special: { texture: 'icon_riposte_dune' },
            },
          },
        ],
      },
    ],
    spawn(world, x, y, look) {
      if (look === 'sith' || look === 'warlord') return new Sith(world, x, y, look === 'warlord' ? WARLORD_KIT : SITH_KIT);
      if (look === 'twin' || look === 'dune') return new Twin(world, x, y, look === 'dune' ? DUNE_KIT : TWIN_KIT);
      return new Jedi(world, x, y, look === 'guard' ? GUARD_STYLE : look === 'master' ? MASTER_STYLE : JEDI_STYLE);
    },
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
        attack: 'Five-hit combo',
        special: 'Barrage',
        preview: { texture: 'fighter', glow: 'fighter_e', idle: 'fighter_idle_down', chosen: 'fighter_smash_down', originY: FIGHTER_ORIGIN_Y / FIGHTER_H },
        buttons: {
          attack: { texture: 'icon_fist' },
          special: { texture: 'icon_barrage' },
        },
        lookName: 'Street',
        skins: [
          {
            // A masked showman of the ring: a crimson cape, a gold title belt and boots to the knee.
            id: 'lucha',
            name: 'Luchador',
            accent: 0xff4fa0,
            preview: { texture: 'fighter_lucha', glow: 'fighter_lucha_e', idle: 'fighter_lucha_idle_down', chosen: 'fighter_lucha_smash_down', originY: FIGHTER_ORIGIN_Y / FIGHTER_H },
            buttons: {
              attack: { texture: 'icon_fist_lucha' },
              special: { texture: 'icon_barrage_lucha' },
            },
          },
          {
            // A ring hero off the merch stand: a lime tee and cap, jorts, sweatbands and dog tags. Never gives up.
            id: 'champ',
            name: 'Champ',
            accent: 0x7ae84a,
            preview: { texture: 'fighter_champ', glow: 'fighter_champ_e', idle: 'fighter_champ_idle_down', chosen: 'fighter_champ_smash_down', originY: FIGHTER_ORIGIN_Y / FIGHTER_H },
            buttons: {
              attack: { texture: 'icon_fist_champ' },
              special: { texture: 'icon_barrage_champ' },
            },
          },
        ],
      },
      {
        id: 'monk',
        name: 'Iron monk',
        role: 'Palms of stone',
        accent: 0xf0a63a,
        attack: 'Iron palm',
        special: 'Earthshaker',
        preview: { texture: 'fighter_monk', glow: 'fighter_monk_e', idle: 'fighter_monk_idle_down', chosen: 'fighter_monk_leap_down', originY: FIGHTER_ORIGIN_Y / FIGHTER_H },
        buttons: {
          attack: { texture: 'icon_palm' },
          special: { texture: 'icon_quake' },
        },
        lookName: 'Temple',
        skins: [
          {
            // A temple statue woken to fight: basalt cracked with fire, and a carved ring at its back.
            id: 'guardian',
            name: 'Stone guardian',
            accent: 0xff7a2a,
            preview: { texture: 'fighter_guardian', glow: 'fighter_guardian_e', idle: 'fighter_guardian_idle_down', chosen: 'fighter_guardian_leap_down', originY: FIGHTER_ORIGIN_Y / FIGHTER_H },
            buttons: {
              attack: { texture: 'icon_palm_guardian' },
              special: { texture: 'icon_quake_guardian' },
            },
          },
        ],
      },
    ],
    spawn: (world, x, y, look) =>
      new Fighter(world, x, y, look === 'monk' ? MONK_STYLE : look === 'guardian' ? GUARDIAN_STYLE : look === 'lucha' ? LUCHA_STYLE : look === 'champ' ? CHAMP_STYLE : BRAWLER_STYLE),
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
            accent: 0xe060ff,
            preview: { texture: 'alchemist_witch', glow: 'alchemist_witch_e', idle: 'alchemist_witch_idle_down', chosen: 'alchemist_witch_brew_down', originY: ALCH_ORIGIN_Y / ALCH_H },
            buttons: {
              attack: { texture: 'icon_flask_witch' },
              special: { texture: 'icon_bog_witch' },
            },
          },
          {
            // A ram's skull for a mask, a crown of raven feathers, and gourds of spirit-fire.
            id: 'shaman',
            name: 'Bone shaman',
            accent: 0x2ad8a8,
            preview: { texture: 'alchemist_shaman', glow: 'alchemist_shaman_e', idle: 'alchemist_shaman_idle_down', chosen: 'alchemist_shaman_brew_down', originY: ALCH_ORIGIN_Y / ALCH_H },
            buttons: {
              attack: { texture: 'icon_flask_shaman' },
              special: { texture: 'icon_bog_shaman' },
            },
          },
          {
            // A hedge-witch herbalist: a straw hat with foxgloves, a chestnut braid, a sage dress and apron, tinctures of violet and pink.
            id: 'foxglove',
            name: 'Foxglove',
            accent: 0xf07ad0,
            preview: { texture: 'alchemist_foxglove', glow: 'alchemist_foxglove_e', idle: 'alchemist_foxglove_idle_down', chosen: 'alchemist_foxglove_brew_down', originY: ALCH_ORIGIN_Y / ALCH_H },
            buttons: {
              attack: { texture: 'icon_flask_foxglove' },
              special: { texture: 'icon_bog_foxglove' },
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
        attack: 'Chem canister',
        special: 'Chem barrage',
        preview: { texture: 'alchemist_chem', glow: 'alchemist_chem_e', idle: 'alchemist_chem_idle_down', chosen: 'alchemist_chem_brew_down', originY: ALCH_ORIGIN_Y / ALCH_H },
        buttons: {
          attack: { texture: 'icon_flask_chem' },
          special: { texture: 'icon_bog_chem' },
        },
        lookName: 'Hazmat',
        skins: [
          {
            // A bubble helmet, an insulated suit and canisters that freeze.
            id: 'cryo',
            name: 'Cryotech',
            accent: 0x6ab8ff,
            preview: { texture: 'alchemist_cryo', glow: 'alchemist_cryo_e', idle: 'alchemist_cryo_idle_down', chosen: 'alchemist_cryo_brew_down', originY: ALCH_ORIGIN_Y / ALCH_H },
            buttons: {
              attack: { texture: 'icon_flask_cryo' },
              special: { texture: 'icon_bog_cryo' },
            },
          },
        ],
      },
    ],
    spawn: (world, x, y, look) =>
      new Alchemist(world, x, y, look === 'chem' ? CHEM_STYLE : look === 'cryo' ? CRYO_STYLE : look === 'witch' ? WITCH_STYLE : look === 'shaman' ? SHAMAN_STYLE : look === 'foxglove' ? FOXGLOVE_STYLE : PLAGUE_STYLE),
  },
  {
    id: 'archer',
    name: 'Archer',
    blurb: 'Death from afar',
    types: [
      {
        id: 'ranger',
        name: 'Archer',
        role: 'Bow and arrow',
        accent: 0x9ad65a,
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
            accent: 0x5ec8ff,
            preview: { texture: 'archer_storm', glow: 'archer_storm_e', idle: 'archer_storm_idle_down', chosen: 'archer_storm_volley_down', originY: ARCHER_ORIGIN_Y / ARCHER_H },
            buttons: {
              attack: { texture: 'icon_bow_storm' },
              special: { texture: 'icon_rain_storm' },
            },
          },
          {
            // A stag's skull and antlers for a hood, a bow of bone, and arrows of moonlight.
            id: 'hunt',
            name: 'Wild hunt',
            accent: 0xb8a0ff,
            preview: { texture: 'archer_hunt', glow: 'archer_hunt_e', idle: 'archer_hunt_idle_down', chosen: 'archer_hunt_volley_down', originY: ARCHER_ORIGIN_Y / ARCHER_H },
            buttons: {
              attack: { texture: 'icon_bow_hunt' },
              special: { texture: 'icon_rain_hunt' },
            },
          },
          {
            // Hallow's Eve: a burlap sack head with embers for eyes, a crow on his hat, ember arrows trailing ghost-light.
            id: 'scarecrow',
            name: 'Scarecrow',
            accent: 0xff8a2a,
            preview: { texture: 'archer_scarecrow', glow: 'archer_scarecrow_e', idle: 'archer_scarecrow_idle_down', chosen: 'archer_scarecrow_volley_down', originY: ARCHER_ORIGIN_Y / ARCHER_H },
            buttons: {
              attack: { texture: 'icon_bow_scarecrow' },
              special: { texture: 'icon_rain_scarecrow' },
            },
            season: 'hallows',
          },
        ],
      },
      {
        // A bearded crossbowman in a kettle hat and brigandine, a painted pavise on his back.
        id: 'arbalest',
        name: 'Arbalest',
        role: 'Heavy crossbow',
        accent: 0xd8483c,
        attack: 'Heavy bolt',
        special: 'Net bolt',
        preview: { texture: 'archer_arbalest', glow: 'archer_arbalest_e', idle: 'archer_arbalest_idle_down', chosen: 'archer_arbalest_brace_down', originY: ARCHER_ORIGIN_Y / ARCHER_H },
        buttons: {
          attack: { texture: 'icon_crossbow' },
          special: { texture: 'icon_netbolt' },
        },
        lookName: 'Steel',
        skins: [
          {
            // A lady huntress: a rose-red hooded capelet, green velvet gown, a rose at her throat, a thornwood crossbow.
            id: 'briar',
            name: 'Briar Rose',
            accent: 0xe8344a,
            preview: { texture: 'archer_briar', glow: 'archer_briar_e', idle: 'archer_briar_idle_down', chosen: 'archer_briar_brace_down', originY: ARCHER_ORIGIN_Y / ARCHER_H },
            buttons: {
              attack: { texture: 'icon_crossbow_briar' },
              special: { texture: 'icon_netbolt_briar' },
            },
          },
        ],
      },
      {
        // A light elven skirmisher in dusk-blue silk, a long scarf streaming, a silverwood bow.
        id: 'wind',
        name: 'Windrunner',
        role: 'Elven skirmisher',
        accent: 0x6ef0dc,
        attack: 'Gale fan',
        special: 'Wind vault',
        preview: { texture: 'archer_wind', glow: 'archer_wind_e', idle: 'archer_wind_idle_down', chosen: 'archer_wind_fan_down', originY: ARCHER_ORIGIN_Y / ARCHER_H },
        buttons: {
          attack: { texture: 'icon_fanshot' },
          special: { texture: 'icon_vault' },
        },
        lookName: 'Gale',
        skins: [
          {
            // An elven maiden: a lilac braid woven with wisteria, a silver leaf circlet, a leaf-hemmed gown, a birch bow wound with vine.
            id: 'wisteria',
            name: 'Wisteria',
            accent: 0xb48ae8,
            preview: { texture: 'archer_wisteria', glow: 'archer_wisteria_e', idle: 'archer_wisteria_idle_down', chosen: 'archer_wisteria_fan_down', originY: ARCHER_ORIGIN_Y / ARCHER_H },
            buttons: {
              attack: { texture: 'icon_fanshot_wisteria' },
              special: { texture: 'icon_vault_wisteria' },
            },
          },
        ],
      },
    ],
    spawn: (world, x, y, look) =>
      look === 'arbalest' || look === 'briar'
        ? new Arbalest(world, x, y, look === 'briar' ? BRIAR_STYLE : undefined)
        : look === 'wind' || look === 'wisteria'
          ? new Windrunner(world, x, y, look === 'wisteria' ? WISTERIA_STYLE : undefined)
          : new Archer(world, x, y, look === 'storm' ? STORM_STYLE : look === 'hunt' ? HUNT_STYLE : look === 'scarecrow' ? SCARECROW_STYLE : RANGER_STYLE),
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
        attack: 'Bleeding stabs',
        special: 'Shadowstep',
        preview: { texture: 'rogue', glow: 'rogue_e', idle: 'rogue_idle_down', chosen: 'rogue_cross_down', originY: ROGUE_ORIGIN_Y / ROGUE_H },
        buttons: {
          attack: { texture: 'icon_daggers' },
          special: { texture: 'icon_shadowstep' },
        },
        lookName: 'Crimson',
        skins: [
          {
            // A captain of the high seas: tricorn, eyepatch, a navy coat and gold.
            id: 'corsair',
            name: 'Corsair',
            accent: 0xf0b040,
            preview: { texture: 'rogue_corsair', glow: 'rogue_corsair_e', idle: 'rogue_corsair_idle_down', chosen: 'rogue_corsair_cross_down', originY: ROGUE_ORIGIN_Y / ROGUE_H },
            buttons: {
              attack: { texture: 'icon_daggers_corsair' },
              special: { texture: 'icon_shadowstep_corsair' },
            },
          },
        ],
      },
      {
        // A lighter, wider four-cut chain ending in a spin, and a dance that
        // blinks from foe to foe instead of a dash.
        id: 'dancer',
        name: 'Shadow dancer',
        role: 'Blades in the dark',
        accent: 0xa878ff,
        attack: 'Shadow cuts',
        special: 'Shadow dance',
        preview: { texture: 'rogue_dancer', glow: 'rogue_dancer_e', idle: 'rogue_dancer_idle_down', chosen: 'rogue_dancer_cross_down', originY: ROGUE_ORIGIN_Y / ROGUE_H },
        buttons: {
          attack: { texture: 'icon_daggers_dancer' },
          special: { texture: 'icon_shadowstep_dancer' },
        },
        lookName: 'Dusk',
        skins: [
          {
            // A fox spirit: ears and a mask, three great tails and blades of blue foxfire.
            id: 'kitsune',
            name: 'Fox-mask thief',
            accent: 0x6ab0ff,
            preview: { texture: 'rogue_kitsune', glow: 'rogue_kitsune_e', idle: 'rogue_kitsune_idle_down', chosen: 'rogue_kitsune_cross_down', originY: ROGUE_ORIGIN_Y / ROGUE_H },
            buttons: {
              attack: { texture: 'icon_daggers_kitsune' },
              special: { texture: 'icon_shadowstep_kitsune' },
            },
          },
          {
            // A moonflower dancer: indigo silk veils and sashes, moonflowers in her hair, petal blades of moonsilver.
            id: 'nightbloom',
            name: 'Nightbloom',
            accent: 0xb8b0ff,
            preview: { texture: 'rogue_nightbloom', glow: 'rogue_nightbloom_e', idle: 'rogue_nightbloom_idle_down', chosen: 'rogue_nightbloom_cross_down', originY: ROGUE_ORIGIN_Y / ROGUE_H },
            buttons: {
              attack: { texture: 'icon_daggers_nightbloom' },
              special: { texture: 'icon_shadowstep_nightbloom' },
            },
          },
        ],
      },
    ],
    spawn: (world, x, y, look) =>
      new Rogue(world, x, y, look === 'dancer' ? DANCER_STYLE : look === 'kitsune' ? KITSUNE_STYLE : look === 'nightbloom' ? NIGHTBLOOM_STYLE : look === 'corsair' ? CORSAIR_STYLE : ROGUE_STYLE),
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
        attack: 'Soul bolt',
        special: 'Raise dead',
        preview: { texture: 'necro', glow: 'necro_e', idle: 'necro_idle_down', chosen: 'necro_raise_down', originY: NECRO_ORIGIN_Y / NECRO_H },
        buttons: {
          attack: { texture: 'icon_soul' },
          special: { texture: 'icon_raise' },
        },
        lookName: 'Grave',
        skins: [
          {
            // A pharaoh risen from his tomb: nemes and gold mask, a lapis ankh staff, mummies at his call.
            id: 'tomb',
            name: 'Tomb King',
            accent: 0x5aa8ff,
            preview: { texture: 'necro_tomb', glow: 'necro_tomb_e', idle: 'necro_tomb_idle_down', chosen: 'necro_tomb_raise_down', originY: NECRO_ORIGIN_Y / NECRO_H },
            buttons: {
              attack: { texture: 'icon_soul_tomb' },
              special: { texture: 'icon_raise_tomb' },
            },
          },
        ],
      },
      {
        // Tougher, with fast lances that pierce and heal, and a nova paid for
        // in his own blood instead of raising the dead.
        id: 'blood',
        name: 'Blood mage',
        role: 'Blood and sacrifice',
        accent: 0xff3a4a,
        attack: 'Blood lance',
        special: 'Crimson nova',
        preview: { texture: 'necro_blood', glow: 'necro_blood_e', idle: 'necro_blood_idle_down', chosen: 'necro_blood_raise_down', originY: NECRO_ORIGIN_Y / NECRO_H },
        buttons: {
          attack: { texture: 'icon_lance' },
          special: { texture: 'icon_nova' },
        },
        lookName: 'Sanguine',
        skins: [
          {
            // A dragon-blooded sorcerer: ivory horns, crimson wings, obsidian scales cracked with fire.
            id: 'wyrm',
            name: 'Wyrmblood',
            accent: 0xff7a2a,
            preview: { texture: 'necro_wyrm', glow: 'necro_wyrm_e', idle: 'necro_wyrm_idle_down', chosen: 'necro_wyrm_raise_down', originY: NECRO_ORIGIN_Y / NECRO_H },
            buttons: {
              attack: { texture: 'icon_lance_wyrm' },
              special: { texture: 'icon_nova_wyrm' },
            },
          },
        ],
      },
    ],
    spawn(world, x, y, look) {
      const kit = { necro: NECRO_KIT, tomb: TOMB_KIT, blood: BLOOD_KIT, wyrm: WYRM_KIT }[look] ?? NECRO_KIT;
      return new Necromancer(world, x, y, kit);
    },
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
            accent: 0x9ee85a,
            preview: { texture: 'bard_wild', glow: 'bard_wild_e', idle: 'bard_wild_idle_down', chosen: 'bard_wild_song_down', originY: BARD_ORIGIN_Y / BARD_H },
            buttons: {
              attack: { texture: 'icon_lute_wild' },
              special: { texture: 'icon_song_wild' },
            },
          },
          {
            // A masked jester in rose and black motley, bells on his cap, diamonds for notes.
            id: 'harlequin',
            name: 'Harlequin',
            accent: 0xff5ab8,
            preview: { texture: 'bard_harlequin', glow: 'bard_harlequin_e', idle: 'bard_harlequin_idle_down', chosen: 'bard_harlequin_song_down', originY: BARD_ORIGIN_Y / BARD_H },
            buttons: {
              attack: { texture: 'icon_lute_harlequin' },
              special: { texture: 'icon_song_harlequin' },
            },
          },
          {
            // A wanderer of the open road: wide felt hat, a patched duster, a bedroll, a banjo.
            id: 'vagabond',
            name: 'Vagabond',
            accent: 0xb890ff,
            preview: { texture: 'bard_vagabond', glow: 'bard_vagabond_e', idle: 'bard_vagabond_idle_down', chosen: 'bard_vagabond_song_down', originY: BARD_ORIGIN_Y / BARD_H },
            buttons: {
              attack: { texture: 'icon_lute_vagabond' },
              special: { texture: 'icon_song_vagabond' },
            },
          },
          {
            // A Coimbra fado singer in a long black cape, playing the Portuguese guitar; his notes fly as swallows.
            id: 'fadista',
            name: 'Fadista',
            accent: 0x5a8cff,
            preview: { texture: 'bard_fadista', glow: 'bard_fadista_e', idle: 'bard_fadista_idle_down', chosen: 'bard_fadista_song_down', originY: BARD_ORIGIN_Y / BARD_H },
            buttons: {
              attack: { texture: 'icon_lute_fadista' },
              special: { texture: 'icon_song_fadista' },
            },
          },
          {
            // The singer whose song moved the dead: laurel, a white chiton, a violet himation and a golden lyre.
            id: 'orpheus',
            name: 'Orpheus',
            accent: 0xffd060,
            preview: { texture: 'bard_orpheus', glow: 'bard_orpheus_e', idle: 'bard_orpheus_idle_down', chosen: 'bard_orpheus_song_down', originY: BARD_ORIGIN_Y / BARD_H },
            buttons: {
              attack: { texture: 'icon_lute_orpheus' },
              special: { texture: 'icon_song_orpheus' },
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
        attack: 'Drum blows',
        special: 'Battle rhythm',
        preview: { texture: 'bard_drum', glow: 'bard_drum_e', idle: 'bard_drum_idle_down', chosen: 'bard_drum_boom_down', originY: BARD_ORIGIN_Y / BARD_H },
        buttons: {
          attack: { texture: 'icon_drum' },
          special: { texture: 'icon_rhythm' },
        },
        lookName: 'Warband',
        skins: [
          {
            // A wolf-pelt shaman painted in woad, beating a black spirit drum for the pack.
            id: 'howl',
            name: 'Moonhowl',
            accent: 0x8a9aff,
            preview: { texture: 'bard_howl', glow: 'bard_howl_e', idle: 'bard_howl_idle_down', chosen: 'bard_howl_boom_down', originY: BARD_ORIGIN_Y / BARD_H },
            buttons: {
              attack: { texture: 'icon_drum_howl' },
              special: { texture: 'icon_rhythm_howl' },
            },
          },
        ],
      },
    ],
    spawn(world, x, y, look) {
      const kit = { minstrel: MINSTREL_KIT, wildsong: WILD_KIT, harlequin: HARLEQUIN_KIT, vagabond: VAGABOND_KIT, fadista: FADISTA_KIT, orpheus: ORPHEUS_KIT, drummer: DRUMMER_KIT, howl: HOWL_KIT }[look] ?? MINSTREL_KIT;
      return new Bard(world, x, y, kit);
    },
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
            accent: 0x9ccaff,
            preview: { texture: 'chrono_moon', glow: 'chrono_moon_e', idle: 'chrono_moon_idle_down', chosen: 'chrono_moon_field_down', originY: CHRONO_ORIGIN_Y / CHRONO_H },
            buttons: {
              attack: { texture: 'icon_hand_moon' },
              special: { texture: 'icon_stasis_moon' },
            },
          },
          {
            // A wind-up automaton: an alarm clock for a head, a pendulum swinging in a glass case, a key turning in his back.
            id: 'clockwork',
            name: 'Clockwork',
            accent: 0xa8f060,
            preview: { texture: 'chrono_clockwork', glow: 'chrono_clockwork_e', idle: 'chrono_clockwork_idle_down', chosen: 'chrono_clockwork_field_down', originY: CHRONO_ORIGIN_Y / CHRONO_H },
            buttons: {
              attack: { texture: 'icon_hand_clockwork' },
              special: { texture: 'icon_stasis_clockwork' },
            },
          },
          {
            // The spirit of spring: a crown of blossoms, rose-gold hair, a green gown embroidered with flowers, and a flower clock for her halo.
            id: 'primavera',
            name: 'Primavera',
            accent: 0xffb8cc,
            preview: { texture: 'chrono_primavera', glow: 'chrono_primavera_e', idle: 'chrono_primavera_idle_down', chosen: 'chrono_primavera_field_down', originY: CHRONO_ORIGIN_Y / CHRONO_H },
            buttons: {
              attack: { texture: 'icon_hand_primavera' },
              special: { texture: 'icon_stasis_primavera' },
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
            accent: 0x6ff0c0,
            preview: { texture: 'chrono_aeon', glow: 'chrono_aeon_e', idle: 'chrono_aeon_idle_down', chosen: 'chrono_aeon_rewind_down', originY: CHRONO_ORIGIN_Y / CHRONO_H },
            buttons: {
              attack: { texture: 'icon_shards_aeon' },
              special: { texture: 'icon_rewind_aeon' },
            },
          },
          {
            // A traveller from a future that went wrong: white coat, a black visor, a tesseract in hand, and the picture tearing round him.
            id: 'anomaly',
            name: 'Anomaly',
            accent: 0x40e0ff,
            preview: { texture: 'chrono_anomaly', glow: 'chrono_anomaly_e', idle: 'chrono_anomaly_idle_down', chosen: 'chrono_anomaly_rewind_down', originY: CHRONO_ORIGIN_Y / CHRONO_H },
            buttons: {
              attack: { texture: 'icon_shards_anomaly' },
              special: { texture: 'icon_rewind_anomaly' },
            },
          },
        ],
      },
    ],
    spawn(world, x, y, look) {
      const kit = { keeper: KEEPER_KIT, moon: MOON_KIT, clockwork: CLOCKWORK_KIT, primavera: PRIMAVERA_KIT, paradox: PARADOX_KIT, aeon: AEON_KIT, anomaly: ANOMALY_KIT }[look] ?? KEEPER_KIT;
      return new Chrono(world, x, y, kit);
    },
  },
  {
    id: 'samurai',
    name: 'Samurai',
    blurb: 'The way of the blade',
    types: [
      {
        // Quick stabs that charge the blade, a tornado that throws foes into the air, a dash through a foe and a spin.
        id: 'bladewind',
        name: 'Bladewind',
        role: 'Rides the wind',
        accent: 0x8ad8ff,
        attack: 'Steel tempest',
        special: 'Sweeping blade',
        preview: { texture: 'samurai', glow: 'samurai_e', idle: 'samurai_idle_down', chosen: 'samurai_slash1_down', originY: SAMURAI_ORIGIN_Y / SAMURAI_H },
        buttons: {
          attack: { texture: 'icon_katana' },
          special: { texture: 'icon_windblade' },
        },
        lookName: 'Gale',
        skins: [
          {
            id: 'oni',
            name: 'Oni',
            accent: 0xff5a4a,
            preview: { texture: 'samurai_oni', glow: 'samurai_oni_e', idle: 'samurai_oni_idle_down', chosen: 'samurai_oni_slash1_down', originY: SAMURAI_ORIGIN_Y / SAMURAI_H },
            buttons: {
              attack: { texture: 'icon_katana_oni' },
              special: { texture: 'icon_windblade_oni' },
            },
          },
          {
            id: 'kitsune',
            name: 'Kitsune',
            accent: 0x40e8b0,
            preview: { texture: 'samurai_kitsune', glow: 'samurai_kitsune_e', idle: 'samurai_kitsune_idle_down', chosen: 'samurai_kitsune_slash1_down', originY: SAMURAI_ORIGIN_Y / SAMURAI_H },
            buttons: {
              attack: { texture: 'icon_katana_kitsune' },
              special: { texture: 'icon_windblade_kitsune' },
            },
          },
        ],
      },
      {
        // Heavier cuts that leave marks, a crossing cut in a flash, and every cut bursting open when he sheathes.
        id: 'ronin',
        name: 'Ronin',
        role: 'Cuts that open later',
        accent: 0xffd070,
        attack: 'Iai cut',
        special: 'Crossing cut',
        preview: { texture: 'ronin', glow: 'ronin_e', idle: 'ronin_idle_down', chosen: 'ronin_slash2_down', originY: SAMURAI_ORIGIN_Y / SAMURAI_H },
        buttons: {
          attack: { texture: 'icon_iai' },
          special: { texture: 'icon_cross' },
        },
        lookName: 'Wanderer',
        skins: [
          {
            id: 'sakura',
            name: 'Sakura',
            accent: 0xff9ac0,
            preview: { texture: 'ronin_sakura', glow: 'ronin_sakura_e', idle: 'ronin_sakura_idle_down', chosen: 'ronin_sakura_slash2_down', originY: SAMURAI_ORIGIN_Y / SAMURAI_H },
            buttons: {
              attack: { texture: 'icon_iai_sakura' },
              special: { texture: 'icon_cross_sakura' },
            },
          },
          {
            id: 'shogun',
            name: 'Shogun',
            accent: 0xa89cff,
            preview: { texture: 'ronin_shogun', glow: 'ronin_shogun_e', idle: 'ronin_shogun_idle_down', chosen: 'ronin_shogun_slash2_down', originY: SAMURAI_ORIGIN_Y / SAMURAI_H },
            buttons: {
              attack: { texture: 'icon_iai_shogun' },
              special: { texture: 'icon_cross_shogun' },
            },
          },
        ],
      },
    ],
    spawn(world, x, y, look) {
      const kit = { bladewind: BLADEWIND_KIT, oni: ONI_KIT, kitsune: KITSUNE_KIT, ronin: RONIN_KIT, sakura: SAKURA_KIT, shogun: SHOGUN_KIT }[look] ?? BLADEWIND_KIT;
      return new Samurai(world, x, y, kit);
    },
  },
  {
    id: 'druid',
    name: 'Druid',
    blurb: 'Keeper of the wild',
    chargeSpecial: true,
    types: [
      {
        // Thorn seeds that slow what they prick, and a grove that seizes foes, wears them down and heals her.
        id: 'grove',
        name: 'Grovekeeper',
        role: 'Thorns and green growth',
        accent: 0x8ee05a,
        attack: 'Thorn seed',
        special: 'Wild grove',
        preview: { texture: 'druid', glow: 'druid_e', idle: 'druid_idle_down', chosen: 'druid_cast_down' },
        buttons: {
          attack: { texture: 'icon_thorn' },
          special: { texture: 'icon_grove' },
        },
        lookName: 'Greenwood',
        skins: [
          {
            // Russet leaves and bare antlers, and seeds that burn like embers.
            id: 'autumn',
            name: 'Autumn Warden',
            accent: 0xff9a40,
            preview: { texture: 'druid_autumn', glow: 'druid_autumn_e', idle: 'druid_autumn_idle_down', chosen: 'druid_autumn_cast_down' },
            buttons: {
              attack: { texture: 'icon_thorn_autumn' },
              special: { texture: 'icon_grove_autumn' },
            },
          },
          {
            // The faerie queen: honey-gold hair under a crown of blossoms, a gown of petals, dragonfly wings, and a moonflower on a moonwood staff.
            id: 'titania',
            name: 'Titania',
            accent: 0xffb8d0,
            preview: { texture: 'druid_titania', glow: 'druid_titania_e', idle: 'druid_titania_idle_down', chosen: 'druid_titania_cast_down' },
            buttons: {
              attack: { texture: 'icon_thorn_titania' },
              special: { texture: 'icon_grove_titania' },
            },
          },
        ],
      },
      {
        // Tougher and quicker: spirit claws up close, and a pounce as a spirit wolf.
        id: 'wild',
        name: 'Shapeshifter',
        role: 'Claw and fang',
        accent: 0xffa040,
        attack: 'Spirit claws',
        special: 'Pounce',
        preview: { texture: 'druid_wild', glow: 'druid_wild_e', idle: 'druid_wild_idle_down', chosen: 'druid_wild_cast_down' },
        buttons: {
          attack: { texture: 'icon_claws' },
          special: { texture: 'icon_pounce' },
        },
        lookName: 'Wolfpelt',
        skins: [
          {
            // A white wolf's pelt with eyes of ice, and a spirit wolf of winter.
            id: 'frostfang',
            name: 'Frostfang',
            accent: 0x8ad0ff,
            preview: { texture: 'druid_frost', glow: 'druid_frost_e', idle: 'druid_frost_idle_down', chosen: 'druid_frost_cast_down' },
            buttons: {
              attack: { texture: 'icon_claws_frost' },
              special: { texture: 'icon_pounce_frost' },
            },
          },
        ],
      },
    ],
    spawn(world, x, y, look) {
      if (look === 'wild' || look === 'frostfang') {
        const frost = look === 'frostfang';
        const craft = new Wildcraft(world, frost ? FROST_MAGIC : WILD_MAGIC);
        const w = new Wizard(
          world,
          x,
          y,
          {
            cast: (_x, _y, dx, dy) => craft.claws(dx, dy),
            beam: (_x, _y, dx, dy, power, dist) => craft.pounce(dx, dy, power, dist),
            target: (dx, dy, level, dist) => craft.target(dx, dy, level, dist),
            untarget: () => craft.untarget(),
          },
          frost ? FROST_SKIN : WILD_SKIN,
        );
        craft.caster = w;
        world.addEffect(craft);
        return w;
      }
      const autumn = look === 'autumn';
      const titania = look === 'titania';
      const craft = new Grovecraft(world, titania ? TITANIA_MAGIC : autumn ? AUTUMN_MAGIC : GROVE_MAGIC);
      const w = new Wizard(
        world,
        x,
        y,
        {
          cast: (x, y, dx, dy) => craft.seed(x, y, dx, dy),
          beam: (_x, _y, dx, dy, power, dist) => craft.grove(dx, dy, power, dist),
          target: (dx, dy, level, dist) => craft.target(dx, dy, level, dist),
          untarget: () => craft.untarget(),
        },
        titania ? TITANIA_SKIN : autumn ? AUTUMN_SKIN : GROVE_SKIN,
      );
      craft.caster = w;
      world.addEffect(craft);
      return w;
    },
  },
  {
    id: 'valkyrie',
    name: 'Valkyrie',
    blurb: 'Wings over the battlefield',
    types: [
      {
        // A spear chain that reaches past a sword's, and a spear of light that pierces and flies back.
        id: 'spear',
        name: 'Spearmaiden',
        role: 'Spear and wing',
        accent: 0xffd070,
        attack: 'Spear chain',
        special: 'Spear of light',
        preview: { texture: 'valkyrie', glow: 'valkyrie_e', idle: 'valkyrie_idle_down', chosen: 'valkyrie_thrust_down', originY: WARRIOR_ORIGIN_Y / WARRIOR_H },
        buttons: {
          attack: { texture: 'icon_spear' },
          special: { texture: 'icon_spearthrow' },
        },
        lookName: 'Swan',
        skins: [
          {
            // Gilded plate, a crimson tabard, rose-gold wings and a halo of the sun.
            id: 'sunshield',
            name: 'Sunshield',
            accent: 0xffb060,
            preview: { texture: 'valkyrie_sun', glow: 'valkyrie_sun_e', idle: 'valkyrie_sun_idle_down', chosen: 'valkyrie_sun_thrust_down', originY: WARRIOR_ORIGIN_Y / WARRIOR_H },
            buttons: {
              attack: { texture: 'icon_spear_sun' },
              special: { texture: 'icon_spearthrow_sun' },
            },
          },
          {
            // Pearl and silver-blue over lake-blue silk, great swan wings, platinum braids and a feathered diadem.
            id: 'swan',
            name: 'Swan Maiden',
            accent: 0xb8d4ff,
            preview: { texture: 'valkyrie_swan', glow: 'valkyrie_swan_e', idle: 'valkyrie_swan_idle_down', chosen: 'valkyrie_swan_thrust_down', originY: WARRIOR_ORIGIN_Y / WARRIOR_H },
            buttons: {
              attack: { texture: 'icon_spear_swan' },
              special: { texture: 'icon_spearthrow_swan' },
            },
          },
        ],
      },
      {
        // Blows that arc lightning on to nearby foes, and a dive from the sky that lands with a thunderbolt.
        id: 'storm',
        name: 'Stormwing',
        role: 'Lightning from above',
        accent: 0x7ad0ff,
        attack: 'Thunder spear',
        special: 'Valkyrie dive',
        preview: { texture: 'valkyrie_storm', glow: 'valkyrie_storm_e', idle: 'valkyrie_storm_idle_down', chosen: 'valkyrie_storm_thrust_down', originY: WARRIOR_ORIGIN_Y / WARRIOR_H },
        buttons: {
          attack: { texture: 'icon_spear_storm' },
          special: { texture: 'icon_dive' },
        },
        lookName: 'Tempest',
        skins: [
          {
            // Black steel, raven wings and violet lightning.
            id: 'raven',
            name: 'Raven Queen',
            accent: 0xb880ff,
            preview: { texture: 'valkyrie_raven', glow: 'valkyrie_raven_e', idle: 'valkyrie_raven_idle_down', chosen: 'valkyrie_raven_thrust_down', originY: WARRIOR_ORIGIN_Y / WARRIOR_H },
            buttons: {
              attack: { texture: 'icon_spear_raven' },
              special: { texture: 'icon_dive_raven' },
            },
          },
        ],
      },
    ],
    spawn(world, x, y, look) {
      const kit = { spear: SPEAR_KIT, sunshield: SUN_KIT, swan: SWAN_KIT, storm: STORM_KIT, raven: RAVEN_KIT }[look] ?? SPEAR_KIT;
      return new Valkyrie(world, x, y, kit);
    },
  },
  {
    id: 'automaton',
    name: 'Automaton',
    blurb: 'Steel, steam and a heat gauge',
    // The mech's salvo is held to paint targets and fires on release.
    chargeSpecial: true,
    types: [
      {
        // Two cannons firing in turn, and a salvo of homing missiles on everything it paints.
        id: 'mech',
        name: 'Siege Mech',
        role: 'Heavy guns, hot barrels',
        accent: 0xffb040,
        attack: 'Twin cannons',
        special: 'Lock-on salvo',
        preview: { texture: 'mech', glow: 'mech_e', idle: 'mech_idle_down', chosen: 'mech_deploy_down', originY: MECH_ORIGIN_Y / MECH_H },
        buttons: {
          attack: { texture: 'icon_cannon' },
          special: { texture: 'icon_salvo' },
        },
        lookName: 'Hazard',
        skins: [
          {
            // A junkyard mech: an oil-barrel body with a goblin in goggles at the porthole, a cone for a hat, a claw and a drill.
            id: 'scrap',
            name: 'Scrap Titan',
            accent: 0xe8783a,
            preview: { texture: 'mech_scrap', glow: 'mech_scrap_e', idle: 'mech_scrap_idle_down', chosen: 'mech_scrap_deploy_down', originY: MECH_ORIGIN_Y / MECH_H },
            buttons: {
              attack: { texture: 'icon_cannon_scrap' },
              special: { texture: 'icon_salvo_scrap' },
            },
          },
        ],
      },
      {
        // Three drones that dart out and zap, and a grid of lasers strung between them.
        id: 'synth',
        name: 'Synth',
        role: 'Drones and lasers',
        accent: 0x5ae8ff,
        attack: 'Drone strike',
        special: 'Laser grid',
        preview: { texture: 'synth', glow: 'synth_e', idle: 'synth_idle_down', chosen: 'synth_open_down', originY: SYNTH_ORIGIN_Y / SYNTH_H },
        buttons: {
          attack: { texture: 'icon_drone' },
          special: { texture: 'icon_grid' },
        },
        lookName: 'Halo',
        skins: [
          {
            // A bee queen of gold and chitin: compound eyes, a tiara, wings, and bee-bots for drones.
            id: 'hive',
            name: 'Hive Queen',
            accent: 0xffb03a,
            preview: { texture: 'synth_hive', glow: 'synth_hive_e', idle: 'synth_hive_idle_down', chosen: 'synth_hive_open_down', originY: SYNTH_ORIGIN_Y / SYNTH_H },
            buttons: {
              attack: { texture: 'icon_drone_hive' },
              special: { texture: 'icon_grid_hive' },
            },
          },
        ],
      },
    ],
    spawn(world, x, y, look) {
      if (look === 'synth') return new Synth(world, x, y, SYNTH_KIT);
      if (look === 'hive') return new Synth(world, x, y, HIVE_KIT);
      return new Mech(world, x, y, look === 'scrap' ? SCRAP_KIT : MECH_KIT);
    },
  },
  {
    id: 'phantom',
    name: 'Phantom',
    blurb: 'Only half here: blows pass through',
    types: [
      {
        // Haunted things hurled with its mind, and a rattle that flings foes into the air.
        id: 'poltergeist',
        name: 'Poltergeist',
        role: 'Mischief and flying furniture',
        accent: 0x8af0c8,
        attack: 'Hurl',
        special: 'Rattle',
        preview: { texture: 'polter', glow: 'polter_e', idle: 'polter_idle_down', chosen: 'polter_cast_down', originY: POLTER_ORIGIN_Y / POLTER_H },
        buttons: {
          attack: { texture: 'icon_hurl' },
          special: { texture: 'icon_rattle' },
        },
        lookName: 'Sheet',
        skins: [
          {
            // A Victorian ghost girl: a bonnet and bow, ringlets, lace skirts fading to mist, a parasol, and the tea set.
            id: 'tea',
            name: 'Tea Party',
            accent: 0xd0b0ff,
            preview: { texture: 'polter_tea', glow: 'polter_tea_e', idle: 'polter_tea_idle_down', chosen: 'polter_tea_cast_down', originY: POLTER_ORIGIN_Y / POLTER_H },
            buttons: {
              attack: { texture: 'icon_hurl_tea' },
              special: { texture: 'icon_rattle_tea' },
            },
          },
        ],
      },
      {
        // A lantern that leaves burning wisps, and a dive into a foe to ride it against the others.
        id: 'wraith',
        name: 'Lantern Wraith',
        role: 'Soul-flame and possession',
        accent: 0x6af0b8,
        attack: 'Lantern swing',
        special: 'Possess',
        preview: { texture: 'wraith', glow: 'wraith_e', idle: 'wraith_idle_down', chosen: 'wraith_cast_down', originY: WRAITH_ORIGIN_Y / WRAITH_H },
        buttons: {
          attack: { texture: 'icon_lantern' },
          special: { texture: 'icon_possess' },
        },
        lookName: 'Hooded',
        skins: [
          {
            // A Día de Muertos spirit: a painted sugar skull, a marigold crown, a lace veil and a paper lantern.
            id: 'cala',
            name: 'Calavera',
            accent: 0xffb030,
            preview: { texture: 'wraith_cala', glow: 'wraith_cala_e', idle: 'wraith_cala_idle_down', chosen: 'wraith_cala_cast_down', originY: WRAITH_ORIGIN_Y / WRAITH_H },
            buttons: {
              attack: { texture: 'icon_lantern_cala' },
              special: { texture: 'icon_possess_cala' },
            },
          },
          {
            // A gentle forest spirit: a mossy cloak trimmed with ferns and mushrooms, leafy hair, a wicker lantern of fireflies.
            id: 'firefly',
            name: 'Firefly',
            accent: 0xd0ff70,
            preview: { texture: 'wraith_firefly', glow: 'wraith_firefly_e', idle: 'wraith_firefly_idle_down', chosen: 'wraith_firefly_cast_down', originY: WRAITH_ORIGIN_Y / WRAITH_H },
            buttons: {
              attack: { texture: 'icon_lantern_firefly' },
              special: { texture: 'icon_possess_firefly' },
            },
          },
        ],
      },
    ],
    spawn(world, x, y, look) {
      if (look === 'wraith') return new Wraith(world, x, y, WRAITH_KIT);
      if (look === 'cala') return new Wraith(world, x, y, CALA_KIT);
      if (look === 'firefly') return new Wraith(world, x, y, FIREFLY_KIT);
      return new Poltergeist(world, x, y, look === 'tea' ? TEA_KIT : POLTER_KIT);
    },
  },
  {
    id: 'inventor',
    name: 'Inventor',
    blurb: 'Gadgets, gizmos and bright ideas',
    types: [
      {
        // A pipe wrench up close, and sentry turrets built from a tossed crate.
        id: 'engineer',
        name: 'Engineer',
        role: 'Builds turrets, swings a wrench',
        accent: 0xf6cc3c,
        attack: 'Pipe wrench',
        special: 'Build sentry',
        preview: { texture: 'engineer', glow: 'engineer_e', idle: 'engineer_idle_down', chosen: 'engineer_eureka_down', originY: INV_ORIGIN_Y / INV_H },
        buttons: {
          attack: { texture: 'icon_wrench' },
          special: { texture: 'icon_turret' },
        },
        lookName: 'Hard hat',
      },
      {
        // Lightning that leaps from foe to foe, and an orb that drags them in and bursts.
        id: 'scientist',
        name: 'Scientist',
        role: 'Lightning in a bottle',
        accent: 0x5ad8ff,
        attack: 'Tesla arc',
        special: 'Polarity orb',
        preview: { texture: 'scientist', glow: 'scientist_e', idle: 'scientist_idle_down', chosen: 'scientist_eureka_down', originY: INV_ORIGIN_Y / INV_H },
        buttons: {
          attack: { texture: 'icon_tesla' },
          special: { texture: 'icon_orb' },
        },
        lookName: 'Lab coat',
        skins: [
          {
            // The wild white hair, the moustache, a baggy cardigan, and a stick of glowing chalk.
            id: 'einstein',
            name: 'Einstein',
            accent: 0xffd060,
            preview: { texture: 'scientist_einstein', glow: 'scientist_einstein_e', idle: 'scientist_einstein_idle_down', chosen: 'scientist_einstein_eureka_down', originY: INV_ORIGIN_Y / INV_H },
            buttons: {
              attack: { texture: 'icon_tesla_einstein' },
              special: { texture: 'icon_orb_einstein' },
            },
          },
        ],
      },
    ],
    spawn(world, x, y, look) {
      if (look === 'scientist') return new Scientist(world, x, y, SCIENTIST_KIT);
      if (look === 'einstein') return new Scientist(world, x, y, EINSTEIN_KIT);
      return new Engineer(world, x, y, ENGINEER_KIT);
    },
  },
  {
    id: 'beast',
    name: 'Beastkin',
    blurb: 'Wings, claws and dragonfire',
    types: [
      {
        // Razor feathers flung from either hand, and a wingbeat that hurls foes away.
        id: 'eagle',
        name: 'Eagle',
        role: 'Swift hunter of the skies',
        accent: 0x8ad8ff,
        attack: 'Razor feathers',
        special: 'Gale',
        preview: { texture: 'eagle', glow: 'eagle_e', idle: 'eagle_idle_down', chosen: 'eagle_rally_down', originY: BEAST_ORIGIN_Y / BEAST_H },
        buttons: {
          attack: { texture: 'icon_feather_eagle' },
          special: { texture: 'icon_gust_eagle' },
        },
        lookName: 'Skyfeather',
        skins: [
          {
            // Benfica's red shirt, white shorts and red socks, gilded wings, and red feathers.
            id: 'benfica',
            name: 'Benfica',
            accent: 0xff3a44,
            preview: { texture: 'eagle_benfica', glow: 'eagle_benfica_e', idle: 'eagle_benfica_idle_down', chosen: 'eagle_benfica_rally_down', originY: BEAST_ORIGIN_Y / BEAST_H },
            buttons: {
              attack: { texture: 'icon_feather_eagle_benfica' },
              special: { texture: 'icon_gust_eagle_benfica' },
            },
          },
        ],
      },
      {
        // Raking claws and a pounce, and a roar that cows everything near.
        id: 'lion',
        name: 'Lion',
        role: 'King of the beasts',
        accent: 0xf4b848,
        attack: 'Claws',
        special: 'Roar',
        preview: { texture: 'lion', glow: 'lion_e', idle: 'lion_idle_down', chosen: 'lion_rally_down', originY: BEAST_ORIGIN_Y / BEAST_H },
        buttons: {
          attack: { texture: 'icon_claw_lion' },
          special: { texture: 'icon_roar_lion' },
        },
        lookName: 'Sunmane',
        skins: [
          {
            // Sporting's green and white hoops over a brighter golden coat, and a green roar.
            id: 'sporting',
            name: 'Sporting',
            accent: 0x2ed070,
            preview: { texture: 'lion_sporting', glow: 'lion_sporting_e', idle: 'lion_sporting_idle_down', chosen: 'lion_sporting_rally_down', originY: BEAST_ORIGIN_Y / BEAST_H },
            buttons: {
              attack: { texture: 'icon_claw_lion_sporting' },
              special: { texture: 'icon_roar_lion_sporting' },
            },
          },
        ],
      },
      {
        // Bolts of fire spat from the jaws, and a long breath of flame.
        id: 'dragon',
        name: 'Dragon',
        role: 'Scales and fire',
        accent: 0xff6a2a,
        attack: 'Dragonfire',
        special: 'Flame breath',
        preview: { texture: 'dragon', glow: 'dragon_e', idle: 'dragon_idle_down', chosen: 'dragon_rally_down', originY: BEAST_ORIGIN_Y / BEAST_H },
        buttons: {
          attack: { texture: 'icon_fire_dragon' },
          special: { texture: 'icon_breath_dragon' },
        },
        lookName: 'Emberscale',
        skins: [
          {
            // Porto's blue and white stripes, royal blue scales, a little gold crown, and blue fire.
            id: 'porto',
            name: 'Porto',
            accent: 0x3a8cff,
            preview: { texture: 'dragon_porto', glow: 'dragon_porto_e', idle: 'dragon_porto_idle_down', chosen: 'dragon_porto_rally_down', originY: BEAST_ORIGIN_Y / BEAST_H },
            buttons: {
              attack: { texture: 'icon_fire_dragon_porto' },
              special: { texture: 'icon_breath_dragon_porto' },
            },
          },
        ],
      },
    ],
    spawn(world, x, y, look) {
      if (look === 'benfica') return new Eagle(world, x, y, BENFICA_KIT);
      if (look === 'lion') return new Lion(world, x, y, LION_KIT);
      if (look === 'sporting') return new Lion(world, x, y, SPORTING_KIT);
      if (look === 'dragon') return new Dragon(world, x, y, DRAGON_KIT);
      if (look === 'porto') return new Dragon(world, x, y, PORTO_KIT);
      return new Eagle(world, x, y, EAGLE_KIT);
    },
  },
];

/**
 * The classes on the select screen, each gathering the characters of its
 * kits, in that order. A class's id may be one of its kits' (old saves stored
 * kit ids, see classById).
 */
const GROUPS: { id: string; name: string; blurb: string; kits: string[] }[] = [
  { id: 'mage', name: 'Mage', blurb: 'Spells, and time itself', kits: ['wizard', 'chronomancer'] },
  { id: 'warrior', name: 'Warrior', blurb: 'Steel, faith and fists up front', kits: ['warrior', 'paladin', 'valkyrie', 'fighter'] },
  { id: 'jedi', name: 'Jedi', blurb: 'The light and the dark', kits: ['jedi'] },
  { id: 'alchemist', name: 'Alchemist', blurb: 'Brews that melt foes', kits: ['alchemist'] },
  { id: 'archer', name: 'Ranger', blurb: 'Death from afar', kits: ['archer'] },
  { id: 'duelist', name: 'Duelist', blurb: 'Blades from the shadows', kits: ['samurai', 'rogue'] },
  { id: 'necromancer', name: 'Necromancer', blurb: 'Lord of the restless dead', kits: ['necromancer'] },
  { id: 'mystic', name: 'Mystic', blurb: 'Songs and the old wild', kits: ['bard', 'druid'] },
  { id: 'automaton', name: 'Automaton', blurb: 'Steel, steam and a heat gauge', kits: ['automaton'] },
  { id: 'phantom', name: 'Phantom', blurb: 'Only half here: blows pass through', kits: ['phantom'] },
  { id: 'inventor', name: 'Inventor', blurb: 'Gadgets, gizmos and bright ideas', kits: ['inventor'] },
  { id: 'beast', name: 'Nature', blurb: 'Wings, claws and dragonfire', kits: ['beast'] },
];

/** Which kit each type and skin belongs to. */
const KIT_OF = new Map<TypeDef | SkinDef, KitDef>();
for (const kit of KITS)
  for (const type of kit.types) {
    KIT_OF.set(type, kit);
    for (const skin of type.skins ?? []) KIT_OF.set(skin, kit);
  }

/** The kit a type or skin belongs to. */
export const kitOf = (t: TypeDef | SkinDef): KitDef => KIT_OF.get(t)!;

/** A kit by id, if there is one (an old save's may have been retired). */
export const kitById = (id: string | undefined): KitDef | undefined => KITS.find((k) => k.id === id);

export const CLASSES: ClassDef[] = GROUPS.map(({ id, name, blurb, kits }) => ({
  id,
  name,
  blurb,
  types: kits.flatMap((k) => kitById(k)!.types),
}));

/** The class with this id, or the class holding the kit with this id (old saves), else the first. */
export const classById = (id: string | undefined): ClassDef =>
  CLASSES.find((c) => c.id === id) ?? CLASSES.find((c) => c.types.some((t) => kitOf(t).id === id)) ?? CLASSES[0];

/** The class as played in its chosen type and skin. */
export function characterById(id: string | undefined): CharacterDef {
  return worn(classById(id));
}
