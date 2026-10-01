// The Aurora Colosseum's shared palette: the materials its creatures, its
// bosses and its spells are drawn in, so the whole bestiary reads as one
// winter. Cold light comes from the top-left like everywhere else; shadows
// lean blue, never grey; highlights go to a near-white blue. Glowing parts
// (eyes, runes, crystal cores, aurora) are the only saturated colours.
//
// Also the few helpers ice is drawn with (a faceted crystal, a polygon), and
// the registrar a creature file hands its own spell textures to (see
// `FxRegistrar` and the 'frost' arena job in textures.ts).

import { PixelCanvas, hex, type Material, type RGB, type Vec3, FLAT } from './pixel';

export const ramp = (...c: string[]): RGB[] => c.map(hex);

/** The outline under everything: a blue-black. */
export const INK = hex('#060a14');

// ---------------------------------------------------------------- Ice and snow

/** Clear blue ice: deep where it's thick, near white on its lit facets. A faint inner glow. */
export const ICE: Material = { ramp: ramp('#0b1a36', '#12325e', '#1c5490', '#3080c4', '#62b4e8', '#a8e2fa', '#e8fbff'), outline: hex('#050c1c'), outlineLit: hex('#14305a'), emissive: 0.12, shine: true };
/** Ice in shadow or seen through: the far facet of a crystal. */
export const ICE_DARK: Material = { ramp: ramp('#081428', '#0e2448', '#163a6e', '#22558e', '#3474ae'), outline: hex('#040a18'), emissive: 0.1 };
/** Ice lit from within: crystal cores, the heart of a spell. */
export const ICE_GLOW: Material = { ramp: ramp('#1c78c8', '#4ab8f4', '#9ae8ff', '#e0fcff', '#ffffff'), outline: hex('#0a2a50'), emissive: 0.85, noAO: true, shine: true };
/** Snow: blue in its shadows, white on top. */
export const SNOW: Material = { ramp: ramp('#4a5a80', '#6e80a8', '#98aacc', '#c2d2ea', '#e4eefa', '#fafdff'), outline: hex('#1c2640'), outlineLit: hex('#5a6a90') };
/** Hoarfrost crusting fur, stone or metal: snow with a sparkle. */
export const RIME: Material = { ramp: ramp('#6a7ea6', '#9ab0d2', '#c8daf0', '#ecf6ff'), outline: hex('#26304c'), emissive: 0.08, shine: true };

// ---------------------------------------------------------------- Bodies

/** White winter fur (a wolf, a yeti, a hare): blue in its folds. */
export const FUR_WHITE: Material = { ramp: ramp('#2e3650', '#4a5476', '#717d9e', '#9ea8c6', '#c8d0e4', '#eef2fa'), outline: INK, outlineLit: hex('#262c44') };
/** Grey-blue fur: a wolf's back, a lynx's spots. */
export const FUR_GREY: Material = { ramp: ramp('#141826', '#22283a', '#353e56', '#4c5874', '#687694', '#8a98b4'), outline: INK, outlineLit: hex('#1a2032') };
/** Dark fur and feathers: a raven's, a mammoth's shag. */
export const FUR_DARK: Material = { ramp: ramp('#0a0c14', '#141824', '#1e2436', '#2a3248', '#3a445e'), outline: INK };
/** Cold blue-grey hide (trolls, giants). */
export const HIDE: Material = { ramp: ramp('#18222f', '#263446', '#38495e', '#4e6278', '#687e96', '#8aa0b6'), outline: INK, outlineLit: hex('#1c2838') };
/** Pale frostbitten skin (the undead, the witch). */
export const PALE: Material = { ramp: ramp('#3a4458', '#5a6680', '#8492ac', '#b2bed2', '#dce4f0'), outline: INK, outlineLit: hex('#2a3246') };
/** Ivory: tusks, horns, beaks, claws. */
export const IVORY: Material = { ramp: ramp('#4a4436', '#766c56', '#a69a7e', '#d2c8ac', '#f2ecdc'), outline: INK, shine: true };
/** Bone, bleached and cold. */
export const BONE: Material = { ramp: ramp('#3e4250', '#646a7a', '#9298a6', '#c2c6d0', '#e8eaf0'), outline: INK };
/** Black beak, claws and hooves. */
export const HORN: Material = { ramp: ramp('#06080e', '#10141e', '#1c2232', '#2c3448', '#46506a'), outline: INK, shine: true };
/** A penguin's or a harpy's dark feathers: midnight blue. */
export const FEATHER: Material = { ramp: ramp('#080c1a', '#10182e', '#1a2646', '#263860', '#344c7c'), outline: INK, outlineLit: hex('#141e36') };

// ---------------------------------------------------------------- Made things

/** The colosseum's stone: cold blue-grey. */
export const STONE: Material = { ramp: ramp('#10151f', '#1c2332', '#2a3346', '#3c475e', '#55627a', '#748098', '#98a4b8'), outline: INK, outlineLit: hex('#1a2030') };
/** Old frost-iron armour: dark steel blued by the cold. */
export const IRON: Material = { ramp: ramp('#0a0f1a', '#151d2e', '#222e46', '#34445f', '#4e6080', '#7488a8', '#aabcd6'), outline: INK, outlineLit: hex('#18223a'), shine: true };
/** Silver trim and crowns. */
export const SILVER: Material = { ramp: ramp('#2a3044', '#4c5672', '#7a86a4', '#aeb8d0', '#dfe6f4', '#ffffff'), outline: INK, shine: true };
/** Pale gold, rare in the north: a crown's band, a king's clasp. */
export const GOLD: Material = { ramp: ramp('#3a2a14', '#6e5226', '#a68440', '#d8b866', '#f6e2a0', '#fffae0'), outline: INK, shine: true };
/** Deep winter cloth: robes and banners, midnight teal. */
export const CLOTH: Material = { ramp: ramp('#060e1a', '#0c1c30', '#13304a', '#1c4666', '#2a6084', '#3c7ea2'), outline: INK, outlineLit: hex('#0c1a2c') };
/** Royal violet cloth: the Winter King's mantle, the queen's lining. */
export const VELVET: Material = { ramp: ramp('#100a20', '#1e1236', '#2e1c50', '#422a6c', '#5a3c8c', '#7854ae'), outline: INK, outlineLit: hex('#1a1030') };
/** Leather and old wood. */
export const LEATHER: Material = { ramp: ramp('#140e0e', '#241a18', '#36282a', '#4a383a', '#604a4a'), outline: INK };

// ---------------------------------------------------------------- Light

/** Eyes and runes of cold light. Pure glow: draw them last. */
export const GLOW_ICE: Material = { ramp: ramp('#5ad2ff', '#c8f6ff', '#ffffff'), outline: INK, emissive: 1, noAO: true, noOutline: true };
/** The aurora's green. */
export const GLOW_AURORA: Material = { ramp: ramp('#2ad890', '#8affc8', '#eafff4'), outline: INK, emissive: 1, noAO: true, noOutline: true };
/** The aurora's violet. */
export const GLOW_VIOLET: Material = { ramp: ramp('#8a5aff', '#cdb4ff', '#f6f0ff'), outline: INK, emissive: 1, noAO: true, noOutline: true };
/** A cold red: the eyes of the worst of them. */
export const GLOW_RED: Material = { ramp: ramp('#ff3a5a', '#ffa0b0', '#fff0f2'), outline: INK, emissive: 1, noAO: true, noOutline: true };
/** A mouth or a socket: deep blue dark. */
export const HOLLOW: Material = { ramp: ramp('#02040a', '#060a16'), outline: INK, noAO: true, noOutline: true };

// Colours for sparks drawn straight into the glow layer (PixelCanvas.spark).
export const C_WHITE: RGB = hex('#ffffff');
export const C_ICE: RGB = hex('#9ae8ff');
export const C_ICE_DEEP: RGB = hex('#3ab0ff');
export const C_AURORA: RGB = hex('#5affb0');
export const C_TEAL: RGB = hex('#4ae8e0');
export const C_VIOLET: RGB = hex('#b48aff');
export const C_PINK: RGB = hex('#ff8ad8');

// ---------------------------------------------------------------- Tints (for debris, halos and lights)

export const ICE_TINTS = [0x9ae8ff, 0xe8fbff, 0x4ab0ff, 0xffffff];
export const SNOW_TINTS = [0xffffff, 0xdce8ff, 0xb0c4e8, 0xf0f6ff];
export const AURORA_TINTS = [0x5affb0, 0x4ae8e0, 0xb48aff, 0xffffff];
export const T_ICE = 0x9ae8ff;
export const T_ICE_DEEP = 0x3ab0ff;
export const T_AURORA = 0x5affb0;
export const T_TEAL = 0x4ae8e0;
export const T_VIOLET = 0xb48aff;
export const T_PINK = 0xff8ad8;
export const T_RED = 0xff5a72;

// ---------------------------------------------------------------- Helpers

/** Fill a polygon (points in pixel coordinates). */
export function poly(c: PixelCanvas, pts: [number, number][], m: Material, normal: (x: number, y: number) => Vec3 = () => FLAT): void {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) c.px(x, y, m, normal(x, y));
    }
  }
}

/**
 * A crystal of ice from its base (bx, by) to its tip (tx, ty), `r` wide at
 * the base: two facets, the one turned to the light bright, the other dark,
 * and a glint near the tip (when `glint` is a colour).
 */
export function crystal(c: PixelCanvas, bx: number, by: number, tx: number, ty: number, r: number, m: Material = ICE, glint: RGB | null = C_WHITE): void {
  const len = Math.hypot(tx - bx, ty - by) || 1;
  const ux = (tx - bx) / len;
  const uy = (ty - by) / len;
  const nx = -uy;
  const ny = ux;
  const mid = 0.7;
  const pts: [number, number][] = [
    [bx + nx * r, by + ny * r],
    [bx + ux * len * mid + nx * r * 0.85, by + uy * len * mid + ny * r * 0.85],
    [tx, ty],
    [bx + ux * len * mid - nx * r * 0.85, by + uy * len * mid - ny * r * 0.85],
    [bx - nx * r, by - ny * r],
  ];
  poly(c, pts, m, (x, y) => {
    const s = (x + 0.5 - bx) * nx + (y + 0.5 - by) * ny;
    return s * -(nx + ny) > 0 ? { x: -0.62, y: 0.32, z: 0.7 } : { x: 0.55, y: 0.08, z: 0.72 };
  });
  if (glint) c.spark(tx - ux * 1.2, ty - uy * 1.2, glint, 0.85);
}

/** Hanging icicles along a ledge from x0 to x1 at height y: thin, uneven, a glint on each. */
export function icicles(c: PixelCanvas, x0: number, x1: number, y: number, maxLen: number, seed: number, m: Material = ICE): void {
  let s = seed * 9301 + 49297;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let x = x0; x <= x1; x += 1 + Math.floor(rand() * 2)) {
    const len = 1 + Math.floor(rand() * maxLen);
    for (let k = 0; k < len; k++) c.px(x, y + k, m, { x: -0.3, y: 0.2, z: 0.9 });
    if (len > 2) c.spark(x, y + 1, C_WHITE, 0.4);
  }
}

// ---------------------------------------------------------------- Spell textures

/**
 * What a creature file is handed to register its own spell textures with
 * (see the 'frost' job in textures.ts). Keys should carry the file's prefix
 * so they never clash.
 */
export interface FxRegistrar {
  /**
   * Lit frames in one atlas `key` (with its `<key>_e` glow layer), each frame
   * named; drawn like a monster's (Lit pipeline, glow added on top).
   */
  frames(key: string, list: { name: string; canvas: PixelCanvas }[], w: number, h: number): void;
  /** One plain image: pure colour or light, drawn as is (ADD for light). */
  image(key: string, w: number, h: number, px: Uint8ClampedArray): void;
  /** Plain images side by side, frames `<prefix><i>`. */
  strip(key: string, w: number, h: number, frames: Uint8ClampedArray[], prefix?: string): void;
  /** An animation over frames of a texture already registered. */
  anim(key: string, texture: string, frames: string[], fps: number, loop: boolean): void;
}
