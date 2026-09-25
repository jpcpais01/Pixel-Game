import type { Hero } from '../characters';
import type { WorldScene } from '../../scenes/WorldScene';
import type { Pal } from './ink';

/** Everything a Special needs at the moment it is unleashed. */
export interface Cast {
  world: WorldScene;
  hero: Hero;
  /** The hero's feet as it was cast. */
  x: number;
  y: number;
  /** Unit direction it was aimed. */
  dx: number;
  dy: number;
  /** The spot on the ground it was aimed at (for Specials that land somewhere). */
  tx: number;
  ty: number;
  pal: Pal;
  /** The worn look's id, for Specials that change in more than colour with a skin (the storm's lightning). */
  look: string;
}

/** Paints a 16x16 icon for the Special's button, in the look's colours. */
export type IconPainter = (put: (x: number, y: number, c: number) => void, p: Pal) => void;

export interface UltDef {
  name: string;
  /** Energy it takes (out of 100). */
  cost: number;
  /** How long the hero gathers power, posing, before it is unleashed. */
  windup: number;
  /** How long the hero stays in the pose after that (a dash), in ms. */
  hold?: number;
  /** Aimed a way ('dir'), at a spot within `range` ('spot'), or cast where the hero stands ('self'). */
  aim: 'dir' | 'spot' | 'self';
  range?: number;
  pal: Pal;
  cast(c: Cast): void;
  icon: IconPainter;
}

/** A skin's take on its type's Special: the same power in its own colours and name. */
export interface UltSkin {
  name: string;
  pal: Pal;
}
