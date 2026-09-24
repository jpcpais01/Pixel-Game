// Playable characters. The select screen lists CHARACTERS in order, and the
// world spawns whichever one was picked. A new hero is one entry here, plus
// its textures (built in art/textures.ts) and its Hero class.

import type Phaser from 'phaser';
import type { WorldScene } from '../scenes/WorldScene';
import { ARCANE_SKIN, VOID_SKIN, Wizard } from './Wizard';
import { Warrior } from './Warrior';
import { WARRIOR_H, WARRIOR_ORIGIN_Y } from '../art/warrior';
import { Paladin } from './Paladin';
import { PALADIN_H, PALADIN_ORIGIN_Y } from '../art/paladin';
import { wear, type SkinDef } from './skins';

/** What the world needs from the player's character each frame. */
export interface Hero {
  x: number;
  y: number;
  /** 0 = night, 1 = day. */
  daylight: number;
  /** `attack` and `special` are the two ability buttons (held = true). */
  update(dt: number, mx: number, my: number, attack: boolean, special: boolean, bounds: Phaser.Geom.Rectangle): void;
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
  /** Keyboard help shown on wide screens. */
  hint: string;
  /** Alternate looks, same gameplay; the first is the default (see skins.ts). */
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
    hint: 'Space to cast  ·  hold K to charge a beam',
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
    ],
    spawn(world, x, y, skin) {
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
    hint: 'Space to swing (chain 3 for a combo)  ·  K for a whirlwind',
    spawn: (world, x, y) => new Warrior(world, x, y),
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
    hint: 'Space to smite  ·  K to consecrate the ground (heals you)',
    spawn: (world, x, y) => new Paladin(world, x, y),
  },
];

/** The character in its currently worn skin. */
export function characterById(id: string | undefined): CharacterDef {
  return wear(CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0]);
}
