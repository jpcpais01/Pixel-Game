// Playable characters. The select screen lists CHARACTERS in order, and the
// world spawns whichever one was picked. A new hero is one entry here, plus
// its textures (built in art/textures.ts) and its Hero class.

import type Phaser from 'phaser';
import type { WorldScene } from '../scenes/WorldScene';
import { Wizard } from './Wizard';

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
  };
  /** Icons on the two ability buttons. */
  buttons: {
    attack: { texture: string; frame?: string; anim?: string };
    special: { texture: string };
  };
  /** Keyboard help shown on wide screens. */
  hint: string;
  spawn(world: WorldScene, x: number, y: number): Hero;
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
    spawn(world, x, y) {
      const w: Wizard = new Wizard(world, x, y, {
        cast: (x, y, dx, dy) => world.castEnergyBall(x, y, dx, dy),
        beam: (x, y, dx, dy, power) => world.fireBeam(x, y, dx, dy, power, w.depthAhead()),
      });
      return w;
    },
  },
];

export function characterById(id: string | undefined): CharacterDef {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}
