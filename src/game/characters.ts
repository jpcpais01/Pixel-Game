// Playable characters. The select screen lists CHARACTERS in order, and the
// world spawns whichever one was picked. A new hero is one entry here, plus
// its textures (built in art/textures.ts) and its Hero class.

import type Phaser from 'phaser';
import type { WorldScene } from '../scenes/WorldScene';
import { ARCANE_SKIN, VOID_SKIN, Wizard } from './Wizard';
import { PYRO_SKIN, Pyromancy } from './Pyro';
import { JADE_SKIN, KNIGHT_SKIN, Warrior } from './Warrior';
import { WARRIOR_H, WARRIOR_ORIGIN_Y } from '../art/warrior';
import { Paladin } from './Paladin';
import { PALADIN_H, PALADIN_ORIGIN_Y } from '../art/paladin';
import { Jedi, JEDI_STYLE, SITH_STYLE } from './Jedi';
import { JEDI_H, JEDI_ORIGIN_Y } from '../art/jedi';
import { Fighter } from './Fighter';
import { FIGHTER_H, FIGHTER_ORIGIN_Y } from '../art/fighter';
import { Alchemist, PLAGUE_STYLE, WITCH_STYLE } from './Alchemist';
import { ALCH_H, ALCH_ORIGIN_Y } from '../art/alchemist';
import { Archer, RANGER_STYLE, STORM_STYLE } from './Archer';
import { ARCHER_H, ARCHER_ORIGIN_Y } from '../art/archer';
import { wear, type SkinDef } from './skins';
import type { Vitals } from './combat';

/** A unit direction. */
export interface Aim {
  x: number;
  y: number;
  /** How far away the mouse is, in world px, for abilities that land at a spot. */
  dist?: number;
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
   * a unit vector towards the mouse on a computer; abilities go that way
   * instead of the way the hero last walked.
   */
  update(dt: number, mx: number, my: number, attack: boolean, special: boolean, bounds: Phaser.Geom.Rectangle, aim?: Aim | null): void;
}

export interface CharacterDef {
  id: string;
  name: string;
  /** A few words under the name, e.g. "Arcane caster". */
  role: string;
  /** Card highlight colour. */
  accent: number;
  /** 1..5 pips each on the select card. */
  stats: { power: number; speed: number; range: number };
  /** Ability names shown on the card. */
  attack: string;
  special: string;
  /** The animated portrait on the select card. */
  preview: {
    texture: string;
    /** Additive glow layer with the same frame names, if any. */
    glow?: string;
    /** Looping idle animation key. */
    idle: string;
    /** Played once when the character is picked. */
    chosen: string;
    /** Feet as a fraction of the frame height, when frames aren't 24x32. */
    originY?: number;
  };
  /** Icons on the two ability buttons. */
  buttons: {
    attack: { texture: string; frame?: string; anim?: string };
    special: { texture: string };
  };
  /** Alternate looks (some with their own stats and abilities); the first is the default (see skins.ts). */
  skins?: SkinDef[];
  /** `skin` is the id of the worn skin, for characters that have skins. */
  spawn(world: WorldScene, x: number, y: number, skin?: string): Hero;
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'wizard',
    name: 'Wizard',
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
    skins: [
      { id: 'arcane', name: 'Arcane' },
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
      },
    ],
    spawn(world, x, y, skin) {
      if (skin === 'pyro') {
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
      const look = skin === 'void' ? VOID_SKIN : ARCANE_SKIN;
      const w: Wizard = new Wizard(
        world,
        x,
        y,
        {
          cast: (x, y, dx, dy) => world.castEnergyBall(x, y, dx, dy, look.style),
          beam: (x, y, dx, dy, power) => world.fireBeam(x, y, dx, dy, power, w.depthAhead(), look.style),
        },
        look,
      );
      return w;
    },
  },
  {
    id: 'warrior',
    name: 'Warrior',
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
    skins: [
      { id: 'knight', name: 'Knight' },
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
    spawn: (world, x, y, skin) => new Warrior(world, x, y, skin === 'jade' ? JADE_SKIN : KNIGHT_SKIN),
  },
  {
    id: 'paladin',
    name: 'Paladin',
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
    spawn: (world, x, y) => new Paladin(world, x, y),
  },
  {
    id: 'jedi',
    name: 'Jedi',
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
    skins: [
      { id: 'knight', name: 'Knight' },
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
    spawn: (world, x, y, skin) => new Jedi(world, x, y, skin === 'sith' ? SITH_STYLE : JEDI_STYLE),
  },
  {
    id: 'fighter',
    name: 'Fighter',
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
    spawn: (world, x, y) => new Fighter(world, x, y),
  },
  {
    id: 'alchemist',
    name: 'Alchemist',
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
    skins: [
      { id: 'plague', name: 'Plague doctor' },
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
    spawn: (world, x, y, skin) => new Alchemist(world, x, y, skin === 'witch' ? WITCH_STYLE : PLAGUE_STYLE),
  },
  {
    id: 'archer',
    name: 'Archer',
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
    skins: [
      { id: 'ranger', name: 'Ranger' },
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
    spawn: (world, x, y, skin) => new Archer(world, x, y, skin === 'storm' ? STORM_STYLE : RANGER_STYLE),
  },
];

/** The character in its currently worn skin. */
export function characterById(id: string | undefined): CharacterDef {
  return wear(CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0]);
}
