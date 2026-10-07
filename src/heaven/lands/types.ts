// What a Heaven Lands land is made of. A land is endless and the same for
// everyone: every part of it is a pure function of its fixed seed and the
// world position, so friends in a room see one land with nothing sent, and a
// worker (landWorker.ts) or a node script (scripts/lands.ts) can grow it too.
//
// A land comes in two halves, so the pure half can run where Phaser can't:
//   - a LandGen (no Phaser): its ground, painted a tile at a time through the
//     shared painter (paint.ts), what stands in each chunk, where feet go;
//   - a LandDef (may use Phaser): the gen plus its art, light, motes, life
//     and sounds, which the runtime (LandRuntime.ts) brings to the world.

import type Phaser from 'phaser';
import type { PixelCanvas, RGB } from '../../art/pixel';
import type { WorldScene } from '../../scenes/WorldScene';
import type { Wild } from '../../audio/ambience';

/** A land's chunk: what stands is laid out a chunk at a time (px). */
export const CHUNK = 256;
/** Ground tiles: a chunk wide and half a chunk tall (px). */
export const TILE_W = 256;
export const TILE_H = 128;
/** Every land's world: big enough to walk for days, small enough for floats to stay exact. */
export const LAND_WORLD = 1 << 20;
export const LAND_MID = LAND_WORLD / 2;

// ---------------------------------------------------------------- the ground

/** One pixel of ground, as a land's `cell` classifies it. */
export interface GroundCell {
  /** Index into the land's `kinds`. */
  kind: number;
  /** Height in px-ish units: its slopes make the normals the lights catch. */
  height: number;
  /** Steps up (or down) the kind's ramp: ripples, dither, flecks. Rounded when coloured. */
  tone: number;
  /** 0..1: how much of the kind's glow colour this pixel gives off at night. */
  glow: number;
}

/** How a kind of ground is coloured. */
export interface KindStyle {
  /** Day ramp, darkest first. */
  day: RGB[];
  /** Night ramp; the day's moonlit (art/ground.ts nightify) when left out. */
  night?: RGB[];
  /** The ramp step a flat, untoned pixel takes. */
  mid: number;
  /** How many ramp steps light and shade across its slopes move it (0: flat colour, like water). */
  relief: number;
  /** Its glow at full strength (cell.glow scales it). */
  glow?: RGB;
  /** Ordered dither (0..1) where a pixel falls between two steps: soft gradients that stay crisp. */
  dither?: number;
}

/** A tile's fields while it is painted, for a land's decorations (shells, planks). Margin of 1 px all round. */
export interface TileFields {
  x0: number;
  y0: number;
  w: number;
  h: number;
  /** Row stride (w + 2). */
  pw: number;
  kind: Uint8Array;
  height: Float32Array;
  tone: Float32Array;
  glow: Float32Array;
}

/** A land's ground, for the shared painter (paint.ts). */
export interface LandGround {
  kinds: KindStyle[];
  /** Classify the pixel at world (x, y). Called for every pixel of a tile, so keep it lean. */
  cell(x: number, y: number, c: GroundCell): void;
  /** Stamp small things over the finished fields (shells, starfish, planks). */
  decorate?(f: TileFields): void;
}

/** A painted tile: day and night, each with its normal map, and what glows (null when nothing does). */
export interface LandTile {
  col: number;
  row: number;
  w: number;
  h: number;
  day: Uint8ClampedArray<ArrayBuffer>;
  night: Uint8ClampedArray<ArrayBuffer>;
  /** One normal map for both looks (the ground's slopes don't change at night). */
  normal: Uint8ClampedArray<ArrayBuffer>;
  glow: Uint8ClampedArray<ArrayBuffer> | null;
}

// ---------------------------------------------------------------- what stands

/** Something standing in a chunk: a frame of one of the land's sheets, its feet at (x, y). */
export interface LandProp {
  sheet: string;
  frame: string;
  x: number;
  y: number;
  flip?: boolean;
  /** Stops feet: an ellipse round the feet (offset by ox, oy). */
  block?: { rx: number; ry: number; ox?: number; oy?: number };
  /** Casts a sun shadow (default true). */
  shadow?: boolean;
  /** Plays this animation (the sheet's), at a phase picked from its spot. */
  anim?: string;
  /** Sorts as if its feet were this far lower (a flat thing lying on the ground: a big negative number keeps it under everyone). */
  sortY?: number;
}

/** A light standing in a chunk (a lantern): the world's point light, lit by night. */
export interface LandLight {
  x: number;
  y: number;
  radius: number;
  color: number;
  intensity: number;
  /** Share of its strength left by day. */
  day?: number;
  /** How much it flickers (0 steady .. 1 a candle). */
  flicker?: number;
  /** A soft halo drawn round it (additive). */
  halo?: number;
}

/** Where one of the land's little living things lives. */
export interface LifeSpot {
  /** A `walkers` entry's id. */
  kind: string;
  x: number;
  y: number;
}

export interface ChunkLayout {
  props: LandProp[];
  lights: LandLight[];
  life: LifeSpot[];
}

/** The pure half of a land. */
export interface LandGen {
  readonly seed: number;
  ground: LandGround;
  /** Where a wanderer first stands. */
  spawn(): { x: number; y: number };
  /** Can feet stand on the ground here (water, cliffs, thickets stop them)? Props' blocks are added by LandWorld. */
  open(x: number, y: number): boolean;
  /** What stands in chunk (cx, cy); pure, and asked again whenever the chunk is stood up. */
  layout(cx: number, cy: number): ChunkLayout;
}

// ---------------------------------------------------------------- art

/** Frames of one size, packed into one lit sheet (`<key>`, `<key>_e`, `<key>_s`). */
export interface SheetDef {
  key: string;
  w: number;
  h: number;
  /** Feet in the frame (px from its left and top). */
  footX: number;
  footY: number;
  frames: { name: string; draw: () => PixelCanvas }[];
  /** Animations, made as `<key>_<name>`. */
  anims?: { name: string; frames: string[]; fps: number; loop?: boolean }[];
  /** Has glowing pixels worth a `_e` layer. */
  glows?: boolean;
}

// ---------------------------------------------------------------- life

/** Little things that wander the ground near their spot and run from a wanderer (crabs). Cosmetic and local. */
export interface WalkerDef {
  id: string;
  sheet: string;
  /** Animations (the sheet's): walking and standing. */
  walk: string;
  idle: string;
  /** px a second, wandering and running. */
  speed: number;
  run: number;
  /** How far from its spot it wanders (px), and how near a wanderer scares it. */
  range: number;
  fear: number;
  /** Walks sideways (a crab) rather than facing where it goes. */
  sideways?: boolean;
  /** Where it may stand. */
  where(x: number, y: number): boolean;
  /** Out by day, by night, or always. */
  when?: 'day' | 'night';
}

/** Things circling overhead (gulls), with a shadow on the ground. Cosmetic and local. */
export interface FlyerDef {
  id: string;
  sheet: string;
  anim: string;
  /** How many round the view at once. */
  count: number;
  /** Height over the ground (px) and how wide they circle. */
  height: number;
  radius: number;
  /** px a second along their circle. */
  speed: number;
  when?: 'day' | 'night';
}

/** A land's own living parts beyond the shared ones (the shore's waves). */
export interface LandExtra {
  update(time: number, dt: number, daylight: number, hero: { x: number; y: number }, view: Phaser.Geom.Rectangle): void;
  destroy(): void;
}

// ---------------------------------------------------------------- the land

export interface LandDef {
  /** Also its arena id. */
  id: string;
  name: string;
  blurb: string;
  accent: number;
  /** Its pure half, made once (shared by the arena's feet and the runtime). */
  gen(): LandGen;
  sheets(): SheetDef[];
  /** Day and night turn here; else a fixed light (0 night .. 1 day). */
  dayNight: boolean;
  daylight?: number;
  /** Motes drifting down (see world/Scenery.ts Drift). */
  drift: { tints: number[]; frequency: number };
  walkers?: WalkerDef[];
  flyers?: FlyerDef[];
  /** Its own living parts, made when the world opens. */
  extra?(world: WorldScene, gen: LandGen, ground: (img: Phaser.GameObjects.Image) => Phaser.GameObjects.Image): LandExtra;
  /** The ambient water/wilds sound round the wanderer, asked a few times a second (see audio/ambience.ts). */
  sound?(gen: LandGen, x: number, y: number, time: number): Wild | null;
}
