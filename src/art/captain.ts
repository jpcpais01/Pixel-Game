// The Drowned Captain: a pirate captain's ghost risen from the deep, glowing
// sea-green. A battered tricorne with a seaweed strand off its corner, a
// long coat dark with sea water and trimmed in tarnished brass, a leather
// baldric across a ruffled shirt, a beard with a barnacle grown in it, a
// cutlass in one hand and a flintlock in the other; below the coat his legs
// are only sea-mist, dripping. His Bone Admiral skin is a skeleton in an
// admiral's dress: a skull under a black bicorne with a violet plume, gold
// epaulettes and braid on a navy coat, his ribcage bare where it falls open,
// a crimson sash, and a slim sabre with a gold knuckle-bow; ghost-light and
// drips of violet.
//
// Also here: the 16x16 icons for his buttons.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB } from './pixel';
import { DIRS, type Dir } from './wizard';
import { icon16, seg, type Tones } from './druid';

const ramp = (...c: string[]): RGB[] => c.map(hex);

export const CAPTAIN_W = 48;
export const CAPTAIN_H = 50;
/** Drawn in the 24x32 body box every hero uses, placed in a larger frame. */
const BODY_X = 12;
const BODY_Y = 12;
export const CAPTAIN_ORIGIN_X = BODY_X + 12;
export const CAPTAIN_ORIGIN_Y = BODY_Y + 31;
/** The body's middle above the ground, where blows land and the hook leaves. */
export const CAPTAIN_CHEST_Y = 14;
/**
 * Where the pistol's muzzle is on the shot's firing frame, from his feet
 * (facing left for the side; mirror it for right), so the ball leaves the
 * barrel itself.
 */
export const CAPTAIN_MUZZLE: Record<'down' | 'up' | 'side', { x: number; y: number }> = {
  down: { x: 1, y: -10 },
  up: { x: -2, y: -21 },
  side: { x: -14, y: -17 },
};

// ---------------------------------------------------------------------------
// Materials

// The Drowned Captain.
const COAT: Material = { ramp: ramp('#06121a', '#0c2028', '#143238', '#1e4848', '#2c625e'), outline: hex('#010608'), outlineLit: hex('#071216') };
const TRIM: Material = { ramp: ramp('#33300e', '#5e5620', '#8e8238', '#beb05a', '#e8dc96'), outline: hex('#141104'), shine: true };
const HAT: Material = { ramp: ramp('#04080a', '#0a1418', '#122226', '#1c3234'), outline: hex('#010304'), outlineLit: hex('#060c0e') };
const GHOST: Material = { ramp: ramp('#103a32', '#1a5a4c', '#2a7e6a', '#46a68c', '#78d0b6'), outline: hex('#061c18'), emissive: 0.26 };
const BEARD: Material = { ramp: ramp('#0a1c1a', '#142e2a', '#20443c', '#325c50', '#4a7a6a'), outline: hex('#030a09'), emissive: 0.08 };
const SHIRT: Material = { ramp: ramp('#2e5c54', '#4e867c', '#7cb4a8', '#b0e0d4'), outline: hex('#10302a'), emissive: 0.1 };
const LEATHER: Material = { ramp: ramp('#120a06', '#26180e', '#3e2c1a', '#584026'), outline: hex('#060302') };
const SEAWEED: Material = { ramp: ramp('#0a2c14', '#184c20', '#2c722e', '#4c983c'), outline: hex('#04120a'), noAO: true, emissive: 0.1 };
const BARNACLE: Material = { ramp: ramp('#56564a', '#8a8672', '#c0baa0', '#ebe5ca'), outline: hex('#1a1810'), shine: true };
const SOUL: Material = { ramp: ramp('#2ac8a0', '#8affe0', '#ecfff9'), outline: hex('#063a2a'), emissive: 1, noAO: true, noOutline: true };
const MIST: Material = { ramp: ramp('#184a40', '#2c7464', '#4ca48e', '#82d6be'), outline: hex('#0a201c'), emissive: 0.45, noAO: true, noOutline: true };
const WATER: Material = { ramp: ramp('#38c0a0', '#8af0d8', '#e2fff7'), outline: hex('#0a3a30'), emissive: 0.85, noAO: true, noOutline: true };
const CUTLASS: Material = { ramp: ramp('#1c2a2e', '#3c585c', '#6c9092', '#a6cac6', '#e4fff8'), outline: hex('#071012'), shine: true, emissive: 0.14 };
const ROPE: Material = { ramp: ramp('#1e5a4c', '#3c947c', '#78d4b6'), outline: hex('#0a2a22'), emissive: 0.5, noAO: true };
const HOOK: Material = { ramp: ramp('#14262a', '#2e4c50', '#5a8a86', '#9ad4c6'), outline: hex('#040a0c'), shine: true, emissive: 0.3 };
const FLASH: Material = { ramp: ramp('#4affc0', '#c0fff0', '#ffffff'), outline: hex('#0a3a2a'), emissive: 1, noAO: true, noOutline: true };
const SMOKE: Material = { ramp: ramp('#245e50', '#3e8a76', '#6abaa4'), outline: hex('#0a2420'), emissive: 0.45, noAO: true, noOutline: true };

// Both.
const WOOD: Material = { ramp: ramp('#1c0e06', '#38200e', '#58361a', '#7a5028'), outline: hex('#0a0503') };
const IRON: Material = { ramp: ramp('#0a0c10', '#1a2026', '#303a42', '#4c5a64', '#7a8a94'), outline: hex('#030405'), shine: true };
const VOID: Material = { ramp: ramp('#020304', '#06090c'), outline: hex('#000000'), noAO: true };
const GLASS: Material = { ramp: ramp('#14482c', '#227a46', '#36a864', '#6cd890', '#c4ffd8'), outline: hex('#030e08'), shine: true, emissive: 0.15 };
const CORK: Material = { ramp: ramp('#4a3418', '#7a5a30', '#a8844a'), outline: hex('#1a1006') };
const LABEL: Material = { ramp: ramp('#8a7a56', '#c4b48a', '#ece0b8'), outline: hex('#2a2210'), noOutline: true };
const RUM: Material = { ramp: ramp('#a8500a', '#f09a2a', '#ffd070', '#fff4c8'), outline: hex('#3a1a02'), emissive: 0.9, noAO: true, noOutline: true };

// The Bone Admiral.
const NAVY: Material = { ramp: ramp('#04051a', '#0a0f32', '#131b4c', '#1d2b6a', '#2c3f8c'), outline: hex('#010208'), outlineLit: hex('#05081a') };
const GOLD: Material = { ramp: ramp('#4a2e08', '#8a5e14', '#c8922a', '#f0c44c', '#fff2a8'), outline: hex('#1a1004'), shine: true };
const BICORNE: Material = { ramp: ramp('#040408', '#0a0a14', '#141422', '#202034'), outline: hex('#000002'), outlineLit: hex('#06060c') };
const PLUME: Material = { ramp: ramp('#3a1a6a', '#6a3aaa', '#a070e0', '#d4b4ff', '#f6eeff'), outline: hex('#14062a'), emissive: 0.3 };
const SKULL: Material = { ramp: ramp('#5c5646', '#968e76', '#c8c0a2', '#ebe5ca', '#fffaea'), outline: hex('#1a1610'), shine: true, emissive: 0.06 };
const VSOUL: Material = { ramp: ramp('#8a4ae0', '#d0a8ff', '#f8f0ff'), outline: hex('#2a0a5a'), emissive: 1, noAO: true, noOutline: true };
const VMIST: Material = { ramp: ramp('#28184a', '#4c3284', '#7c5abe', '#ae8ef0'), outline: hex('#140a2a'), emissive: 0.45, noAO: true, noOutline: true };
const VDRIP: Material = { ramp: ramp('#8a5ae0', '#d4bcff', '#fbf6ff'), outline: hex('#2a1450'), emissive: 0.85, noAO: true, noOutline: true };
const SASH: Material = { ramp: ramp('#30060e', '#5c1020', '#8c1e30', '#ba3646'), outline: hex('#120206'), outlineLit: hex('#22040a') };
const SABRE: Material = { ramp: ramp('#22243a', '#464a66', '#868caa', '#c6cadf', '#ffffff'), outline: hex('#08080e'), shine: true, emissive: 0.12 };
const GRIP: Material = { ramp: ramp('#8a8478', '#c8c2b0', '#f0ecdc'), outline: hex('#26221a') };
const VROPE: Material = { ramp: ramp('#3a2470', '#6a4ab0', '#a888e8'), outline: hex('#140a2a'), emissive: 0.5, noAO: true };
const VHOOK: Material = { ramp: ramp('#1c1a30', '#3a3658', '#6a6494', '#aca4dc'), outline: hex('#06050c'), shine: true, emissive: 0.3 };
const VFLASH: Material = { ramp: ramp('#a070ff', '#e8d8ff', '#ffffff'), outline: hex('#2a0a5a'), emissive: 1, noAO: true, noOutline: true };
const VSMOKE: Material = { ramp: ramp('#3a2a62', '#5c468e', '#8a74c0'), outline: hex('#140a2a'), emissive: 0.45, noAO: true, noOutline: true };

export interface CaptainLook {
  key: string;
  /** The Bone Admiral: a skeleton in an admiral's coat and bicorne, lit violet. */
  admiral: boolean;
}

export const CAPTAIN_LOOK: CaptainLook = { key: 'captain', admiral: false };
export const ADMIRAL_LOOK: CaptainLook = { key: 'captain_admiral', admiral: true };
export const CAPTAIN_LOOKS = [CAPTAIN_LOOK, ADMIRAL_LOOK];

let L: CaptainLook = CAPTAIN_LOOK;

/** The look's materials, so each part draws the same way for both. */
interface Mats {
  coat: Material;
  trim: Material;
  skin: Material;
  mist: Material;
  drip: Material;
  soul: Material;
  blade: Material;
  rope: Material;
  hook: Material;
  flash: Material;
  smoke: Material;
  /** Its ghost-light, for sparks. */
  glow: RGB;
}

const CAPTAIN_M: Mats = { coat: COAT, trim: TRIM, skin: GHOST, mist: MIST, drip: WATER, soul: SOUL, blade: CUTLASS, rope: ROPE, hook: HOOK, flash: FLASH, smoke: SMOKE, glow: [110, 255, 200] };
const ADMIRAL_M: Mats = { coat: NAVY, trim: GOLD, skin: SKULL, mist: VMIST, drip: VDRIP, soul: VSOUL, blade: SABRE, rope: VROPE, hook: VHOOK, flash: VFLASH, smoke: VSMOKE, glow: [200, 150, 255] };
let M: Mats = CAPTAIN_M;

type View = 'down' | 'up' | 'side';

interface Pt {
  x: number;
  y: number;
}

/**
 * A pose. Hands are offsets from their own shoulder: `x` outward from the
 * body (in the side view, forward), `y` down. Angles are in the same frame:
 * 0 points outward (forward), PI/2 down.
 */
export interface CaptainPose {
  /** Floated up (+) or sunk. */
  bob: number;
  /** The mist's curl, the seaweed's sway, the drips' fall. */
  wave: number;
  /** Leaning into it (side view), px. */
  lean: number;
  /** The coat's tails streaming back. */
  tails: number;
  sword: Pt;
  /** The cutlass's angle. */
  ang: number;
  gun: Pt;
  gunAng: number;
  /** The pistol pointed at the viewer (1) or away (-1), seen end-on. */
  fore: 0 | 1 | -1;
  /** The pistol stuck in his belt, the hand free. */
  holster: boolean;
  /** The muzzle's flash, and the smoke after it, 0..1. */
  flash: number;
  smoke: number;
  /** 0..1: eyes blazing. */
  glare: number;
  /** The grappling hook held at this offset from the gun hand, swung on its rope (screen px, view's own). */
  hook: Pt | null;
  /** The rope paid out from the gun hand towards this offset (the hook gone). */
  rope: Pt | null;
  /** The bottle in the gun hand, tipped this far from upright towards his mouth (radians); or flung off, at `flung`. */
  bottle: number | null;
  flung: Pt | null;
  /** 0..1 the rum running down through him, past 1 the last of it dripping out. */
  pour: number;
  /** His head tipped back (-1) or looking down (+1). */
  head: number;
  /** Arms in front of him (drawn behind his back in the up view). */
  reach: boolean;
}

const base = (view: View): CaptainPose => ({
  bob: 0,
  wave: 0,
  lean: 0,
  tails: 0,
  sword: view === 'side' ? { x: 1.8, y: 6 } : { x: 1.4, y: 6 },
  ang: view === 'side' ? Math.PI / 2 - 0.55 : Math.PI / 2 - 0.45,
  gun: view === 'side' ? { x: -0.8, y: 5.8 } : { x: 1.4, y: 6 },
  gunAng: view === 'side' ? Math.PI / 2 - 0.35 : Math.PI / 2 - 0.15,
  fore: 0,
  holster: false,
  flash: 0,
  smoke: 0,
  glare: 0,
  hook: null,
  rope: null,
  bottle: null,
  flung: null,
  pour: 0,
  head: 0,
  reach: false,
});

/** A steady 0..1 per pixel, so the same pixels go first in every frame. */
const hash = (x: number, y: number): number => {
  const h = Math.imul(Math.round(x) * 374761393 + Math.round(y) * 668265263, 1274126177) >>> 0;
  return (((h ^ (h >>> 13)) >>> 0) % 1000) / 1000;
};
const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));
const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;

// ---------------------------------------------------------------------------
// The figure (body-box coordinates: 24 wide, the ground at y 31; he floats)

interface Frame {
  side: boolean;
  view: View;
  cx: number;
  headX: number;
  headY: number;
  top: number;
  waist: number;
  hem: number;
}

/** A strand of seaweed hanging from (x, y), swaying. */
function weed(c: PixelCanvas, x: number, y: number, len: number, wave: number, seed = 0): void {
  for (let i = 0; i <= len; i++) {
    const sx = Math.round(Math.sin(wave * 1.3 + i * 0.9 + seed) * 0.6 * (i / len));
    c.px(Math.round(x) + sx, Math.round(y) + i, SEAWEED, sphere(sx * 0.5, 0.2), { bias: i === len ? -1 : (i + seed) % 2 });
  }
}

/** Drips falling from (x, y): one drop a few px under, further each frame. */
function drip(c: PixelCanvas, x: number, y: number, wave: number, seed: number, fall = 5): void {
  const k = (wave * 1.7 + seed * 2.3) % fall;
  c.px(Math.round(x), Math.round(y + 1 + k), M.drip, { x: 0, y: 0.2, z: 1 }, { bias: k < 1.5 ? 1 : 0 });
}

/** His legs: only sea-mist, two columns thinning to wisps under the coat, dripping. */
function legs(c: PixelCanvas, f: Frame, p: CaptainPose): void {
  const { cx, waist, hem, side } = f;
  const bot = hem + 5;
  const cols = side ? [cx + 0.6] : [cx - 1.7, cx + 1.7];
  cols.forEach((lx, li) => {
    for (let y = Math.round(waist + 1); y <= bot; y++) {
      const u = (y - waist) / (bot - waist);
      const w = (side ? 1.9 : 1.5) * (1 - u * 0.35);
      const xc = lx + Math.sin(y * 0.7 + p.wave * 1.4 + li * 2) * u * 0.8 + (side ? p.tails * u * 0.9 + p.lean * u * 0.6 : 0);
      for (let x = Math.round(xc - w); x < xc + w; x++) {
        if (u > 0.5 && hash(x, y + Math.round(p.wave) * 7) < (u - 0.5) * 2.2) continue;
        c.px(x, y, M.mist, cyl(((x + 0.5 - xc) / w) * 0.9, 0.1));
      }
    }
  });
  // Wisps curling off the bottom, and drips.
  for (let i = 0; i < 4; i++) {
    const a = p.wave * 1.1 + i * 1.7;
    const x = Math.round(cx - 3 + i * 2 + Math.sin(a) * 1.2 + (side ? p.tails : 0));
    const y = Math.round(bot + 1 + ((i * 3 + Math.round(p.wave)) % 3) * 0.5);
    if ((i + Math.round(p.wave)) % 3 === 0) continue;
    c.px(x, y, M.mist, { x: 0, y: 0, z: 1 });
  }
}

/** The coat: shoulders to a tattered skirt, open down the front over the mist, its trim, belt and strap. */
function coat(c: PixelCanvas, f: Frame, p: CaptainPose): void {
  const { cx, top, waist, hem, side, view } = f;
  const adm = L.admiral;
  const lean = side ? p.lean : 0;
  // The upper body leans further forward than the hem.
  const sx = (y: number) => -lean * clamp01((hem - y) / (hem - top)) * 0.8;
  const torso = (y: number): [number, number] => {
    const u = (y - top) / (waist - top);
    let hw = side ? 2.9 - u * 0.3 : 4.4 - u * 0.9;
    if (y - top < 1) hw -= 1;
    return [cx - hw + sx(y), cx + hw + sx(y)];
  };
  const skirt = (y: number): [number, number] => {
    const u = (y - waist) / (hem - waist);
    const hw = side ? 2.9 + u * 1.4 : 3.6 + u * 2.1;
    if (side) return [cx - hw * 0.8 + sx(y), cx + hw + p.tails * u * 1.6 + u + sx(y)];
    return [cx - hw, cx + hw];
  };
  const gapT = (y: number) => 2.1 * (1 - (y - top) / (waist - top)) + 0.55;
  const gapS = (y: number) => 0.7 + ((y - waist) / (hem - waist)) * 2.3;
  const front = view === 'down';

  // The skirt: in front it parts over the mist; ragged at the hem, a tatter or two below it.
  c.part();
  for (let y = Math.round(waist); y <= hem + 1; y++) {
    const [l, r] = skirt(Math.min(y, hem));
    const g = gapS(Math.min(y, hem));
    for (let x = Math.round(l); x < Math.round(r); x++) {
      const mx = x + 0.5 - cx;
      if (front && Math.abs(mx) < g) continue;
      if (y === Math.round(hem) && hash(x, 3) > 0.62) continue;
      if (y > hem && hash(x, 5) < 0.72) continue;
      const t = ((x + 0.5 - l) / (r - l)) * 2 - 1;
      c.px(x, y, M.coat, sphere(t * 0.85, -0.15 - ((y - waist) / (hem - waist)) * 0.3, 1));
    }
  }
  // Folds down the skirt.
  for (let y = Math.round(waist + 2); y <= hem; y++) {
    const [l, r] = skirt(y);
    c.shade(Math.round(lerp(l, r, 0.22)), y, -1);
    c.shade(Math.round(lerp(l, r, 0.78)), y, -1);
    if (view === 'up') c.shade(Math.round(cx - 0.5), y, -1);
  }

  // The torso.
  c.part();
  c.shape(Math.round(top), Math.round(waist) - 1, (y) => {
    if (!front) return torso(y);
    return torso(y);
  }, M.coat, (_x, y, t) => sphere(t * 0.9, 0.3 - ((y - top) / (waist - top)) * 0.4, 1));

  if (front) {
    // Open down the front: the shirt and its ruffles (or, on the admiral, his ribs).
    c.part();
    for (let y = Math.round(top); y < waist - 1; y++) {
      const g = gapT(y);
      for (let x = Math.round(cx - g); x < Math.round(cx + g); x++) {
        if (adm) {
          const row = (y - Math.round(top)) % 2 === 1;
          const spine = x === Math.round(cx - 0.5);
          if (spine || (row && y < waist - 2)) c.px(x, y, SKULL, sphere((x + 0.5 - cx) / 2.5, 0.2), { bias: spine ? 0 : -1 });
          else c.px(x, y, VOID, { x: 0, y: 0, z: 1 });
        } else {
          const jabot = y - top < 3;
          c.px(x, y, SHIRT, sphere((x + 0.5 - cx) / (g + 0.5), 0.2), { bias: jabot ? ((x + y) % 2 ? 1 : 0) : -1 + ((x + y) % 3 === 0 ? 1 : 0) });
        }
      }
      // Lapels: trim on both edges.
      c.px(Math.round(cx - g) - 1, y, M.trim, sphere(-0.4, 0.3), { bias: adm ? 0 : -1 });
      c.px(Math.round(cx + g), y, M.trim, sphere(0.4, 0.3), { bias: adm ? 0 : -1 });
      // The admiral's double row of gold buttons.
      if (adm && (y - Math.round(top)) % 2 === 0 && y > top + 1) {
        c.px(Math.round(cx - g) - 2, y, GOLD, sphere(-0.2, -0.4), { bias: 1 });
        c.px(Math.round(cx + g) + 1, y, GOLD, sphere(0.2, -0.4), { bias: 1 });
      }
    }
    if (adm) {
      // A violet glow in the hollow of his ribs.
      c.spark(cx - 0.5, waist - 3, M.glow, 0.45);
      c.spark(cx - 0.5, waist - 4, M.glow, 0.25);
    }
    // The skirt's open edges, trimmed.
    for (let y = Math.round(waist); y <= hem; y++) {
      const g = gapS(y);
      if (c.filled(Math.round(cx - g) - 1, y)) c.px(Math.round(cx - g) - 1, y, M.trim, sphere(-0.3, 0.2), { bias: -1 });
      if (c.filled(Math.round(cx + g), y)) c.px(Math.round(cx + g), y, M.trim, sphere(0.3, 0.2), { bias: -1 });
    }
  } else if (view === 'up') {
    // The collar and the seam down the back.
    for (let x = Math.round(cx - 2.5); x < cx + 2.5; x++) c.px(x, Math.round(top), M.trim, sphere((x + 0.5 - cx) / 3, 0.5), { bias: -1 });
    for (let y = Math.round(top + 1); y < waist; y++) c.shade(Math.round(cx - 0.5), y, -1);
  } else {
    // Side: the lapel's edge down his front, buttons on the admiral.
    for (let y = Math.round(top + 1); y < waist; y++) {
      const [l] = torso(y);
      c.px(Math.round(l), y, M.trim, sphere(-0.5, 0.2), { bias: -1 });
      if (adm && (y - Math.round(top)) % 2 === 0) c.px(Math.round(l) + 1, y, GOLD, sphere(-0.2, -0.4), { bias: 1 });
    }
  }

  // The belt (the admiral's crimson sash, knotted at his side).
  c.part();
  const by = Math.round(waist) - 1;
  for (const y of [by, by + 1]) {
    const [l, r] = y < waist ? torso(y) : skirt(y);
    for (let x = Math.round(l); x < Math.round(r); x++) {
      if (front && y > by && Math.abs(x + 0.5 - cx) < gapS(y)) continue;
      c.px(x, y, adm ? SASH : LEATHER, cyl(((x + 0.5 - l) / (r - l)) * 2 - 1, y === by ? 0.4 : -0.2));
    }
  }
  if (front) {
    if (adm) {
      // The sash's knot and tails at his hip.
      c.ellipse(cx + 3.2, by + 0.6, 1.1, 1, SASH);
      c.capsule(cx + 3.4, by + 1.5, cx + 3.8 + Math.sin(p.wave) * 0.4, by + 4.5, 0.7, 0.5, SASH);
    } else {
      // A brass buckle, and the baldric from his right shoulder across to the left hip.
      c.px(Math.round(cx - 1), by, TRIM, sphere(-0.3, -0.3), { bias: 1 });
      c.px(Math.round(cx), by, TRIM, sphere(0.3, -0.3));
      c.px(Math.round(cx - 1), by + 1, TRIM, sphere(-0.3, 0.3), { bias: -1 });
      c.px(Math.round(cx), by + 1, TRIM, sphere(0.3, 0.3), { bias: -1 });
      c.part();
      c.line(cx - 3.6, top + 0.4, cx + 3.2, by - 0.6, LEATHER, () => sphere(0, -0.3));
      c.line(cx - 2.6, top + 0.4, cx + 3.8, by - 1.2, LEATHER, () => sphere(0, 0.3));
      c.px(Math.round(cx - 0.3), Math.round(lerp(top, by, 0.5)), TRIM, sphere(0, -0.5));
    }
  } else if (side) {
    const [l] = torso(by);
    c.px(Math.round(l) + 1, by, adm ? GOLD : TRIM, sphere(-0.3, -0.3), { bias: 1 });
  }

  if (!adm) {
    // Seaweed caught on the coat: over one shoulder, and hanging from the hem.
    c.part();
    const sh = side ? cx + 1.5 + sx(top) : view === 'down' ? cx + 3.4 : cx - 3.4;
    weed(c, sh, top + 0.5, 4, p.wave, 1);
    const [hl, hr] = skirt(hem);
    weed(c, lerp(hl, hr, 0.15), hem + 1, 3, p.wave, 2);
    if (!side) weed(c, lerp(hl, hr, 0.82), hem + 1, 2, p.wave, 4);
    else weed(c, hr - 1, hem, 3, p.wave, 3);
    // A crust of barnacles on the skirt.
    c.part();
    const bx = Math.round(lerp(hl, hr, view === 'up' ? 0.3 : 0.7));
    c.px(bx, Math.round(hem - 2), BARNACLE, sphere(-0.3, -0.4), { bias: 1 });
    c.px(bx + 1, Math.round(hem - 1), BARNACLE, sphere(0.3, -0.1));
  }
  // Water (or ectoplasm) dripping from the hem.
  const [dl, dr] = skirt(hem);
  for (let i = 0; i < 3; i++) drip(c, lerp(dl, dr, 0.2 + i * 0.3), hem + 1, p.wave, i, 4);
}

/** A sleeve from the shoulder to the hand: a turned-back cuff, and a ghostly (or bony) hand. */
function arm(c: PixelCanvas, s: Pt, h: Pt): void {
  c.part();
  c.capsule(s.x, s.y, h.x, h.y, 1.45, 1.2, M.coat);
  const cx = lerp(s.x, h.x, 0.78);
  const cy = lerp(s.y, h.y, 0.78);
  c.ellipse(cx, cy, 1.4, 1.3, M.trim, { bias: L.admiral ? 0 : -1 });
  hand(c, h.x, h.y);
}

function hand(c: PixelCanvas, x: number, y: number): void {
  c.part();
  if (L.admiral) {
    // Bones: a knuckle and a finger curled round the grip.
    c.ellipse(x, y, 0.85, 0.85, SKULL);
    c.px(Math.round(x - 0.5), Math.round(y + 0.6), SKULL, sphere(0, 0.6), { bias: -1 });
  } else c.ellipse(x, y, 0.95, 0.95, GHOST);
}

/** The admiral's epaulette: a gold pad on the shoulder, its fringe hanging. */
function epaulette(c: PixelCanvas, x: number, y: number, w: number): void {
  c.part();
  c.ellipse(x, y, w, 1, GOLD, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.6 - 0.3, 1) });
  for (let fx = Math.round(x - w); fx < x + w; fx++) {
    c.px(fx, Math.round(y + 1), GOLD, sphere(0, 0.4), { bias: fx % 2 ? 0 : -1 });
    if (fx % 2 === 0) c.px(fx, Math.round(y + 2), GOLD, sphere(0, 0.6), { bias: -1 });
  }
}

/** The cutlass (the admiral's sabre): a broad, curved blade from the hand, a brass cup guard over it. */
function blade(c: PixelCanvas, hx: number, hy: number, a: number): void {
  const adm = L.admiral;
  const len = adm ? 10 : 8.5;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  // The edge bows out to one side, the spine on the other.
  const nx = -uy;
  const ny = ux;
  c.part();
  // Pommel and grip behind the hand.
  c.px(Math.round(hx - ux * 1.6), Math.round(hy - uy * 1.6), adm ? GOLD : TRIM, sphere(-ux * 0.5, uy * 0.5));
  if (adm) c.px(Math.round(hx - ux * 0.8), Math.round(hy - uy * 0.8), GRIP);
  c.part();
  for (let i = 1; i <= len; i += 0.5) {
    const t = i / len;
    const bend = t * t * (adm ? 0.9 : 1.6);
    const bx = hx + ux * (i + 0.6) + nx * bend;
    const by = hy + uy * (i + 0.6) + ny * bend;
    const tip = i > len - 1;
    c.px(Math.round(bx), Math.round(by), M.blade, { x: -0.35 + nx * 0.2, y: 0.45, z: 0.82 }, { bias: tip ? 1 : 0 });
    // The broad back of a cutlass; a thin spine on the sabre.
    if (i < len - (adm ? 4 : 2)) c.px(Math.round(bx - nx), Math.round(by - ny), M.blade, { x: nx * 0.4, y: -0.2, z: 0.85 }, { bias: -1 });
  }
  hand(c, hx, hy);
  c.part();
  if (adm) {
    // The knuckle-bow: a gold guard curving round the hand to the pommel.
    for (let i = 0; i < 4; i++) {
      const q = (i / 3) * Math.PI;
      c.px(Math.round(hx + ux * (0.6 - (1 - Math.cos(q)) * 1.1) + nx * Math.sin(q) * 1.6), Math.round(hy + uy * (0.6 - (1 - Math.cos(q)) * 1.1) + ny * Math.sin(q) * 1.6), GOLD, sphere(nx * 0.5, -0.3), { bias: i === 1 ? 1 : 0 });
    }
  } else {
    // The cup over the hand, its quillon.
    c.px(Math.round(hx + ux * 0.9 + nx), Math.round(hy + uy * 0.9 + ny), TRIM, sphere(nx * 0.5, -0.4), { bias: 1 });
    c.px(Math.round(hx + ux * 0.9 - nx), Math.round(hy + uy * 0.9 - ny), TRIM, sphere(-nx * 0.5, -0.4));
    c.px(Math.round(hx + ux * 0.9 - nx * 2), Math.round(hy + uy * 0.9 - ny * 2), TRIM, sphere(-nx * 0.5, 0), { bias: -1 });
  }
  // A glint of ghost-light along the edge.
  c.spark(hx + ux * (len * 0.6) + nx * 0.6, hy + uy * (len * 0.6) + ny * 0.6, M.glow, 0.25);
}

/** The flintlock in the hand: barrel and stock, or seen end-on. Returns the muzzle. */
function pistol(c: PixelCanvas, hx: number, hy: number, a: number, fore: 0 | 1 | -1): Pt {
  const brass = L.admiral ? GOLD : TRIM;
  c.part();
  if (fore === 1) {
    // Pointed at the viewer: the muzzle's dark ring, the lock's brass behind.
    c.px(Math.round(hx + 1), Math.round(hy - 1), brass, sphere(0.4, -0.5));
    hand(c, hx, hy);
    c.part();
    c.ellipse(hx, hy + 1.3, 1.25, 1.1, IRON);
    c.px(Math.round(hx - 0.5), Math.round(hy + 1.2), VOID);
    return { x: hx, y: hy + 1.4 };
  }
  if (fore === -1) {
    // Pointed away: the barrel over the hand, the stock under it.
    c.px(Math.round(hx), Math.round(hy + 1), WOOD, sphere(0, 0.4));
    c.line(hx, hy - 0.5, hx, hy - 3.5, IRON, () => sphere(-0.4, 0.2));
    c.px(Math.round(hx + 1), Math.round(hy - 1), brass);
    hand(c, hx, hy);
    return { x: hx, y: hy - 4 };
  }
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  // The side of the barrel the grip hangs from: the one towards the ground.
  let px = -uy;
  let py = ux;
  if (py < 0 || (py === 0 && px < 0)) {
    px = -px;
    py = -py;
  }
  c.line(hx - ux * 0.3 + px * 0.6, hy - uy * 0.3 + py * 0.6, hx - ux * 1.4 + px * 2.2, hy - uy * 1.4 + py * 2.2, WOOD, () => sphere(-0.3, 0.2));
  c.px(Math.round(hx - ux * 1.6 + px * 2.6), Math.round(hy - uy * 1.6 + py * 2.6), brass, sphere(-0.2, 0.4));
  for (let i = 0.5; i <= 3; i += 0.5) c.px(Math.round(hx + ux * i + px * 0.8), Math.round(hy + uy * i + py * 0.8), WOOD, sphere(0, 0.5), { bias: -1 });
  for (let i = 0.5; i <= 5; i += 0.5) c.px(Math.round(hx + ux * i), Math.round(hy + uy * i), IRON, sphere(0, -0.4), { bias: i > 4.4 ? -1 : 0 });
  c.px(Math.round(hx + ux * 0.6 - px * 0.9), Math.round(hy + uy * 0.6 - py * 0.9), brass, sphere(0, -0.6), { bias: 1 });
  hand(c, hx, hy);
  return { x: hx + ux * 5.5, y: hy + uy * 5.5 };
}

/** The muzzle's flash and the smoke after it. `dx, dy` is the way it points. */
function gunfire(c: PixelCanvas, m: Pt, dx: number, dy: number, p: CaptainPose): void {
  c.part();
  if (p.flash > 0) {
    c.ellipse(m.x, m.y, 1.3, 1.3, M.flash);
    for (let i = 1; i <= 3; i++) c.px(Math.round(m.x + dx * i), Math.round(m.y + dy * i), M.flash, { x: 0, y: 0, z: 1 }, { bias: i === 1 ? 2 : 1 });
    for (const s of [-1, 1]) c.px(Math.round(m.x + dx * 1.5 - dy * s * 1.6), Math.round(m.y + dy * 1.5 + dx * s * 1.6), M.flash, { x: 0, y: 0, z: 1 });
    for (let k = 0; k < 10; k++) {
      const q = (k / 10) * Math.PI * 2;
      c.spark(m.x + Math.cos(q) * 2.6, m.y + Math.sin(q) * 2.6, M.glow, 0.35 * p.flash);
    }
  }
  if (p.smoke > 0) {
    // Puffs drifting up and away, thinning.
    for (let i = 0; i < 3; i++) {
      const k = p.smoke;
      const x = m.x + dx * (1 + i * 1.3) * k - i * 0.5 + Math.sin(i * 2 + k * 3) * 0.7;
      const y = m.y + dy * (1 + i * 1.3) * k - k * (2 + i * 1.5);
      const r = 0.8 + k * 0.7 + i * 0.2;
      for (let yy = Math.floor(y - r); yy <= y + r; yy++) {
        for (let xx = Math.floor(x - r); xx <= x + r; xx++) {
          const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y) / r;
          if (d > 1 || hash(xx * 3 + i, yy) < k * 0.75 - 0.15) continue;
          c.px(xx, yy, M.smoke, sphere((xx + 0.5 - x) / r, (yy + 0.5 - y) / r, 0.8), { bias: d < 0.5 ? 1 : 0 });
        }
      }
    }
  }
}

/** The grappling hook: a shank, three curved tines and a ring, its rope back to the hand. */
function hookHeld(c: PixelCanvas, hx: number, hy: number, kx: number, ky: number): void {
  c.part();
  c.line(hx, hy, kx, ky, M.rope, () => ({ x: 0, y: 0, z: 1 }));
  const dx = kx - hx;
  const dy = ky - hy;
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l;
  const uy = dy / l;
  c.part();
  c.line(kx, ky, kx + ux * 2.5, ky + uy * 2.5, M.hook, () => sphere(-0.3, -0.3));
  const tx = kx + ux * 2.5;
  const ty = ky + uy * 2.5;
  for (const s of [-1, 1]) {
    c.px(Math.round(tx - uy * s * 1.2), Math.round(ty + ux * s * 1.2), M.hook, sphere(-uy * s * 0.5, 0), { bias: 1 });
    c.px(Math.round(tx - uy * s * 1.6 - ux), Math.round(ty + ux * s * 1.6 - uy), M.hook, sphere(-uy * s * 0.5, 0.3));
  }
  c.spark(tx, ty, M.glow, 0.5);
}

/** The bottle in the hand, tipped `tilt` from upright, the neck towards his mouth (screen-left of the hand). */
function bottle(c: PixelCanvas, hx: number, hy: number, tilt: number): void {
  const dx = -Math.sin(tilt);
  const dy = -Math.cos(tilt);
  c.part();
  c.capsule(hx - dx * 1.2, hy - dy * 1.2, hx + dx * 2.2, hy + dy * 2.2, 1.3, 1.2, GLASS);
  c.capsule(hx + dx * 3.1, hy + dy * 3.1, hx + dx * 4.3, hy + dy * 4.3, 0.55, 0.5, GLASS);
  c.px(Math.round(hx + dx * 4.9), Math.round(hy + dy * 4.9), CORK);
  c.px(Math.round(hx + dx * 0.4), Math.round(hy + dy * 0.4), LABEL, { x: 0, y: 0, z: 1 });
  hand(c, hx + dx * 0.4 + 0.5, hy + dy * 0.4);
}

// --- Heads ------------------------------------------------------------------

/** The Captain's face, front on: ghost-pale under the brim, eyes lit, a beard with a barnacle grown in it. */
function captainFace(c: PixelCanvas, hx: number, hy: number, p: CaptainPose): void {
  c.part();
  // Sideburns.
  for (const s of [-1, 1]) c.capsule(hx + s * 2.7, hy - 1, hx + s * 2.6, hy + 2, 0.8, 0.9, BEARD);
  c.part();
  c.ellipse(hx, hy, 2.8, 3, GHOST, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.7, 1) });
  // The brim's shadow over his brow.
  for (let x = Math.round(hx - 3); x < hx + 3; x++) {
    c.shade(x, Math.round(hy - 2.5), -2);
    c.shade(x, Math.round(hy - 1.5), -1);
  }
  c.part();
  const ey = Math.round(hy - 0.6 + (p.head > 0 ? 1 : 0));
  for (const ex of [hx - 1.5, hx + 1]) {
    c.px(Math.round(ex), ey, SOUL, { x: 0, y: 0, z: 1 }, { glow: 0.8 + p.glare * 0.2 });
    if (p.glare > 0) c.spark(ex, ey, M.glow, p.glare * 0.7);
  }
  c.shade(Math.round(hx - 0.5), Math.round(hy + 0.6), 1);
  // The beard: full under the moustache, to a forked point.
  c.part();
  const b0 = hy + 1.2;
  const b1 = hy + 5.3;
  c.shape(Math.round(b0), Math.round(b1), (y) => {
    const u = (y - b0) / (b1 - b0);
    const hw = 3.1 * (1 - u * 0.72);
    return [hx - hw, hx + hw];
  }, BEARD, (_x, y, t) => sphere(t * 0.8, 0.25 - ((y - b0) / (b1 - b0)) * 0.6, 1));
  for (let y = Math.round(b0 + 2); y <= b1; y++) if ((y & 1) === 0) c.shade(Math.round(hx - 1), y, -1);
  c.erase(Math.round(hx - 0.5), Math.round(b1));
  // The moustache, drooping at its ends.
  for (let x = Math.round(hx - 2.4); x <= hx + 1.4; x++) c.px(x, Math.round(hy + 1.4), BEARD, sphere((x + 0.5 - hx) / 3, -0.4), { bias: 1 });
  c.px(Math.round(hx - 2.6), Math.round(hy + 2.4), BEARD, sphere(-0.5, 0));
  c.px(Math.round(hx + 1.6), Math.round(hy + 2.4), BEARD, sphere(0.5, 0));
  // His mouth: open wider for the bottle.
  c.px(Math.round(hx - 1), Math.round(hy + 2.4), VOID);
  c.px(Math.round(hx), Math.round(hy + 2.4), VOID);
  if (p.head < 0) c.px(Math.round(hx - 0.5), Math.round(hy + 3.4), VOID);
  // The barnacle, and a drip off the beard's point.
  c.part();
  c.px(Math.round(hx + 1.2), Math.round(hy + 4), BARNACLE, sphere(-0.3, -0.5), { bias: 1 });
  c.px(Math.round(hx + 2), Math.round(hy + 4), BARNACLE, sphere(0.4, -0.2));
  c.px(Math.round(hx + 1.4), Math.round(hy + 5), BARNACLE, sphere(0, 0.4), { bias: -1 });
  drip(c, hx - 1, b1, p.wave, 7, 4);
}

/** The tricorne, front (or back) on: the crown, the brim cocked up at the sides and dipping to a point in the middle. */
function tricorne(c: PixelCanvas, hx: number, hy: number, p: CaptainPose, back: boolean): void {
  const cy = hy - 3.3;
  c.part();
  c.ellipse(hx, cy - 0.9, 3.3, 2.3, HAT, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.6 - 0.3, 1) });
  c.part();
  const W = 6.2;
  for (let x = Math.round(hx - W); x < hx + W; x++) {
    const dx = (x + 0.5 - hx) / W;
    const yb = cy + 1.7 - Math.pow(Math.abs(dx), 1.3) * 2.8;
    const yt = yb - 2.1;
    for (let y = Math.round(yt); y <= Math.round(yb); y++) {
      const top = y === Math.round(yt);
      c.px(x, y, top ? TRIM : HAT, { x: dx * 0.6, y: top ? 0.6 : 0.2, z: 0.75 }, { bias: top ? -1 : y === Math.round(yb) ? -1 : 0 });
    }
  }
  // The point dipping in the middle.
  c.px(Math.round(hx - 0.5), Math.round(cy + 2.7), HAT, sphere(0, 0.6), { bias: -1 });
  // Seaweed off one corner, a barnacle on the brim, and a drip off the other corner.
  c.part();
  weed(c, back ? hx - W + 0.5 : hx + W - 1, cy - 1.4, 3, p.wave, 5);
  c.px(Math.round(back ? hx + 3 : hx - 3), Math.round(cy - 0.2), BARNACLE, sphere(-0.3, -0.5), { bias: 1 });
  drip(c, back ? hx + W - 1 : hx - W + 0.5, cy - 1, p.wave, 9, 6);
}

/** The Captain's head in profile, facing left: face, nose, beard jutting forward, and the tricorne's front point. */
function captainSide(c: PixelCanvas, hx: number, hy: number, p: CaptainPose): void {
  c.part();
  c.capsule(hx + 1.4, hy - 1, hx + 1.2, hy + 2.2, 0.9, 1, BEARD);
  c.ellipse(hx - 0.4, hy, 2.5, 3, GHOST, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.7, 1) });
  for (let x = Math.round(hx - 3); x < hx + 2; x++) c.shade(x, Math.round(hy - 2.5), -2);
  c.px(Math.round(hx - 3.2), Math.round(hy + 0.4), GHOST, sphere(-0.7, 0.1), { bias: 1 });
  c.part();
  const ey = Math.round(hy - 0.6 + (p.head > 0 ? 1 : 0));
  c.px(Math.round(hx - 1.8), ey, SOUL, { x: 0, y: 0, z: 1 }, { glow: 0.8 + p.glare * 0.2 });
  if (p.glare > 0) c.spark(hx - 1.8, ey, M.glow, p.glare * 0.7);
  // The beard, jutting forward and down.
  c.part();
  c.shape(Math.round(hy + 1.2), Math.round(hy + 6), (y) => {
    const u = (y - hy - 1.2) / 4.8;
    return [hx - 3.4 - u * 0.6, hx + 1.4 - u * 3.2];
  }, BEARD, (_x, y, t) => sphere(t * 0.8, 0.2 - (y - hy) * 0.08, 1));
  c.px(Math.round(hx - 3.4), Math.round(hy + 1.4), BEARD, sphere(-0.6, -0.3), { bias: 1 });
  c.px(Math.round(hx - 3), Math.round(hy + 2.4), VOID);
  c.px(Math.round(hx - 1.4), Math.round(hy + 4), BARNACLE, sphere(-0.3, -0.5), { bias: 1 });
  drip(c, hx - 3.6, hy + 6, p.wave, 7, 4);
  // The tricorne from the side: the crown, the front point low, the back corner cocked up, a side flap between.
  c.part();
  const cy = hy - 3.3;
  c.ellipse(hx + 0.4, cy - 0.9, 2.9, 2.3, HAT, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.6 - 0.3, 1) });
  c.part();
  for (let x = Math.round(hx - 5.6); x <= hx + 4.4; x++) {
    const k = (x + 0.5 - (hx - 5.6)) / 10;
    const line = lerp(cy + 1.5, cy - 2.4, k);
    const flap = cy - 2.6 + Math.abs(x + 0.5 - hx) * 0.9;
    const yt = Math.min(line - 1.2, flap);
    for (let y = Math.round(yt); y <= Math.round(line); y++) {
      const top = y === Math.round(yt);
      c.px(x, y, top ? TRIM : HAT, { x: -0.3, y: top ? 0.6 : 0.2, z: 0.75 }, { bias: top ? -1 : 0 });
    }
  }
  c.part();
  weed(c, hx + 4, cy - 2, 3, p.wave, 5);
}

/** The back of the Captain's head: ghost hair tied in a queue under the hat. */
function captainBack(c: PixelCanvas, hx: number, hy: number, p: CaptainPose): void {
  c.part();
  c.ellipse(hx, hy, 2.9, 3, BEARD, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.7, 1) });
  for (let y = Math.round(hy - 1); y <= hy + 2; y++) if (y & 1) c.shade(Math.round(hx - 1.5), y, -1);
  c.part();
  c.capsule(hx, hy + 2, hx + 0.3 + Math.sin(p.wave) * 0.4, hy + 5.8, 0.9, 0.6, BEARD);
  c.px(Math.round(hx - 0.5), Math.round(hy + 3.4), LEATHER, sphere(0, 0));
  c.px(Math.round(hx + 0.5), Math.round(hy + 3.4), LEATHER, sphere(0.3, 0));
  tricorne(c, hx, hy, p, true);
}

/** The Admiral's skull, front on: deep sockets with a violet spark in each, the nose's hollow, a grin of teeth. */
function skullFront(c: PixelCanvas, hx: number, hy: number, p: CaptainPose): void {
  c.part();
  c.ellipse(hx, hy - 0.3, 2.9, 3, SKULL, { normal: (_x, _y, dx, dy) => sphere(dx * 0.85, dy * 0.7, 1) });
  // The jaw: narrower, dropped open for the bottle.
  const jaw = Math.round(hy + 2.2 + (p.head < 0 ? 1 : 0));
  c.shape(jaw, jaw + 1, (y) => (y === jaw ? [hx - 2.1, hx + 2.1] : [hx - 1.6, hx + 1.6]), SKULL, (_x, _y, t) => sphere(t * 0.8, 0.5, 1));
  for (let x = Math.round(hx - 2.6); x < hx + 2.6; x++) c.shade(x, Math.round(hy - 3), -1);
  c.part();
  const ey = Math.round(hy - 0.8 + (p.head > 0 ? 1 : 0));
  for (const ex of [Math.round(hx - 2), Math.round(hx + 0.5)]) {
    c.px(ex, ey, VOID);
    c.px(ex + 1, ey, VOID);
    c.px(ex, ey + 1, VOID);
    c.px(ex + 1, ey + 1, VOID, { x: 0, y: 0, z: 1 }, { bias: 1 });
    const pupil = ex + (ex < hx ? 1 : 0);
    c.px(pupil, ey, VSOUL, { x: 0, y: 0, z: 1 }, { glow: 0.8 + p.glare * 0.2 });
    c.spark(pupil, ey, M.glow, 0.3 + p.glare * 0.6);
  }
  c.px(Math.round(hx - 0.5), Math.round(hy + 1.1), VOID);
  // Teeth: a dark line, cut by gaps.
  const ty = Math.round(hy + 2.1);
  for (let x = Math.round(hx - 1.6); x < hx + 1.6; x++) {
    if (p.head < 0) c.px(x, ty + 1, VOID);
    c.px(x, ty, x % 2 ? VOID : SKULL, { x: 0, y: 0, z: 1 }, { bias: 1 });
  }
  // Cheekbones catching the light.
  c.shade(Math.round(hx - 2.3), Math.round(hy + 0.8), 1);
  c.shade(Math.round(hx + 1.8), Math.round(hy + 0.8), 1);
}

/** The bicorne, front (or back) on: worn athwart, a wide black crescent edged in gold, a cockade, a violet plume. */
function bicorne(c: PixelCanvas, hx: number, hy: number, p: CaptainPose, back: boolean): void {
  const b = hy - 2.9;
  const W = 6.6;
  c.part();
  for (let x = Math.round(hx - W); x < hx + W; x++) {
    const dx = (x + 0.5 - hx) / W;
    const top = b - 4.6 * Math.sqrt(Math.max(0, 1 - dx * dx)) - 0.4;
    const bot = b + 0.6 - Math.max(0, Math.abs(dx) - 0.7) * 5;
    for (let y = Math.round(top); y <= Math.round(bot); y++) {
      const edge = y === Math.round(top) || (Math.abs(dx) > 0.8 && y === Math.round(bot));
      c.px(x, y, edge ? GOLD : BICORNE, { x: dx * 0.7, y: 0.3 - (y - top) * 0.05, z: 0.72 }, { bias: edge ? 0 : y === Math.round(bot) ? -1 : 0 });
    }
  }
  c.part();
  if (!back) {
    // The cockade: a violet rosette, a gold loop over it.
    c.ellipse(hx + 2.4, b - 2.6, 1.2, 1.2, PLUME);
    c.px(Math.round(hx + 2), Math.round(b - 2.8), GOLD, sphere(0, -0.5), { bias: 1 });
    c.line(hx + 2.4, b - 3.8, hx + 2.4, b - 0.8, GOLD);
  }
  plume(c, hx + (back ? -2.6 : 2.6), b - 4.2, back ? 1 : -1, p);
}

/** A plume rising off the hat and curling over, sweeping `way` (1 right, -1 left). */
function plume(c: PixelCanvas, x0: number, y0: number, way: number, p: CaptainPose): void {
  const sway = Math.sin(p.wave * 1.2) * 0.6 + p.tails * 0.5 * -way;
  c.part();
  c.capsule(x0, y0, x0 + way * 1.2, y0 - 3, 1.3, 1.1, PLUME);
  c.capsule(x0 + way * 1.2, y0 - 3, x0 + way * (3.4 + sway), y0 - 3.8, 1.1, 0.6, PLUME);
  for (let i = 0; i < 4; i++) c.px(Math.round(x0 + way * (0.5 + i * 0.9)), Math.round(y0 - 1 - i), PLUME, sphere(way * 0.3, -0.5), { bias: 1 });
  c.spark(x0 + way * 2, y0 - 3.5, M.glow, 0.3);
}

/** The Admiral's skull in profile, facing left, under the bicorne seen end-on. */
function skullSide(c: PixelCanvas, hx: number, hy: number, p: CaptainPose): void {
  c.part();
  c.ellipse(hx - 0.2, hy - 0.3, 2.6, 3, SKULL, { normal: (_x, _y, dx, dy) => sphere(dx * 0.85, dy * 0.7, 1) });
  const jaw = Math.round(hy + 2.2 + (p.head < 0 ? 1 : 0));
  c.shape(jaw, jaw + 1, (y) => (y === jaw ? [hx - 2.6, hx + 1] : [hx - 2.2, hx + 0.6]), SKULL, (_x, _y, t) => sphere(t * 0.8, 0.5, 1));
  c.part();
  const ey = Math.round(hy - 0.8 + (p.head > 0 ? 1 : 0));
  c.px(Math.round(hx - 2.2), ey, VOID);
  c.px(Math.round(hx - 1.2), ey, VOID);
  c.px(Math.round(hx - 2.2), ey + 1, VOID);
  c.px(Math.round(hx - 2.2), ey, VSOUL, { x: 0, y: 0, z: 1 }, { glow: 0.8 + p.glare * 0.2 });
  c.spark(hx - 2.2, ey, M.glow, 0.3 + p.glare * 0.6);
  c.px(Math.round(hx - 2.8), Math.round(hy + 1.1), VOID);
  for (let x = Math.round(hx - 2.6); x <= hx - 0.6; x++) c.px(x, Math.round(hy + 2.1), x % 2 ? VOID : SKULL, { x: 0, y: 0, z: 1 }, { bias: 1 });
  c.shade(Math.round(hx + 1), Math.round(hy), -1);
  // The bicorne edge-on: a tall half-moon, gold along its curve, the plume streaming back.
  c.part();
  const b = hy - 2.9;
  for (let x = Math.round(hx - 2.6); x <= hx + 2.4; x++) {
    const dx = (x + 0.5 - hx) / 2.7;
    const top = b - 5.2 * Math.sqrt(Math.max(0, 1 - dx * dx)) - 0.2;
    for (let y = Math.round(top); y <= Math.round(b + 0.6); y++) {
      const edge = y === Math.round(top);
      c.px(x, y, edge ? GOLD : BICORNE, { x: dx * 0.7, y: 0.3, z: 0.72 }, { bias: edge ? 0 : -((x + y) % 5 === 0 ? 1 : 0) });
    }
  }
  plume(c, hx + 1.2, b - 4.4, 1, p);
}

/** The back of the Admiral's skull under the bicorne. */
function skullBack(c: PixelCanvas, hx: number, hy: number, p: CaptainPose): void {
  c.part();
  c.ellipse(hx, hy - 0.3, 2.9, 3, SKULL, { normal: (_x, _y, dx, dy) => sphere(dx * 0.85, dy * 0.7, 1) });
  c.shade(Math.round(hx - 0.5), Math.round(hy + 1.5), -1);
  bicorne(c, hx, hy, p, true);
}

// --- The whole figure -------------------------------------------------------

function drawFigure(c: PixelCanvas, p: CaptainPose, view: View): void {
  const side = view === 'side';
  const adm = L.admiral;
  const U = -p.bob;
  const cx = 12;
  const top = 13.5 + U;
  const f: Frame = {
    side,
    view,
    cx,
    headX: cx - (side ? p.lean * 0.9 : 0),
    headY: top - 4.3 + (p.head < 0 ? -1 : 0),
    top,
    waist: 19.5 + U,
    hem: 25 + U,
  };
  const lean = side ? p.lean * 0.6 : 0;
  // The shoulders, and which way "outward" goes on screen for each arm.
  const swordS: Pt = view === 'down' ? { x: cx - 4.1, y: top + 1 } : view === 'up' ? { x: cx + 4.1, y: top + 1 } : { x: cx - 0.6 - lean, y: top + 1 };
  const gunS: Pt = view === 'down' ? { x: cx + 4.1, y: top + 1 } : view === 'up' ? { x: cx - 4.1, y: top + 1 } : { x: cx + 1.4 - lean, y: top + 0.6 };
  const swordFlip = view !== 'up';
  const gunFlip = view !== 'down';
  const at = (s: Pt, o: Pt, flip: boolean): Pt => ({ x: s.x + (flip ? -o.x : o.x), y: s.y + o.y });
  const ang = (a: number, flip: boolean): number => (flip ? Math.PI - a : a);
  const sh = at(swordS, p.sword, swordFlip);
  const gh = at(gunS, p.gun, gunFlip);

  const swordArm = () => {
    arm(c, swordS, sh);
    blade(c, sh.x, sh.y, ang(p.ang, swordFlip));
  };
  let muzzle: Pt | null = null;
  const gunArm = () => {
    c.part();
    c.capsule(gunS.x, gunS.y, gh.x, gh.y, 1.45, 1.2, M.coat);
    c.ellipse(lerp(gunS.x, gh.x, 0.78), lerp(gunS.y, gh.y, 0.78), 1.4, 1.3, M.trim, { bias: adm ? 0 : -1 });
    if (p.bottle !== null) bottle(c, gh.x, gh.y, p.bottle);
    else if (p.hook) {
      hand(c, gh.x, gh.y);
      hookHeld(c, gh.x, gh.y, gh.x + p.hook.x, gh.y + p.hook.y);
    } else if (p.holster) {
      hand(c, gh.x, gh.y);
      if (p.rope) {
        c.part();
        const n = Math.ceil(Math.hypot(p.rope.x, p.rope.y));
        for (let i = 0; i <= n; i++) {
          const k = i / n;
          if (k > 0.5 && hash(i, 3) < (k - 0.5) * 1.6) continue;
          c.px(Math.round(gh.x + p.rope.x * k), Math.round(gh.y + p.rope.y * k), M.rope, { x: 0, y: 0, z: 1 });
        }
      }
    } else {
      muzzle = pistol(c, gh.x, gh.y, ang(p.gunAng, gunFlip), p.fore);
    }
  };
  /** The pistol tucked in his belt while the hand is busy. */
  const holstered = () => {
    if (!p.holster && p.bottle === null) return;
    c.part();
    const bx = view === 'down' ? cx + 2.2 : view === 'up' ? cx - 2.6 : cx + 1;
    const by = f.waist - 1;
    if (view === 'up') return;
    c.line(bx, by - 2, bx + (side ? -0.5 : 0.6), by + 1.5, WOOD, () => sphere(0.3, -0.2));
    c.px(Math.round(bx), Math.round(by - 2.5), adm ? GOLD : TRIM, sphere(0, -0.5));
  };
  const epaulettes = () => {
    if (!adm) return;
    if (view === 'side') epaulette(c, cx + 0.4 - lean, top + 0.3, 1.9);
    else for (const s of [-1, 1]) epaulette(c, cx + s * 3.9, top + 0.4, 1.8);
  };
  const head = () => {
    if (view === 'down') {
      if (adm) {
        skullFront(c, f.headX, f.headY, p);
        bicorne(c, f.headX, f.headY, p, false);
      } else {
        captainFace(c, f.headX, f.headY, p);
        tricorne(c, f.headX, f.headY, p, false);
      }
    } else if (view === 'up') {
      if (adm) skullBack(c, f.headX, f.headY, p);
      else captainBack(c, f.headX, f.headY, p);
    } else if (adm) skullSide(c, f.headX, f.headY, p);
    else captainSide(c, f.headX, f.headY, p);
  };

  if (view === 'up') {
    if (p.reach) {
      swordArm();
      gunArm();
    }
    legs(c, f, p);
    coat(c, f, p);
    head();
    if (!p.reach) {
      swordArm();
      gunArm();
    }
    epaulettes();
  } else if (side) {
    gunArm();
    legs(c, f, p);
    coat(c, f, p);
    holstered();
    head();
    epaulettes();
    swordArm();
  } else {
    legs(c, f, p);
    coat(c, f, p);
    holstered();
    head();
    epaulettes();
    swordArm();
    gunArm();
  }

  if (muzzle) {
    const a = ang(p.gunAng, gunFlip);
    const d = p.fore === 1 ? { x: 0, y: 1 } : p.fore === -1 ? { x: 0, y: -1 } : { x: Math.cos(a), y: Math.sin(a) };
    gunfire(c, muzzle, d.x, d.y, p);
  }
  if (p.pour > 0) rum(c, f, p);
  if (p.flung) {
    // The empty bottle tossed over his shoulder.
    bottle(c, cx + p.flung.x, top + p.flung.y, 2.4);
  }
}

/**
 * The rum he drinks running straight down through him: a glowing trickle
 * from his mouth to the mist, pooling under him and dripping out, then only
 * the last drops falling.
 */
function rum(c: PixelCanvas, f: Frame, p: CaptainPose): void {
  c.part();
  const x0 = f.headX - 0.5;
  const y0 = f.headY + 3.4;
  const ground = 30;
  const reach = lerp(y0, ground, Math.min(1, p.pour));
  // Past 1, the top of the stream has run out: it falls away from the mouth.
  const from = p.pour > 1 ? lerp(y0, ground, (p.pour - 1) * 3) : y0;
  for (let y = Math.round(from); y <= reach; y++) {
    if ((y + Math.round(p.wave * 2)) % 5 === 0) continue;
    const x = Math.round(x0 + Math.sin(y * 0.9 + p.wave) * 0.5);
    c.px(x, y, RUM, { x: 0, y: 0, z: 1 }, { bias: y === Math.round(reach) ? 1 : 0 });
    if (y % 3 === 0) c.spark(x, y, [255, 190, 90], 0.3);
  }
  if (p.pour >= 0.95) {
    // A puddle under him, and a splash.
    const w = 2.2 + Math.min(1, p.pour - 0.95) * 1.5;
    for (let x = Math.round(x0 - w); x <= x0 + w; x++) c.px(x, ground, RUM, { x: 0, y: 0.4, z: 0.9 }, { bias: Math.abs(x - x0) < 1 ? 1 : -1 });
    if (p.pour < 1.15) for (const s of [-1, 1]) c.px(Math.round(x0 + s * 2), ground - 1 - (Math.round(p.wave) % 2), RUM, { x: 0, y: 0, z: 1 });
  }
}

// ---------------------------------------------------------------------------
// Animations

export type CaptainAnim = 'idle' | 'move' | 'slash1' | 'slash2' | 'shoot' | 'hook' | 'leap' | 'cast' | 'rest';

interface AnimDef {
  name: CaptainAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => CaptainPose[];
  /** Frame indices to play in order, when some are held or repeated. */
  order?: readonly number[];
}

const at = (view: View, o: Partial<CaptainPose>): CaptainPose => ({ ...base(view), ...o });

const idle = (view: View): CaptainPose[] =>
  [0, 1, 2, 3].map((i) => {
    const p = base(view);
    p.bob = [0, 1, 1, 0][i];
    p.wave = i;
    p.sword = { x: p.sword.x, y: p.sword.y + [0, -0.4, -0.4, 0][i] };
    p.gun = { x: p.gun.x, y: p.gun.y + [0, 0, -0.4, -0.4][i] };
    return p;
  });

/** Drifting: leaning into it, the coat's tails and the mist streaming. */
const move = (view: View): CaptainPose[] =>
  [0, 1, 2, 3].map((i) => {
    const p = base(view);
    p.bob = [1, 2, 2, 1][i];
    p.wave = i + 0.5;
    if (view === 'side') {
      p.lean = 1;
      p.tails = 1.5 + (i % 2);
      p.sword = { x: 2.5, y: 5 };
      p.ang = Math.PI / 2 + 0.7;
      p.gun = { x: -1.6, y: 5.4 };
    } else {
      p.sword = { x: 1.8, y: 5.5 + [0, -0.5, 0, 0.5][i] };
      p.gun = { x: 1.6, y: 5.5 + [0, 0.5, 0, -0.5][i] };
      p.ang = Math.PI / 2 - 0.6;
    }
    return p;
  });

type Swing = [number, number, number];

/** A cutlass stroke through four keys: hand x, hand y and the blade's angle each. */
const stroke = (view: View, keys: Record<View, Swing[]>, lean: number[]): CaptainPose[] =>
  keys[view].map(([x, y, a], i) => at(view, { sword: { x, y }, ang: a, bob: 1, wave: i, lean: view === 'side' ? lean[i] : 0, tails: view === 'side' ? lean[i] : 0, reach: i > 0 && i < 3 }));

const PI = Math.PI;

/** The forehand: raised high, then down and across in front of him. */
const slash1 = (view: View): CaptainPose[] =>
  stroke(
    view,
    {
      down: [[2.5, -3, -PI / 2 + 0.5], [-1, 4, PI * 0.85], [-5.5, 6, PI * 0.62], [-2, 6, PI / 2]],
      up: [[2.5, -3, -PI / 2 + 0.5], [-1, 1, -PI + 0.6], [-5, 2, -PI * 0.7], [-2, 5, PI / 2]],
      side: [[-1, -3, -PI / 2 - 0.5], [4, 1, 0.1], [3.5, 5, PI / 2 - 0.3], [2, 6, PI / 2 + 0.2]],
    },
    [0, 1, 1, 0],
  );

/** The backhand: wound across him, then flung out and up. */
const slash2 = (view: View): CaptainPose[] =>
  stroke(
    view,
    {
      down: [[-4, 3, -PI * 0.8], [2, 2, 0.15], [4, 5, PI * 0.25], [2, 6, PI / 2 - 0.4]],
      up: [[-4, 3, -PI * 0.8], [2, 1, -0.3], [4, 4, 0.6], [2, 6, PI / 2 - 0.4]],
      side: [[0, 6, PI / 2 + 0.9], [4, 3, -0.2], [3, -1, -PI / 2 + 0.3], [2, 4, PI / 2]],
    },
    [0, 1, 1, 0],
  );

/** The flintlock: raised and levelled, the flash, the kick, the smoke. */
const shoot = (view: View): CaptainPose[] => {
  const keys: Record<View, [number, number, number, 0 | 1 | -1, number, number][]> = {
    // hand x, hand y, barrel angle, end-on, flash, smoke
    down: [[-1, 2, PI / 2, 0, 0, 0], [-2.5, 3, 0, 1, 1, 0], [-2.5, 1.5, 0, 1, 0, 0.4], [-2, 2.5, 0, 1, 0, 0.7], [0, 4, PI / 2, 0, 0, 1]],
    up: [[0, 2, PI / 2, 0, 0, 0], [-3, -0.5, 0, -1, 1, 0], [-3, -1.5, 0, -1, 0, 0.4], [-3, -0.5, 0, -1, 0, 0.7], [-1, 3, PI / 2, 0, 0, 1]],
    side: [[2, 1, 0.3, 0, 0, 0], [6.5, 0.5, 0, 0, 1, 0], [5.5, -0.5, -0.35, 0, 0, 0.4], [6, 0.5, 0, 0, 0, 0.7], [3, 3, 0.6, 0, 0, 1]],
  };
  return keys[view].map(([x, y, a, fore, flash, smoke], i) => at(view, { gun: { x, y }, gunAng: a, fore, flash, smoke, bob: 1, wave: i, glare: flash, lean: view === 'side' && i === 2 ? -1 : 0, reach: i > 0 && i < 4 }));
};

/** The boarding hook: drawn from his belt, whirled overhead and hurled. */
const hook = (view: View): CaptainPose[] => {
  const keys: Record<View, [number, number, Pt | null, Pt | null][]> = {
    down: [[1, 3, { x: 1.5, y: 2.5 }, null], [0, -5, { x: 3, y: -3 }, null], [-1, -5, { x: -4, y: -2 }, null], [-2.5, 3.5, null, { x: -1, y: 8 }], [-2, 4, null, { x: -1, y: 8 }]],
    up: [[1, 3, { x: -1.5, y: 2.5 }, null], [0, -5, { x: -3, y: -3 }, null], [-1, -5, { x: 4, y: -2 }, null], [-2.5, -1, null, { x: 1, y: -8 }], [-2, 0, null, { x: 1, y: -8 }]],
    side: [[-1, 4, { x: 0, y: 2.5 }, null], [-1, -4, { x: 3, y: -2 }, null], [0, -5, { x: -2.5, y: -3 }, null], [6, 1, null, { x: -9, y: 0.5 }], [6, 2, null, { x: -9, y: 0 }]],
  };
  return keys[view].map(([x, y, h, rope], i) => at(view, { gun: { x, y }, holster: true, hook: h, rope, bob: 1, wave: i, lean: view === 'side' && i >= 3 ? 1 : 0, tails: view === 'side' && i >= 3 ? 1 : 0, reach: i >= 3 }));
};

/** Hauled through the air on the hook's rope: leaning hard, the cutlass up for the blow. */
const leap = (view: View): CaptainPose[] =>
  [0, 1].map((i) =>
    at(view, {
      bob: 2,
      wave: i * 2,
      lean: view === 'side' ? 2 : 0,
      tails: view === 'side' ? 3 : 1,
      sword: view === 'side' ? { x: 0, y: -4 } : { x: 2, y: -4 },
      ang: view === 'side' ? -PI / 2 - 0.2 : -PI / 2 + 0.3,
      gun: view === 'side' ? { x: -2, y: 3 } : { x: 2, y: 2 },
      gunAng: PI / 2 + 0.3,
      glare: 0.5,
    }),
  );

/** His Special's pose: rising, the cutlass raised to call his ship, the pistol up. */
const cast = (view: View): CaptainPose[] =>
  [0.3, 0.6, 1, 1, 1].map((k, i) => {
    const side = view === 'side';
    return at(view, {
      bob: Math.round(k * 3),
      wave: i,
      glare: k,
      tails: k * 2,
      sword: side ? { x: 1 + k, y: 6 - 11 * k } : { x: 1.5 - 0.5 * k, y: 6 - 11 * k },
      ang: side ? lerp(PI / 2 - 0.6, -PI / 2 - 0.1, k) : lerp(PI / 2 - 0.45, -PI / 2 + 0.15, k),
      gun: side ? { x: -1 + 3 * k, y: 5 - 4 * k } : { x: 1.4 + 0.6 * k, y: 6 - 6 * k },
      gunAng: side ? lerp(PI / 2, -0.4, k) : lerp(PI / 2 - 0.15, -PI / 4, k),
    });
  });

/**
 * The idle moment, facing the viewer only: a swig of rum. He tucks the
 * pistol in his belt, fishes a bottle out of his coat and throws his head
 * back for a long pull... and the rum runs straight down through him and out
 * of the mist into a puddle. He looks down at it, shakes the last drop from
 * the bottle, and flings it over his shoulder.
 */
const rest = (view: View): CaptainPose[] => {
  if (view !== 'down') return [];
  const v: View = 'down';
  return [
    at(v, {}),
    at(v, { holster: true, gun: { x: -2.5, y: 3 }, wave: 1 }),
    at(v, { bottle: 0, gun: { x: -0.5, y: 3 }, wave: 2 }),
    at(v, { bottle: 1.25, gun: { x: -0.1, y: -2.5 }, head: -1, wave: 3, bob: 1 }),
    at(v, { bottle: 1.9, gun: { x: -0.15, y: -5.4 }, head: -1, pour: 0.35, wave: 0, bob: 1 }),
    at(v, { bottle: 1.9, gun: { x: -0.15, y: -5.4 }, head: -1, pour: 0.7, wave: 1, bob: 1 }),
    at(v, { bottle: 1.9, gun: { x: -0.15, y: -5.4 }, head: -1, pour: 1, wave: 2, bob: 1 }),
    at(v, { bottle: 0.3, gun: { x: 0, y: 2 }, head: 1, pour: 1.2, wave: 3 }),
    at(v, { bottle: 2.9, gun: { x: 1, y: -1 }, pour: 1.3, wave: 0 }),
    at(v, { holster: true, gun: { x: 2.5, y: -4 }, flung: { x: 9, y: -9 }, wave: 1, bob: 1 }),
    at(v, { wave: 2 }),
  ];
};

export const CAPTAIN_ANIMS: AnimDef[] = [
  { name: 'idle', fps: 5, loop: true, poses: idle },
  { name: 'move', fps: 8, loop: true, poses: move },
  { name: 'slash1', fps: 14, loop: false, poses: slash1 },
  { name: 'slash2', fps: 14, loop: false, poses: slash2 },
  { name: 'shoot', fps: 13, loop: false, poses: shoot },
  { name: 'hook', fps: 14, loop: false, poses: hook },
  { name: 'leap', fps: 10, loop: true, poses: leap },
  { name: 'cast', fps: 10, loop: false, poses: cast },
  { name: 'rest', fps: 7, loop: false, poses: rest, order: [0, 1, 2, 3, 4, 4, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 10, 0] },
];

export interface CaptainFrame {
  key: string;
  anim: CaptainAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawFrame(dir: Dir, p: CaptainPose): PixelCanvas {
  const c = new PixelCanvas(CAPTAIN_W, CAPTAIN_H).offset(BODY_X, BODY_Y);
  drawFigure(c, p, dir === 'left' || dir === 'right' ? 'side' : dir);
  return dir === 'right' ? c.mirrored() : c;
}

export function buildCaptainFrames(look: CaptainLook = CAPTAIN_LOOK): CaptainFrame[] {
  L = look;
  M = look.admiral ? ADMIRAL_M : CAPTAIN_M;
  const out: CaptainFrame[] = [];
  for (const a of CAPTAIN_ANIMS) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, i) => out.push({ key: `${a.name}_${dir}_${i}`, anim: a.name, dir, canvas: drawFrame(dir, pose) }));
    }
  }
  L = CAPTAIN_LOOK;
  M = CAPTAIN_M;
  return out;
}

// ---------------------------------------------------------------------------
// Icons

const CAPTAIN_TONES: Tones = [hex('#eafff6'), hex('#8af0d0'), hex('#3ac0a0'), hex('#0e4a40')];
const ADMIRAL_TONES: Tones = [hex('#f6eeff'), hex('#d0b0ff'), hex('#9a6ae8'), hex('#3a1e6a')];

/** Cutlass and pistol: the curved blade and the flintlock crossed, a puff of smoke at the muzzle. */
export function captainCutlassIcon(admiral = false): Uint8ClampedArray {
  const t = admiral ? ADMIRAL_TONES : CAPTAIN_TONES;
  const brass: RGB = admiral ? hex('#f0c44c') : hex('#c8b65e');
  const wood: RGB = hex('#7a5028');
  const iron: RGB = hex('#6a7a84');
  return icon16((put) => {
    // The pistol: barrel up to the left, the stock curling down to the right.
    seg(put, 3, 4, 9, 10, iron);
    seg(put, 4, 4, 10, 10, hex('#3a4650'));
    seg(put, 10, 10, 12, 13, wood);
    seg(put, 11, 10, 13, 12, wood);
    put(13, 14, brass);
    put(9, 9, brass);
    // Smoke from the muzzle.
    for (const [x, y, k] of [[2, 3, 2], [1, 1, 3], [3, 1, 3], [0, 3, 3]] as const) put(x, y, t[k]);
    // The cutlass: hilt at the bottom left, the blade curving up to the right.
    for (let i = 0; i <= 10; i++) {
      const k = i / 10;
      const x = 3 + i * 1.05;
      const y = 12 - i * 1.0 - k * k * 1.5;
      put(x, y, i > 8 ? t[0] : t[1]);
      if (i < 8) put(x + 1, y + 1, t[2]);
    }
    seg(put, 1, 14, 3, 12, wood);
    seg(put, 2, 11, 5, 14, brass);
    put(4, 11, brass);
  });
}

/** The boarding hook: a three-tined grappling hook flying, its rope trailing back in a curve. */
export function captainHookIcon(admiral = false): Uint8ClampedArray {
  const t = admiral ? ADMIRAL_TONES : CAPTAIN_TONES;
  const steel: RGB = admiral ? hex('#aca4dc') : hex('#9ad4c6');
  const dark: RGB = admiral ? hex('#3a3658') : hex('#2e4c50');
  return icon16((put) => {
    // The rope, in a lazy curve from the corner.
    for (let i = 0; i <= 14; i++) {
      const k = i / 14;
      put(1 + k * 8, 14 - k * 8 + Math.sin(k * Math.PI) * 2.5, i % 3 === 0 ? t[1] : t[2]);
    }
    // Shank, ring and tines.
    seg(put, 9, 6, 12, 3, steel);
    seg(put, 10, 6, 13, 3, dark);
    put(8, 7, t[0]);
    for (const [x0, y0, x1, y1] of [[12, 3, 15, 4], [12, 3, 11, 0], [12, 3, 15, 1]] as const) seg(put, x0, y0, x1, y1, steel);
    put(15, 5, steel);
    put(10, 0, steel);
    // Speed streaks.
    for (const [x, y] of [[4, 4], [5, 2], [2, 7]]) put(x, y, t[3]);
  });
}
