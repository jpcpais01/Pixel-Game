// Heaven Lands, the cozy game built on this one's engine (src/heaven/), runs
// the same world, Home and Everwood with no fighting in them. It switches
// this on before anything starts, and hands in the few things that differ:
// its own hero (a wanderer dressed in the character creator) and its own
// arenas. Myths and Legends never sets it, so none of this touches it.

import type { CharacterDef, Hero } from './characters';
import type Phaser from 'phaser';
import type { WorldScene } from '../scenes/WorldScene';
import type { ArenaDef } from '../world/arenas';

export interface CozyHooks {
  /** Heaven Lands is running: no monsters, no health or energy, chests give seeds and keepsakes. */
  on: boolean;
  /** The character played (this player's, or another player's from the look they sent). */
  character: ((kit?: string, look?: string) => CharacterDef) | null;
  /** This player's hero, spawned into the world. */
  spawn: ((world: WorldScene, x: number, y: number) => Hero) | null;
  /** What this player tells a room about themselves: their name, and their looks packed into hero and look. */
  me: (() => { name: string; hero: string; look: string }) | null;
  /** A chest opened somewhere (the Everwood's): what Heaven Lands gives instead of loot. */
  treasure: ((world: WorldScene, x: number, y: number) => void) | null;
  /** Heaven Lands' own buttons on the play HUD (emotes) in place of the fighting ones. */
  hud: ((scene: Phaser.Scene) => CozyHud) | null;
  /** The arena with this id, for places Heaven Lands adds that Myths' list doesn't have. */
  arena: ((id: string) => ArenaDef | undefined) | null;
  /** What Heaven Lands calls an arena ('Cloudrest' for the Floating Island). */
  placeName: ((arena: string) => string) | null;
  /** The living parts of an arena Heaven Lands adds (its endless lands): built by the world on the way in, or null. */
  land: ((world: WorldScene, arena: string, ground: (img: Phaser.GameObjects.Image) => Phaser.GameObjects.Image, view: Phaser.Geom.Rectangle) => CozyLand | null) | null;
}

export interface CozyLand {
  update(time: number, dt: number, daylight: number, hero: { x: number; y: number }, view: Phaser.Geom.Rectangle): void;
  destroy(): void;
}

export interface CozyHud {
  /** A press: true if the cozy buttons took it. */
  pointerDown(p: Phaser.Input.Pointer): boolean;
  update(dt: number, hidden: boolean): void;
}

export const cozy: CozyHooks = { on: false, character: null, spawn: null, me: null, treasure: null, hud: null, arena: null, placeName: null, land: null };
