// The Beastkin, drawn procedurally from one rig: three beastfolk warriors
// who walk upright, each with the head, hide and limbs of their animal.
//
// The eagle: a sky warrior with a snow-white feathered head and a hooked
// golden beak, dark brown plumage, great brown wings folded at his back like
// a cloak (they spread when he beats them), a fan of white tail feathers,
// yellow scaled legs ending in black talons, golden bracers, a leather strap
// across the chest with a gold clasp and a sky-blue kilt hemmed in gold.
//
// The lion: broad and golden, a great dark mane framing the face and
// spilling over the chest, a cream muzzle, a bronze pauldron on one
// shoulder, a crimson war-kilt studded in bronze, bronze bracers, big paws
// with claws that come out as he strikes, and a tufted tail.
//
// The dragon: crimson scales, ivory horns sweeping back from the brow, pale
// gold belly plates, bat wings of dark red membrane on scaled bones, a thick
// tail with a spade at its tip, an iron war belt, glowing ember eyes and a
// throat that glows before he breathes fire.
//
// Each has a legendary club skin, in the kit of the club whose animal it is:
// the eagle in Benfica's red shirt, white shorts and red socks, his wings
// gilded; the lion in Sporting's green and white hoops, a brighter golden
// coat; the dragon in Porto's blue and white stripes, his scales royal blue,
// his fire blue, and a little gold crown between his horns. The shirts carry
// a small badge, not any club's crest.
//
// The body keeps to the 24x32 box; frames are larger so spread wings and
// raised arms fit. Hands are posed in the rig's own terms (forward, out to
// the side, height) and placed per view, like the Inventor's.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB, type Vec3 } from './pixel';
import { GOLD, LEATHER } from './palette';
import { DIRS, type Dir } from './wizard';
import { icon16, seg, type Tones } from './druid';

export const BEAST_W = 56;
export const BEAST_H = 54;
const BODY_X = 16;
const BODY_Y = 16;
/** Sprite origin in the frame: body centre, just under the feet. */
export const BEAST_ORIGIN_X = BODY_X + 12;
export const BEAST_ORIGIN_Y = BODY_Y + 31;
/** Height above the feet of the hands (feathers leave them) and of the mouth (fire and roars leave it). */
export const BEAST_HAND_Y = 15;
export const BEAST_MOUTH_Y = 18;

const ramp = (...c: string[]): RGB[] => c.map(hex);
const INK = hex('#120e1f');

// ---------------------------------------------------------------------------
// Materials

// The eagle.
const EAGLE_BROWN: Material = { ramp: ramp('#1c0f07', '#361f10', '#553519', '#7a5229', '#a07642'), outline: hex('#0a0503'), outlineLit: hex('#1a0e06') };
const EAGLE_WHITE: Material = { ramp: ramp('#646676', '#a2a4b4', '#d4d6e0', '#f4f6fc', '#ffffff'), outline: hex('#1c1e2c'), outlineLit: hex('#303246') };
const BEAK: Material = { ramp: ramp('#6a3806', '#b06c10', '#e2a41e', '#ffd24a', '#fff2a4'), outline: hex('#2a1402'), shine: true };
const SCALY_YELLOW: Material = { ramp: ramp('#553606', '#946810', '#d0a020', '#f2cc48'), outline: hex('#221402') };
const TALON: Material = { ramp: ramp('#0c0c10', '#24242c', '#44444f', '#6a6a78'), outline: INK, shine: true };
const EAGLE_WING: Material = { ramp: ramp('#170c06', '#30190c', '#4e3015', '#724b24', '#96703c'), outline: hex('#080402'), outlineLit: hex('#160c05') };
const SKY_CLOTH: Material = { ramp: ramp('#0c2240', '#183c68', '#285e98', '#3e86c4', '#6aaee4'), outline: INK, outlineLit: hex('#0c1a30') };
const EAGLE_EYE: Material = { ramp: ramp('#7a4200', '#ffb424', '#ffe890'), outline: INK, emissive: 0.35, noAO: true };

// The lion.
const LION_FUR: Material = { ramp: ramp('#3a1d08', '#6c3c12', '#a66820', '#d69a3a', '#f4c868'), outline: hex('#180a03'), outlineLit: hex('#2a1506') };
const LION_CREAM: Material = { ramp: ramp('#6a4a2a', '#a8845a', '#dcc096', '#f6e6c4'), outline: hex('#2a1a0c'), outlineLit: hex('#3c2814') };
const MANE: Material = { ramp: ramp('#120603', '#2a1107', '#48200d', '#6a3215', '#8c4820'), outline: hex('#0c0503'), outlineLit: hex('#1c0c05') };
const NOSE: Material = { ramp: ramp('#160c0c', '#342020', '#553636'), outline: INK };
const BRONZE: Material = { ramp: ramp('#2a1606', '#583210', '#925e20', '#c68e3e', '#f0c878'), outline: hex('#140a02'), shine: true };
const WAR_RED: Material = { ramp: ramp('#2a0608', '#520c12', '#86161e', '#b8262a', '#dc4a44'), outline: hex('#140204'), outlineLit: hex('#240408') };
const LION_EYE: Material = { ramp: ramp('#6a3a00', '#f0a020', '#ffe070'), outline: INK, emissive: 0.4, noAO: true };
const MOUTH: Material = { ramp: ramp('#1c0406', '#420a10', '#6e1820'), outline: hex('#0c0204'), noAO: true };
const FANG: Material = { ramp: ramp('#8a867a', '#cfcabc', '#fbf8ee'), outline: hex('#2a2820') };

// The dragon.
const DRAGON_RED: Material = { ramp: ramp('#280406', '#560c10', '#8c1a1a', '#c0302a', '#e8604a'), outline: hex('#120203'), outlineLit: hex('#240406'), shine: true };
const DRAGON_BELLY: Material = { ramp: ramp('#5a3a14', '#9a6a28', '#d0a04a', '#f0d08a'), outline: hex('#2a1606'), outlineLit: hex('#3a220a') };
const HORN: Material = { ramp: ramp('#4a3e30', '#8a7c64', '#c8baa0', '#f2ead8'), outline: hex('#1c160e'), shine: true };
const MEMBRANE: Material = { ramp: ramp('#2a0608', '#4c0e12', '#76191e', '#a2302c', '#c8503e'), outline: hex('#100203'), outlineLit: hex('#200406') };
const EMBER_EYE: Material = { ramp: ramp('#8a2a00', '#ffa020', '#fff0a0'), outline: INK, emissive: 1, noAO: true };
const IRON: Material = { ramp: ramp('#141418', '#2a2a32', '#484856', '#6e6e80', '#a0a0b4'), outline: INK, shine: true };
const DARK_CLOTH: Material = { ramp: ramp('#100608', '#220c10', '#381419', '#4e1e24'), outline: INK };
const FIRE_MOUTH: Material = { ramp: ramp('#8a2000', '#ff7a10', '#ffd060', '#fff8d0'), outline: hex('#3a0800'), emissive: 1, noAO: true };

// The club kits.
const KIT_WHITE: Material = { ramp: ramp('#686a78', '#aaacb8', '#dadce6', '#f8f9ff'), outline: hex('#1e202c'), outlineLit: hex('#2c2e3c') };
const BENFICA_RED: Material = { ramp: ramp('#3a0408', '#700a12', '#ae121e', '#de2230', '#ff5c60'), outline: hex('#180204'), outlineLit: hex('#2a0406') };
const VICTORY_WING: Material = { ramp: ramp('#2a1606', '#4e2e0e', '#7e541c', '#ae8030', '#dab058', '#fff0b0'), outline: hex('#120802'), outlineLit: hex('#221204'), shine: true };
const SPORTING_GREEN: Material = { ramp: ramp('#021e0e', '#063e1c', '#0a682e', '#109448', '#38c070'), outline: hex('#010c05'), outlineLit: hex('#021808') };
const PRIDE_FUR: Material = { ramp: ramp('#462806', '#865210', '#c48a1e', '#eeba3a', '#ffe27a'), outline: hex('#1c0e02'), outlineLit: hex('#2e1804') };
const PRIDE_MANE: Material = { ramp: ramp('#1a0a04', '#3a1a0a', '#5e3012', '#86481c', '#b0682a'), outline: hex('#0e0603'), outlineLit: hex('#1e0e05') };
const PORTO_SCALE: Material = { ramp: ramp('#040c2a', '#0a1c58', '#133494', '#2a58c8', '#5a8cf0'), outline: hex('#02061a'), outlineLit: hex('#040c2a'), shine: true };
const PORTO_KIT: Material = { ramp: ramp('#051444', '#0b287c', '#1844b4', '#3268de', '#6090f4'), outline: hex('#020822'), outlineLit: hex('#041032') };
const PORTO_BELLY: Material = { ramp: ramp('#56607a', '#96a2ba', '#ccd8ea', '#f2f8ff'), outline: hex('#161c2c') };
const PORTO_MEMBRANE: Material = { ramp: ramp('#06103a', '#0e2268', '#1a3a9a', '#2e5cc8', '#5282e8'), outline: hex('#020616'), outlineLit: hex('#040a24') };
const CROWN_GOLD: Material = { ramp: ramp('#5a3a08', '#9a6c14', '#d8a830', '#ffd860', '#fff6c0'), outline: hex('#241402'), shine: true, noAO: true };
const ICE_EYE: Material = { ramp: ramp('#1a4ab0', '#6ad0ff', '#e8fcff'), outline: INK, emissive: 1, noAO: true };
const BLUE_FIRE: Material = { ramp: ramp('#0a2a8a', '#2a8cff', '#9ee4ff', '#f4ffff'), outline: hex('#020a30'), emissive: 1, noAO: true };

// ---------------------------------------------------------------------------
// Looks

export type BeastKind = 'eagle' | 'lion' | 'dragon';

/** A club's kit, worn over the beast's own hide. */
interface Kit {
  shirt: Material;
  /** The second colour: hoops, stripes, or just the collar and cuffs. */
  stripe: Material;
  pattern: 'plain' | 'hoops' | 'stripes';
  shorts: Material;
  socks: Material;
  collar: Material;
  /** The little badge on the chest: its field and its mark. */
  badge: [Material, Material];
}

export interface BeastLook {
  key: string;
  kind: BeastKind;
  /** The main covering: plumage, fur or scales. */
  hide: Material;
  /** Chest and belly (cream fur, belly plates); the eagle's legs. */
  belly: Material;
  /** The eagle's white head and tail; the others' is their hide. */
  head: Material;
  /** The lion's mane; the dragon's horns. */
  mane: Material;
  /** Wing feathers or membrane. */
  wing: Material;
  /** Hands and feet: talons' scales, paws, claws. */
  limb: Material;
  /** Beak, nose, or horn, and the claws' tips. */
  beak: Material;
  claw: Material;
  eye: Material;
  /** Kilt or loincloth, and the trims (gold, bronze, iron). */
  cloth: Material;
  trim: Material;
  /** The dragon's fire in the mouth. */
  fire: Material;
  kit?: Kit;
  /** Porto's little crown. */
  crown?: boolean;
  /** Light of its power (feathers, roar, fire), brightest first. */
  light: [RGB, RGB, RGB, RGB];
}

export const EAGLE_LOOK: BeastLook = {
  key: 'eagle',
  kind: 'eagle',
  hide: EAGLE_BROWN,
  belly: SCALY_YELLOW,
  head: EAGLE_WHITE,
  mane: EAGLE_WHITE,
  wing: EAGLE_WING,
  limb: SCALY_YELLOW,
  beak: BEAK,
  claw: TALON,
  eye: EAGLE_EYE,
  cloth: SKY_CLOTH,
  trim: GOLD,
  fire: FIRE_MOUTH,
  light: [hex('#ffffff'), hex('#d8f4ff'), hex('#6ec8f0'), hex('#2a6ab0')],
};

export const BENFICA_LOOK: BeastLook = {
  ...EAGLE_LOOK,
  key: 'eagle_benfica',
  wing: VICTORY_WING,
  kit: { shirt: BENFICA_RED, stripe: KIT_WHITE, pattern: 'plain', shorts: KIT_WHITE, socks: BENFICA_RED, collar: KIT_WHITE, badge: [KIT_WHITE, BENFICA_RED] },
  light: [hex('#ffffff'), hex('#ffd6d0'), hex('#ff4040'), hex('#a00818')],
};

export const LION_LOOK: BeastLook = {
  key: 'lion',
  kind: 'lion',
  hide: LION_FUR,
  belly: LION_CREAM,
  head: LION_FUR,
  mane: MANE,
  wing: MANE,
  limb: LION_FUR,
  beak: NOSE,
  claw: FANG,
  eye: LION_EYE,
  cloth: WAR_RED,
  trim: BRONZE,
  fire: FIRE_MOUTH,
  light: [hex('#fffbe8'), hex('#ffe08a'), hex('#f0a830'), hex('#a8581a')],
};

export const SPORTING_LOOK: BeastLook = {
  ...LION_LOOK,
  key: 'lion_sporting',
  hide: PRIDE_FUR,
  head: PRIDE_FUR,
  limb: PRIDE_FUR,
  mane: PRIDE_MANE,
  kit: { shirt: SPORTING_GREEN, stripe: KIT_WHITE, pattern: 'hoops', shorts: KIT_WHITE, socks: SPORTING_GREEN, collar: SPORTING_GREEN, badge: [SPORTING_GREEN, CROWN_GOLD] },
  light: [hex('#f4fff4'), hex('#b8ffc8'), hex('#2ed070'), hex('#0a7038')],
};

export const DRAGON_LOOK: BeastLook = {
  key: 'dragon',
  kind: 'dragon',
  hide: DRAGON_RED,
  belly: DRAGON_BELLY,
  head: DRAGON_RED,
  mane: HORN,
  wing: MEMBRANE,
  limb: DRAGON_RED,
  beak: HORN,
  claw: HORN,
  eye: EMBER_EYE,
  cloth: DARK_CLOTH,
  trim: IRON,
  fire: FIRE_MOUTH,
  light: [hex('#fff8d0'), hex('#ffd060'), hex('#ff7a10'), hex('#b02a08')],
};

export const PORTO_LOOK: BeastLook = {
  ...DRAGON_LOOK,
  key: 'dragon_porto',
  hide: PORTO_SCALE,
  head: PORTO_SCALE,
  limb: PORTO_SCALE,
  belly: PORTO_BELLY,
  mane: CROWN_GOLD,
  beak: CROWN_GOLD,
  claw: PORTO_BELLY,
  wing: PORTO_MEMBRANE,
  eye: ICE_EYE,
  fire: BLUE_FIRE,
  crown: true,
  kit: { shirt: PORTO_KIT, stripe: KIT_WHITE, pattern: 'stripes', shorts: PORTO_KIT, socks: PORTO_KIT, collar: PORTO_KIT, badge: [KIT_WHITE, PORTO_KIT] },
  light: [hex('#f4ffff'), hex('#9ee4ff'), hex('#2a8cff'), hex('#0a2a8a')],
};

export const BEAST_LOOKS = [EAGLE_LOOK, BENFICA_LOOK, LION_LOOK, SPORTING_LOOK, DRAGON_LOOK, PORTO_LOOK];

/** The look being drawn; set by buildBeastFrames. */
let S: BeastLook = EAGLE_LOOK;

const eagle = () => S.kind === 'eagle';
const lion = () => S.kind === 'lion';
const dragon = () => S.kind === 'dragon';

// ---------------------------------------------------------------------------
// The rig

/** A hand in the rig's terms: `f` forward, `s` out to its own side, `h` up from the chest. */
export interface Hand {
  f: number;
  s: number;
  h: number;
}

const H = (f: number, s: number, h: number): Hand => ({ f, s, h });

interface Pose {
  /** Whole body raised. */
  lift: number;
  /** Upper body lowered. */
  breath: number;
  /** Side view: forward (+) / back (-). Front/back: lift. */
  footA: number;
  footB: number;
  /** Upper body shifted forward (side view), in pixels. */
  lean: number;
  a: Hand;
  b: Hand;
  /** Wings: 0 folded at the back, 1 spread wide. */
  wing: number;
  /** Wings raised (+) or swept down and forward (-). */
  raise: number;
  /** 0..1 the beak, jaws or maw open. */
  mouth: number;
  /** Claws out and gleaming. */
  claws: boolean;
  /** 0..1 power: the feather in hand, the eyes, the fire in the throat. */
  glow: number;
  /** A feather of light held ready in this hand. */
  feather: 'a' | 'b' | null;
  /** The tail's swing, -1..1. */
  tail: number;
  tick: number;
  blink?: boolean;
}

type View = 'down' | 'up' | 'side';
type P = { x: number; y: number };

/** The chest row in body coordinates, the height hands are posed from. */
const CH = 18;
const RAD = Math.PI / 180;

interface Placed {
  x: number;
  y: number;
  /** Drawn behind the body. */
  behind: boolean;
}

/** Where a hand lands on screen in each view. `hx` is the upper body's centre (side view). */
function place(view: View, arm: 'a' | 'b', q: Hand, U: number, hx: number): Placed {
  const side = arm === 'a' ? -1 : 1;
  if (view === 'down') return { x: 12 + side * q.s, y: CH + U - q.h + q.f * 0.7, behind: q.f < -1 };
  if (view === 'up') return { x: 12 - side * q.s, y: CH + U - q.h - q.f * 0.8, behind: q.f > 1 };
  // Facing left; `a` is the far arm, a touch higher and behind the body.
  const far = arm === 'a';
  return { x: hx - 1 - q.f * 1.05 + (far ? 0.8 : 0), y: CH + U - q.h + (far ? -0.6 : 0.3), behind: far && q.f < 1 };
}

/** Two bones from the shoulder to the hand, the elbow on the side `hint` points. */
function elbow(sx: number, sy: number, fx: number, fy: number, reach: number, hint: [number, number]): [number, number] {
  const dx = fx - sx;
  const dy = fy - sy;
  const d = Math.hypot(dx, dy) || 0.01;
  let ex = sx + dx / 2;
  let ey = sy + dy / 2;
  if (d < reach * 2) {
    const ang = Math.acos(Math.min(1, d / (reach * 2)));
    const base = Math.atan2(dy, dx);
    let best = -Infinity;
    for (const t of [base + ang, base - ang]) {
      const cx = sx + Math.cos(t) * reach;
      const cy = sy + Math.sin(t) * reach;
      const score = (cx - sx) * hint[0] + (cy - sy) * hint[1];
      if (score > best) {
        best = score;
        ex = cx;
        ey = cy;
      }
    }
  }
  return [ex, ey];
}

/** Fill a triangle, pixel centres inside it; `keep` can carve pieces out of it. */
function tri(c: PixelCanvas, a: P, b: P, d: P, m: Material, n: Vec3, bias = 0, keep?: (x: number, y: number) => boolean): void {
  const s = (p: P, q: P, x: number, y: number) => (q.x - p.x) * (y - p.y) - (q.y - p.y) * (x - p.x);
  for (let y = Math.floor(Math.min(a.y, b.y, d.y)); y <= Math.ceil(Math.max(a.y, b.y, d.y)); y++) {
    for (let x = Math.floor(Math.min(a.x, b.x, d.x)); x <= Math.ceil(Math.max(a.x, b.x, d.x)); x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const s1 = s(a, b, px, py);
      const s2 = s(b, d, px, py);
      const s3 = s(d, a, px, py);
      if (!((s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0))) continue;
      if (keep && !keep(px, py)) continue;
      c.px(x, y, m, n, { bias });
    }
  }
}

/** A small cross of light, the arms growing with `k`. */
function glowAt(c: PixelCanvas, x: number, y: number, k: number): void {
  if (k <= 0) return;
  const [core, hot, mid] = S.light;
  c.spark(x, y, core, k);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.spark(x + dx, y + dy, hot, 0.6 * k);
  if (k > 0.6) for (const [dx, dy] of [[2, 0], [-2, 0], [0, -2], [0, 2]]) c.spark(x + dx, y + dy, mid, 0.4 * k);
}

// ---------------------------------------------------------------------------
// Wings and tails

/**
 * The eagle's wing, rooted at the shoulder blade (rx, ry): a leading edge to
 * the wrist and seven long feathers fanning from it, from hanging down along
 * the body to reaching out past the wrist. Folded, they hang to the knees
 * like a cloak; spread, the primaries part at the tip like fingers. `k` is
 * the side it spreads to (-1 left).
 */
function featherWing(c: PixelCanvas, rx: number, ry: number, k: number, open: number, raise: number, size: number, bias: number): void {
  const m = S.wing;
  const wx = rx + k * (2 + 9 * open) * size;
  const wy = ry - (3.5 + 2.5 * open + raise * 3.5 * (0.3 + open * 0.7)) * size;
  const n = 7;
  const bases: P[] = [];
  const tips: P[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const bx = rx + (wx - rx) * t;
    const by = ry + (wy - ry) * t;
    const a = (5 + t * (12 + 88 * open) + raise * 10 * open * t) * RAD;
    const len = (10.5 - 2.5 * open + t * (1.5 + 3.8 * open)) * size;
    bases.push({ x: bx, y: by });
    tips.push({ x: bx + k * Math.sin(a) * len, y: by + Math.cos(a) * len });
  }
  // The web under the feathers, in shade, so it reads as one wing and not a comb.
  c.part();
  for (let i = 0; i < n - 1; i++) {
    const q = [bases[i], tips[i], tips[i + 1], bases[i + 1]];
    tri(c, q[0], q[1], q[2], m, { x: k * 0.3, y: -0.2, z: 0.93 }, bias - 1);
    tri(c, q[0], q[2], q[3], m, { x: k * 0.3, y: -0.2, z: 0.93 }, bias - 1);
  }
  // The long feathers, each a lighter ridge; the outer primaries dark at the tip.
  for (let i = 0; i < n; i++) {
    c.part();
    const b = bases[i];
    const t = tips[i];
    c.capsule(b.x, b.y, t.x, t.y, 1.05 * size, 0.45, m, { bias: bias + (i % 2 ? 1 : 0) });
    if (i >= n - 3) c.capsule(b.x + (t.x - b.x) * 0.72, b.y + (t.y - b.y) * 0.72, t.x, t.y, 0.7, 0.4, m, { bias: bias - 1 });
  }
  // Coverts over the feathers' roots, lit along the leading edge.
  c.part();
  c.capsule(rx, ry, wx, wy, 1.8 * size, 1.1 * size, m, { bias: bias + 1 });
  c.capsule(rx + (wx - rx) * 0.15, ry + (wy - ry) * 0.15 + 1.4, rx + (wx - rx) * 0.8, ry + (wy - ry) * 0.8 + 1.6, 1.35 * size, 0.9 * size, m, { bias });
  // Gilded wings glint along the leading edge and at the tips.
  if (S.kit && eagle()) {
    for (let t = 0.2; t < 1; t += 0.3) c.spark(rx + (wx - rx) * t, ry + (wy - ry) * t - 1, S.light[1], 0.25 + open * 0.2);
    if (open > 0.5) tips.slice(n - 3).forEach((p) => c.spark(p.x, p.y, hex('#fff0b0'), 0.35));
  }
}

/**
 * The dragon's wing: an arm of bone to the wrist, four long fingers of bone
 * fanning from it, and membrane stretched between them in scallops, down to
 * the flank. A claw at the wrist.
 */
function membraneWing(c: PixelCanvas, rx: number, ry: number, k: number, open: number, raise: number, size: number, bias: number): void {
  const m = S.wing;
  const bone = S.hide;
  const wx = rx + k * (2.2 + 8 * open) * size;
  const wy = ry - (5 + 3 * open + raise * 3.5 * (0.3 + open * 0.7)) * size;
  const n = 4;
  const tips: P[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const a = (6 + t * (26 + 84 * open) + raise * 12 * open * t) * RAD;
    const len = (9.5 + t * (1 + 2 * open) + open * 2.5) * size;
    tips.push({ x: wx + k * Math.sin(a) * len, y: wy + Math.cos(a) * len });
  }
  const root: P = { x: rx, y: ry };
  const wrist: P = { x: wx, y: wy };
  const flank: P = { x: rx + k * 0.5, y: ry + 8 * size };
  // Scallops: the membrane sags between the fingers' tips.
  const keep = (px: number, py: number): boolean => {
    for (let i = 0; i < n - 1; i++) {
      const a = tips[i];
      const b = tips[i + 1];
      const mx = (a.x + b.x) / 2 + (wrist.x - (a.x + b.x) / 2) * 0.12;
      const my = (a.y + b.y) / 2 + (wrist.y - (a.y + b.y) / 2) * 0.12;
      if (Math.hypot(px - mx, py - my) < Math.hypot(a.x - b.x, a.y - b.y) * 0.32) return false;
    }
    const mx = (tips[0].x + flank.x) / 2;
    const my = (tips[0].y + flank.y) / 2;
    return Math.hypot(px - mx, py - my) >= Math.hypot(tips[0].x - flank.x, tips[0].y - flank.y) * 0.28;
  };
  c.part();
  const nm: Vec3 = { x: k * 0.25, y: -0.15, z: 0.95 };
  for (let i = 0; i < n - 1; i++) tri(c, wrist, tips[i], tips[i + 1], m, nm, bias, keep);
  tri(c, root, wrist, tips[0], m, nm, bias - 1, keep);
  tri(c, root, tips[0], flank, m, nm, bias - 1, keep);
  // Veins of shade across the membrane.
  for (let i = 0; i < n; i++) {
    const t = tips[i];
    for (let q = 0.35; q < 0.9; q += 0.3) c.shade(wrist.x + (t.x - wrist.x) * q + k * 1.2, wrist.y + (t.y - wrist.y) * q + 1, -1);
  }
  // The bones over it: the arm, then the fingers, and the claw at the wrist.
  c.part();
  c.capsule(rx, ry, wx, wy, 1.5 * size, 1.1 * size, bone, { bias: bias + 1 });
  for (let i = 0; i < n; i++) {
    c.part();
    c.capsule(wx, wy, tips[i].x, tips[i].y, 0.75 * size, 0.35, bone, { bias });
  }
  c.part();
  c.px(wx + k * 0.3, wy - 1.4, S.claw, sphere(k * 0.3, 0.6), { bias: 1 });
  if (S.kit) for (const t of tips) c.spark(t.x, t.y, S.light[1], 0.3 + open * 0.2);
}

/** Both wings, as the kind has them. */
function wings(c: PixelCanvas, view: View, cx: number, U: number, p: Pose, when: 'behind' | 'front', hx = cx): void {
  if (lion()) return;
  const draw = eagle() ? featherWing : membraneWing;
  const ry = 15.6 + U;
  if (view === 'down') {
    if (when !== 'behind') return;
    draw(c, cx - 2.4, ry, -1, p.wing, p.raise, 0.92, -1);
    draw(c, cx + 2.4, ry, 1, p.wing, p.raise, 0.92, -1);
  } else if (view === 'up') {
    if (when !== 'front') return;
    draw(c, cx - 2.4, ry, -1, p.wing, p.raise, 0.92, 0);
    draw(c, cx + 2.4, ry, 1, p.wing, p.raise, 0.92, 0);
  } else if (when === 'behind') {
    // The far wing, raised a little higher and smaller, behind the body.
    draw(c, hx + 2.2, ry - 0.6, 1, p.wing, p.raise + 0.4, 0.78, -2);
  } else {
    draw(c, hx + 1.8, ry + 0.2, 1, p.wing * 0.9, p.raise, 0.88, 0);
  }
}

/**
 * The tail: the lion's, thin with a dark tuft; the dragon's, thick and
 * tapering to a spade; the eagle's, a fan of white feathers. `k` is the side
 * it trails to, `(x, y)` its root.
 */
function tail(c: PixelCanvas, x: number, y: number, k: number, swing: number, view: View, bias = 0): void {
  if (eagle()) {
    // A fan of five white feathers from under the kilt.
    const spread = view === 'side' ? 0.45 : 1;
    for (let i = 0; i < 5; i++) {
      c.part();
      const t = i - 2;
      const ex = view === 'side' ? x + k * (3.2 + i * 0.7) : x + t * 1.9 * spread + swing * 0.6;
      const ey = view === 'side' ? y + 4.6 - i * 0.5 : y + 5.6 - Math.abs(t) * 0.5;
      c.capsule(x + (view === 'side' ? 0 : t * 0.7), y, ex, ey, 0.95, 0.65, S.head, { bias: bias + (i % 2 ? 0 : 1) });
    }
    return;
  }
  const pts: P[] = [];
  const N = 7;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    if (lion()) {
      // Out and down, then curling up at the end, flicking with the swing.
      pts.push({ x: x + k * (t * 8.5) + swing * t * t * 2, y: y + Math.sin(t * Math.PI * 0.9) * 3.4 - t * t * 3.2 });
    } else {
      // The dragon's lies heavy on the ground, sweeping out behind.
      pts.push({ x: x + k * (t * 9.5) + swing * t * t * 2.5, y: y + t * 5.2 - t * t * 1.4 });
    }
  }
  const r0 = lion() ? 0.8 : 2.1;
  const r1 = lion() ? 0.6 : 0.6;
  c.part();
  for (let i = 0; i < N; i++) {
    const t0 = i / N;
    const t1 = (i + 1) / N;
    c.capsule(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, r0 + (r1 - r0) * t0, r0 + (r1 - r0) * t1, S.hide, { bias });
  }
  const end = pts[N];
  c.part();
  if (lion()) {
    c.ellipse(end.x + k * 0.4, end.y - 0.4, 1.4, 1.5, S.mane, { bias });
  } else {
    // The spade: a leaf of scale, and a row of spines along the tail's top.
    const dir = { x: end.x - pts[N - 1].x, y: end.y - pts[N - 1].y };
    const l = Math.hypot(dir.x, dir.y) || 1;
    const ux = dir.x / l;
    const uy = dir.y / l;
    const tip = { x: end.x + ux * 3.2, y: end.y + uy * 3.2 };
    tri(c, { x: end.x - uy * 2, y: end.y + ux * 2 }, tip, { x: end.x + uy * 2, y: end.y - ux * 2 }, S.hide, sphere(k * 0.2, -0.3), bias + 1);
    c.part();
    for (let i = 1; i < N; i += 2) c.px(pts[i].x, pts[i].y - (r0 + (r1 - r0) * (i / N)) - 0.4, S.claw, sphere(0, 0.6), { bias });
  }
}

// ---------------------------------------------------------------------------
// Arms and legs

/**
 * An arm: plumage, fur or scales (a short sleeve of the shirt in a club kit),
 * a bracer at the wrist, then the hand: talons, a paw or a clawed hand, the
 * claws gleaming when they are out.
 */
function arm(c: PixelCanvas, sx: number, sy: number, p: Placed, reach: number, hint: [number, number], claws: boolean, bias = 0): void {
  const [ex, ey] = elbow(sx, sy, p.x, p.y, reach, hint);
  const wx = ex + (p.x - ex) * 0.72;
  const wy = ey + (p.y - ey) * 0.72;
  const kit = S.kit;
  const thick = lion() ? 1.2 : 1;
  c.part();
  c.capsule(sx, sy, ex, ey, 1.9 * thick, 1.6 * thick, kit ? kit.shirt : S.hide, { bias });
  if (kit) {
    // The sleeve's cuff, then the bare arm below it.
    c.part();
    c.ellipse(sx + (ex - sx) * 0.8, sy + (ey - sy) * 0.8, 1.5 * thick, 1.2, kit.stripe, { bias });
  }
  c.part();
  c.capsule(ex, ey, wx, wy, 1.5 * thick, 1.3 * thick, S.hide, { bias });
  if (!kit) {
    c.part();
    c.ellipse(wx, wy, 1.4 * thick, 1.1, S.trim, { bias: bias + 1 });
  }
  hand(c, p.x, p.y, ex, ey, claws, bias);
}

function hand(c: PixelCanvas, x: number, y: number, ex: number, ey: number, claws: boolean, bias = 0): void {
  const r = lion() ? 1.55 : 1.2;
  c.part();
  c.ellipse(x, y, r, r * 0.95, S.limb, { bias });
  if (!claws && !eagle()) return;
  // Claws along the way the forearm points.
  const dx = x - ex;
  const dy = y - ey;
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l;
  const uy = dy / l;
  c.part();
  for (const s of [-0.9, 0, 0.9]) {
    const cx = x + ux * (r + 0.4) - uy * s;
    const cy = y + uy * (r + 0.4) + ux * s;
    c.px(cx, cy, S.claw, sphere(ux * 0.5, -uy * 0.5 - 0.2), { bias: bias + 1 });
  }
  if (claws) {
    const [core] = S.light;
    c.spark(x + ux * (r + 1.2), y + uy * (r + 1.2), core, 0.45);
  }
}

/** A foot: the eagle's three talons, the lion's round paw, the dragon's clawed foot. */
function foot(c: PixelCanvas, x: number, y: number, side: boolean, bias = 0): void {
  c.part();
  if (eagle()) {
    if (side) {
      c.line(x + 0.6, y, x - 2.4, y + 0.6, S.limb, () => sphere(-0.3, 0.2), { bias });
      c.px(x + 1.6, y + 0.4, S.limb, sphere(0.5, 0.2), { bias });
      c.part();
      c.px(x - 3.2, y + 0.6, S.claw, sphere(-0.5, 0.3), { bias });
      c.px(x + 2.4, y + 0.6, S.claw, sphere(0.5, 0.3), { bias });
    } else {
      for (const dx of [-1.4, 0, 1.4]) c.line(x, y - 0.4, x + dx, y + 0.8, S.limb, () => sphere(dx * 0.3, 0.3), { bias });
      c.part();
      for (const dx of [-1.6, 0, 1.6]) c.px(x + dx, y + 1.4, S.claw, sphere(dx * 0.3, 0.5), { bias });
    }
    return;
  }
  if (lion()) {
    c.ellipse(x - (side ? 0.6 : 0), y + 0.2, side ? 2.5 : 2.1, 1.45, S.limb, { flatten: 0.8, bias });
    // The toes' clefts.
    c.part();
    if (side) c.shade(x - 2, y + 0.6, -1);
    else for (const dx of [-1, 0]) c.shade(x + dx, y + 1, -1);
  } else {
    c.ellipse(x - (side ? 0.6 : 0), y + 0.2, side ? 2.4 : 2.0, 1.35, S.limb, { flatten: 0.8, bias });
    c.part();
    if (side) {
      c.px(x - 3.2, y + 0.8, S.claw, sphere(-0.5, 0.3), { bias });
      c.px(x - 2.2, y + 1.2, S.claw, sphere(-0.3, 0.4), { bias: bias - 1 });
    } else for (const dx of [-1.4, 0, 1.4]) c.px(x + dx - 0.5, y + 1.4, S.claw, sphere(dx * 0.3, 0.5), { bias });
  }
}

/**
 * A leg from the hip to the ankle: the eagle's feathered thigh and thin
 * scaled shin, the lion's and the dragon's thick ones; shorts and socks in a
 * club kit.
 */
function leg(c: PixelCanvas, hx: number, hy: number, ax: number, ay: number, bias = 0): void {
  const kx = hx + (ax - hx) * 0.5;
  const ky = hy + (ay - hy) * 0.5;
  const kit = S.kit;
  c.part();
  if (eagle()) {
    c.capsule(hx, hy, kx, ky, 1.9, 1.5, S.hide, { bias });
    c.part();
    c.capsule(kx, ky, ax, ay, 0.85, 0.75, S.limb, { bias });
  } else {
    const r = lion() ? 1.95 : 2.05;
    c.capsule(hx, hy, ax, ay, r, r - 0.4, S.hide, { bias });
  }
  if (kit) {
    // A sock from under the knee to the ankle, a band of the second colour at its top.
    c.part();
    const sx = kx + (ax - kx) * 0.25;
    const sy = ky + (ay - ky) * 0.25;
    const r = eagle() ? 1.0 : 1.75;
    c.capsule(sx, sy, ax, ay - 0.4, r, r - 0.2, kit.socks, { bias });
    c.part();
    c.ellipse(sx, sy, r + 0.1, 0.6, kit.stripe, { bias });
  }
}

// ---------------------------------------------------------------------------
// Heads

/** The eagle from the front: white feathered head, fierce brows, the hooked golden beak (open as it screeches). */
function eagleDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  // The white ruff spilling onto the chest.
  c.part();
  c.ellipse(cx, 14.8 + U, 3.7, 1.7, S.head, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.5 - 0.3, 1) });
  c.part();
  for (const x of [cx - 3, cx - 1, cx + 1, cx + 2]) c.px(x, 16.2 + U, S.head, sphere((x + 0.5 - cx) / 4, 0.4), { bias: -1 });
  c.part();
  c.ellipse(cx, 11.2 + U, 3.4, 3.2, S.head);
  // Eyes under a heavy brow that dips toward the beak.
  c.part();
  for (const x of [cx - 2, cx + 1]) {
    if (p.blink) c.px(x, 11 + U, S.head, sphere(0, -0.3), { bias: -1 });
    else c.px(x, 11 + U, S.eye);
  }
  for (const x of [cx - 3, cx - 2, cx + 1, cx + 2]) c.shade(x, 10 + U, -2);
  c.shade(cx - 1, 10.8 + U, -1);
  c.shade(cx, 10.8 + U, -1);
  if (p.glow > 0.3) for (const x of [cx - 2, cx + 1]) c.spark(x, 11 + U, S.light[1], p.glow * 0.4);
  // The beak: a yellow cere across its root, the hooked bill hanging from it.
  c.part();
  c.px(cx - 2, 12 + U, S.beak, sphere(-0.6, 0), { bias: -1 });
  c.px(cx + 1, 12 + U, S.beak, sphere(0.6, 0), { bias: -1 });
  c.px(cx - 1, 12 + U, S.beak, sphere(-0.3, 0.4), { bias: 1 });
  c.px(cx, 12 + U, S.beak, sphere(0.3, 0.4), { bias: 1 });
  c.px(cx - 1, 13 + U, S.beak, sphere(-0.3, 0));
  c.px(cx, 13 + U, S.beak, sphere(0.3, 0));
  if (p.mouth > 0.4) {
    c.part();
    c.px(cx - 1, 14 + U, MOUTH, sphere(0, 0));
    c.px(cx, 14 + U, MOUTH, sphere(0, 0));
    c.part();
    c.px(cx - 1, 15 + U, S.beak, sphere(-0.3, 0.3), { bias: -1 });
    c.px(cx, 15 + U, S.beak, sphere(0.3, 0.3), { bias: -1 });
  } else {
    c.px(cx - 1, 14 + U, S.beak, sphere(-0.2, 0.5), { bias: -1 });
    c.px(cx, 14 + U, S.beak, sphere(0.2, 0.5), { bias: -1 });
  }
}

function eagleUp(c: PixelCanvas, cx: number, U: number): void {
  c.part();
  c.ellipse(cx, 14.6 + U, 3.6, 1.6, S.head, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.5 - 0.3, 1) });
  c.part();
  c.ellipse(cx, 11.2 + U, 3.4, 3.2, S.head);
  // The nape's feathers lying down in points.
  c.part();
  for (const [x, y] of [[cx - 2, 13.6], [cx, 14], [cx + 1, 13.4], [cx - 1, 7.6], [cx, 7.6]] as const) c.px(x, y + U, S.head, sphere((x + 0.5 - cx) / 3, -0.5), { bias: 1 });
  for (let y = 9; y <= 13; y += 2) c.shade(cx - 1, y + U, -1);
  // From behind, only the beak's gold edge shows at the cheeks.
  c.px(cx - 4, 12 + U, S.beak, sphere(-0.8, 0), { bias: -1 });
  c.px(cx + 3, 12 + U, S.beak, sphere(0.8, 0), { bias: -1 });
}

function eagleSide(c: PixelCanvas, hx: number, U: number, p: Pose): void {
  c.part();
  c.ellipse(hx + 0.4, 14.8 + U, 3.0, 1.6, S.head, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.5 - 0.3, 1) });
  c.part();
  c.ellipse(hx - 0.2, 11.2 + U, 3.1, 3.0, S.head);
  // Feathers swept back from the crown and nape.
  c.part();
  for (const [x, y] of [[hx + 3, 9.6], [hx + 3.4, 11.4], [hx + 2.6, 8.2], [hx + 3, 13.2]] as const) c.px(x, y + U, S.head, sphere(0.6, -0.4), { bias: 1 });
  c.part();
  if (p.blink) c.px(hx - 2, 11 + U, S.head, sphere(0, -0.3), { bias: -1 });
  else c.px(hx - 2, 11 + U, S.eye);
  c.shade(hx - 3, 10 + U, -2);
  c.shade(hx - 2, 10 + U, -2);
  c.shade(hx - 1, 10 + U, -1);
  if (p.glow > 0.3) c.spark(hx - 2, 11 + U, S.light[1], p.glow * 0.4);
  // The beak: the cere, the bill arching out and hooking down to its point.
  c.part();
  c.px(hx - 4, 11 + U, S.beak, sphere(-0.2, 0.3), { bias: -1 });
  c.px(hx - 5, 11 + U, S.beak, sphere(-0.3, 0.6), { bias: 1 });
  c.px(hx - 4, 12 + U, S.beak, sphere(-0.2, 0));
  c.px(hx - 5, 12 + U, S.beak, sphere(-0.4, 0));
  c.px(hx - 6, 12 + U, S.beak, sphere(-0.7, 0.2), { bias: 1 });
  c.px(hx - 6, 13 + U, S.beak, sphere(-0.6, -0.4), { bias: -1 });
  if (p.mouth > 0.4) {
    c.part();
    c.px(hx - 5, 13 + U, MOUTH, sphere(0, 0));
    c.px(hx - 4, 13 + U, MOUTH, sphere(0, 0));
    c.part();
    c.px(hx - 5, 14 + U, S.beak, sphere(-0.3, -0.3), { bias: -1 });
    c.px(hx - 4, 14 + U, S.beak, sphere(0, -0.3), { bias: -1 });
  } else c.px(hx - 5, 13 + U, S.beak, sphere(-0.2, -0.4), { bias: -1 });
}

/** The mane: a great ruff round the face, ragged at its rim, spilling onto the chest. */
function mane(c: PixelCanvas, x: number, y: number, rx: number, ry: number, tick: number, from = 0, to = Math.PI * 2): void {
  const n = (_x: number, _y: number, dx: number, dy: number) => sphere(dx * 0.9, dy * 0.85 - 0.15, 1);
  c.part();
  c.ellipse(x, y, rx, ry, S.mane, { normal: n });
  // Tufts round the rim, a few stirring from frame to frame.
  c.part();
  const N = 14;
  for (let i = 0; i < N; i++) {
    const a = from + ((to - from) * (i + 0.5)) / N;
    const wob = (i + tick) % 4 === 0 ? 0.6 : 0;
    const tx = x + Math.cos(a) * (rx + 0.6 + wob);
    const ty = y + Math.sin(a) * (ry + 0.5 + wob);
    c.px(tx, ty, S.mane, sphere(Math.cos(a) * 0.8, -Math.sin(a) * 0.8), { bias: i % 2 ? 1 : 0 });
  }
  // Locks: darker grooves running out from the face.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.3;
    c.shade(x + Math.cos(a) * rx * 0.72, y + Math.sin(a) * ry * 0.72, -1);
  }
}

/** The lion from the front: mane, round ears, the cream muzzle and black nose; roaring, the jaws gape round white fangs. */
function lionDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  mane(c, cx, 12 + U, 5.4, 5.0, p.tick);
  c.part();
  c.ellipse(cx, 16.2 + U, 4.2, 1.8, S.mane, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.6, 1) });
  // Ears in the mane's top.
  c.part();
  for (const x of [cx - 3.4, cx + 3.4]) c.ellipse(x, 8.4 + U, 1.3, 1.2, S.hide);
  c.shade(cx - 4, 8 + U, -2);
  c.shade(cx + 3, 8 + U, -2);
  c.part();
  c.ellipse(cx, 12 + U, 3.1, 3.0, S.head);
  c.part();
  for (const x of [cx - 2, cx + 1]) {
    if (p.blink) c.px(x, 11 + U, S.head, sphere(0, -0.3), { bias: -1 });
    else c.px(x, 11 + U, S.eye);
  }
  c.shade(cx - 2, 10 + U, -1);
  c.shade(cx + 1, 10 + U, -1);
  c.shade(cx - 1, 10 + U, 1);
  c.shade(cx, 10 + U, 1);
  if (p.glow > 0.4) for (const x of [cx - 2, cx + 1]) c.spark(x, 11 + U, S.light[1], p.glow * 0.5);
  // The muzzle and nose.
  const open = p.mouth;
  c.part();
  c.ellipse(cx, 13.9 + U + open * 0.4, 2.3, 1.4 + open * 0.5, S.belly);
  c.part();
  c.px(cx - 1, 12.6 + U, S.beak, sphere(-0.3, 0.4));
  c.px(cx, 12.6 + U, S.beak, sphere(0.3, 0.4));
  if (open > 0.3) {
    const rows = open > 0.75 ? 2 : 1;
    c.part();
    for (let r = 0; r < rows; r++) for (const x of [cx - 1, cx]) c.px(x, 14.4 + U + r, MOUTH, sphere(0, 0));
    c.part();
    c.px(cx - 2, 14.4 + U, FANG, sphere(-0.4, 0.3));
    c.px(cx + 1, 14.4 + U, FANG, sphere(0.4, 0.3));
    if (rows > 1) {
      c.px(cx - 2, 15.4 + U, FANG, sphere(-0.4, -0.3), { bias: -1 });
      c.px(cx + 1, 15.4 + U, FANG, sphere(0.4, -0.3), { bias: -1 });
    }
    // The chin.
    c.px(cx - 1, 14.4 + U + rows, S.belly, sphere(-0.2, 0.6));
    c.px(cx, 14.4 + U + rows, S.belly, sphere(0.2, 0.6));
  } else {
    c.shade(cx - 1, 14.4 + U, -2);
    c.shade(cx, 14.4 + U, -2);
  }
}

function lionUp(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  mane(c, cx, 12.2 + U, 5.4, 5.2, p.tick);
  c.part();
  c.ellipse(cx, 16 + U, 4.4, 2.0, S.mane, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.6, 1) });
  c.part();
  for (const x of [cx - 3.4, cx + 3.4]) c.ellipse(x, 8 + U, 1.3, 1.2, S.hide);
}

function lionSide(c: PixelCanvas, hx: number, U: number, p: Pose): void {
  mane(c, hx + 1.4, 12 + U, 4.4, 5.0, p.tick, -Math.PI / 2, Math.PI * 1.1);
  c.part();
  c.ellipse(hx + 0.4, 16 + U, 3.4, 1.8, S.mane, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.6, 1) });
  c.part();
  c.ellipse(hx + 0.6, 8.2 + U, 1.3, 1.2, S.hide);
  c.shade(hx, 8 + U, -2);
  const open = p.mouth;
  c.part();
  c.ellipse(hx - 1.2, 12 + U, 2.9, 2.9, S.head);
  // The muzzle jutting forward; the jaw drops as he roars.
  c.part();
  c.ellipse(hx - 3.7, 13.2 + U, 1.9, 1.35, S.belly);
  c.px(hx - 5.4, 12.3 + U, S.beak, sphere(-0.6, 0.4));
  c.px(hx - 4.6, 12.3 + U, S.beak, sphere(-0.2, 0.5), { bias: -1 });
  c.part();
  if (p.blink) c.px(hx - 3, 11 + U, S.head, sphere(0, -0.3), { bias: -1 });
  else c.px(hx - 3, 11 + U, S.eye);
  c.shade(hx - 3, 10 + U, -1);
  c.shade(hx - 2, 10 + U, 1);
  if (p.glow > 0.4) c.spark(hx - 3, 11 + U, S.light[1], p.glow * 0.5);
  if (open > 0.3) {
    c.part();
    const drop = open > 0.75 ? 2 : 1;
    for (let r = 0; r < drop; r++) for (const x of [hx - 5, hx - 4, hx - 3]) c.px(x, 14.4 + U + r, MOUTH, sphere(0, 0));
    c.part();
    c.px(hx - 5, 14.4 + U, FANG, sphere(-0.4, 0.2));
    c.part();
    c.capsule(hx - 1.6, 14.6 + U + drop * 0.5, hx - 4.8, 15.2 + U + drop, 1.0, 0.7, S.belly);
  } else c.shade(hx - 4, 14.2 + U, -1);
}

/** The dragon's horns, sweeping back and up from the brow; Porto's gold crown sits between them. */
function horns(c: PixelCanvas, cx: number, U: number, view: View, hx = cx): void {
  c.part();
  if (view === 'side') {
    c.capsule(hx + 0.4, 8.2 + U, hx + 3.4, 6.2 + U, 0.9, 0.6, S.mane, { bias: -1 });
    c.capsule(hx + 3.4, 6.2 + U, hx + 5, 6.4 + U, 0.6, 0.3, S.mane, { bias: -1 });
    c.part();
    c.capsule(hx + 1, 8.8 + U, hx + 3.8, 6.9 + U, 1.05, 0.7, S.mane);
    c.capsule(hx + 3.8, 6.9 + U, hx + 5.6, 7.3 + U, 0.7, 0.3, S.mane);
  } else {
    for (const s of [-1, 1]) {
      c.capsule(cx + s * 2.4, 8.8 + U, cx + s * 4.2, 6.4 + U, 1.1, 0.8, S.mane, { bias: view === 'up' ? 0 : -1 });
      c.capsule(cx + s * 4.2, 6.4 + U, cx + s * 4.6, 4.2 + U, 0.8, 0.35, S.mane, { bias: view === 'up' ? 0 : -1 });
    }
  }
  if (S.crown) {
    // Three little points of gold, a jewel of fire in the middle.
    c.part();
    const x0 = view === 'side' ? hx - 1 : cx - 2;
    const w = view === 'side' ? 3 : 4;
    for (let x = x0; x < x0 + w; x++) c.px(x, 7.6 + U, CROWN_GOLD, cyl((x + 0.5 - x0 - w / 2) / (w / 2), 0.2));
    for (const x of view === 'side' ? [x0, x0 + 2] : [x0, x0 + 3]) c.px(x, 6.6 + U, CROWN_GOLD, sphere(0, -0.6), { bias: 1 });
    if (view !== 'side') {
      c.px(cx - 1, 6.2 + U, CROWN_GOLD, sphere(-0.2, -0.6), { bias: 1 });
      c.px(cx, 6.2 + U, CROWN_GOLD, sphere(0.2, -0.6), { bias: 1 });
    } else c.px(x0 + 1, 6.2 + U, CROWN_GOLD, sphere(0, -0.6), { bias: 1 });
    if (view !== 'up') c.spark(view === 'side' ? x0 + 1 : cx - 0.5, 7.6 + U, S.light[1], 0.5);
  }
}

/** The dragon from the front: horns, brow ridges over ember eyes, the snout; the jaws open on fire. */
function dragonDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  horns(c, cx, U, 'down');
  c.part();
  c.ellipse(cx, 10.8 + U, 3.2, 2.8, S.head);
  // Frills at the jaw's hinge.
  c.part();
  c.px(cx - 4, 11.6 + U, S.mane, sphere(-0.8, 0.2));
  c.px(cx + 3, 11.6 + U, S.mane, sphere(0.8, 0.2));
  // The snout toward us, nostrils smoking with embers.
  const open = p.mouth;
  c.part();
  c.ellipse(cx, 12.8 + U, 2.4, 1.7, S.head, { bias: 1 });
  c.shade(cx - 2, 12.4 + U, -2);
  c.shade(cx + 1, 12.4 + U, -2);
  const [core, hot] = S.light;
  if (p.glow > 0.1) {
    c.spark(cx - 2, 12.4 + U, hot, p.glow * 0.6);
    c.spark(cx + 1, 12.4 + U, hot, p.glow * 0.6);
  }
  c.part();
  for (const x of [cx - 2, cx + 1]) {
    if (p.blink) c.px(x, 10.4 + U, S.head, sphere(0, -0.3), { bias: -1 });
    else c.px(x, 10.4 + U, S.eye);
  }
  for (const x of [cx - 3, cx - 2, cx + 1, cx + 2]) c.shade(x, 9.4 + U, x === cx - 2 || x === cx + 1 ? 1 : -1);
  if (open > 0.3) {
    const rows = open > 0.75 ? 2 : 1;
    c.part();
    for (let r = 0; r < rows; r++) for (const x of [cx - 1, cx]) c.px(x, 14.3 + U + r, S.fire, sphere(0, 0));
    c.part();
    c.px(cx - 2, 14.3 + U, S.claw, sphere(-0.4, 0.3));
    c.px(cx + 1, 14.3 + U, S.claw, sphere(0.4, 0.3));
    c.part();
    for (const x of [cx - 2, cx - 1, cx, cx + 1]) c.px(x, 14.3 + U + rows, S.head, sphere((x + 0.5 - cx) / 2.5, 0.6), { bias: -1 });
    c.spark(cx - 1, 14.3 + U, core, 0.5 + p.glow * 0.5);
    c.spark(cx, 14.3 + U, core, 0.5 + p.glow * 0.5);
  } else {
    for (const x of [cx - 2, cx - 1, cx, cx + 1]) c.shade(x, 14.2 + U, -1);
  }
}

function dragonUp(c: PixelCanvas, cx: number, U: number): void {
  c.part();
  c.ellipse(cx, 10.8 + U, 3.2, 2.9, S.head);
  horns(c, cx, U, 'up');
  // Spines down the back of the neck.
  c.part();
  for (const y of [12.6, 14.2]) {
    c.px(cx - 1, y + U, S.claw, sphere(-0.2, -0.6));
    c.px(cx, y + U, S.claw, sphere(0.2, -0.6));
  }
}

function dragonSide(c: PixelCanvas, hx: number, U: number, p: Pose): void {
  const open = p.mouth;
  c.part();
  c.ellipse(hx - 0.2, 10.6 + U, 2.9, 2.6, S.head);
  // The long snout, and the jaw hinged below it.
  c.part();
  c.capsule(hx - 1.4, 11.4 + U, hx - 5.2, 11.9 + U, 1.75, 1.3, S.head, { bias: 1 });
  c.part();
  c.capsule(hx - 1.2, 12.9 + U + open * 0.6, hx - 4.6, 13.4 + U + open * 1.8, 1.1, 0.8, S.head, { bias: -1 });
  if (open > 0.3) {
    c.part();
    for (let x = Math.round(hx - 5); x <= hx - 2; x++) c.px(x, 13 + U + (open > 0.75 ? 0.6 : 0), S.fire, sphere(0, 0));
    c.px(hx - 5, 12.9 + U, S.claw, sphere(-0.4, 0.2), { bias: 1 });
    c.spark(hx - 5, 13 + U, S.light[0], 0.5 + p.glow * 0.5);
  } else c.shade(hx - 4, 12.9 + U, -1);
  c.part();
  c.shade(hx - 6, 11.2 + U, -2);
  if (p.glow > 0.1) c.spark(hx - 6, 11.2 + U, S.light[1], p.glow * 0.7);
  c.part();
  if (p.blink) c.px(hx - 2, 10 + U, S.head, sphere(0, -0.3), { bias: -1 });
  else c.px(hx - 2, 10 + U, S.eye);
  c.shade(hx - 2, 9 + U, 1);
  c.shade(hx - 3, 9.4 + U, -1);
  horns(c, hx, U, 'side', hx);
  // Spines down the nape.
  c.part();
  c.px(hx + 2.4, 12 + U, S.claw, sphere(0.6, -0.3));
  c.px(hx + 2.6, 13.8 + U, S.claw, sphere(0.6, -0.3));
}

// ---------------------------------------------------------------------------
// Bodies

/**
 * The torso's outline from the top of the chest to the waist, and its
 * covering: plumage, fur or scales, or the club's shirt with its hoops or
 * stripes.
 */
function torso(c: PixelCanvas, cx: number, top: number, waist: number, half: (u: number) => number, back: boolean): void {
  const kit = S.kit;
  c.part();
  for (let y = top; y <= waist; y++) {
    const u = (y + 0.5 - top) / (waist - top + 1);
    const hw = half(u);
    const l = cx - hw;
    const r = cx + hw;
    for (let x = Math.round(l); x <= Math.round(r) - 1; x++) {
      const t = ((x + 0.5 - l) / (r - l)) * 2 - 1;
      let m: Material = S.hide;
      if (kit) {
        m = kit.shirt;
        if (kit.pattern === 'hoops' && Math.floor((waist - y) / 2) % 2 === 1) m = kit.stripe;
        if (kit.pattern === 'stripes' && Math.floor((x - cx + 10) / 2) % 2 === 1) m = kit.stripe;
      }
      c.px(x, y, m, sphere(t * 0.9, (u - 0.35) * 1.1, 1));
    }
  }
  if (kit) {
    // The collar: a V at the front, a band at the back.
    c.part();
    if (back) {
      for (let x = cx - 2; x < cx + 2; x++) c.px(x, top, kit.collar, cyl((x + 0.5 - cx) / 2, 0.3));
    } else {
      c.px(cx - 2, top, kit.collar, sphere(-0.5, -0.3));
      c.px(cx + 1, top, kit.collar, sphere(0.5, -0.3));
      c.px(cx - 1, top + 1, kit.collar, sphere(-0.3, 0));
      c.px(cx, top + 1, kit.collar, sphere(0.3, 0));
      // The badge on the heart's side: its field, and its mark in the middle.
      c.part();
      const bx = cx + 2;
      const by = top + 2;
      c.px(bx, by, kit.badge[0], sphere(0, -0.3));
      c.px(bx + 1, by, kit.badge[0], sphere(0.3, -0.3));
      c.px(bx, by + 1, kit.badge[0], sphere(0, 0.3));
      c.px(bx + 1, by + 1, kit.badge[1], sphere(0.3, 0.3), { bias: 1 });
      c.spark(bx + 1, by + 1, S.light[1], 0.25);
    }
    return;
  }
  // Texture: feathers in scallops, fur in tufts, scales in rows.
  for (let y = top + 1; y <= waist; y++) {
    for (let x = cx - 5; x <= cx + 4; x++) {
      if (eagle() && (y & 1) === 0 && ((x + (y >> 1)) & 1) === 0) c.shade(x, y, -1);
      if (dragon() && ((x + y * 2) % 4 === 0)) c.shade(x, y, -1);
    }
  }
}

/** The eagle's body: plumage, a leather strap across it with a gold clasp, the sky-blue kilt. */
function eagleBody(c: PixelCanvas, cx: number, U: number, L: number, back: boolean): void {
  const top = 15 + U;
  const waist = 22 + U;
  torso(c, cx, top, waist, (u) => 4.9 - 1.1 * u * u, back);
  if (!S.kit) {
    c.part();
    c.line(back ? cx + 3 : cx - 4, top + 1, back ? cx - 3 : cx + 3, waist - 1, LEATHER, () => sphere(0, -0.3));
    if (!back) {
      c.part();
      c.px(cx - 1, top + 3, GOLD, sphere(-0.3, -0.3));
      c.px(cx, top + 3, GOLD, sphere(0.3, -0.3), { bias: 1 });
      c.px(cx - 1, top + 4, GOLD, sphere(-0.3, 0.3), { bias: -1 });
      c.px(cx, top + 4, GOLD, sphere(0.3, 0.3));
    }
  }
  hips(c, cx, U, L, back, 4.4);
}

/** The lion's body: fur with a cream chest, a bronze pauldron and its strap; the crimson war-kilt. */
function lionBody(c: PixelCanvas, cx: number, U: number, L: number, back: boolean): void {
  const top = 15 + U;
  const waist = 22 + U;
  torso(c, cx, top, waist, (u) => 5.4 - 1.2 * u * u, back);
  if (!S.kit) {
    if (!back) {
      c.part();
      c.ellipse(cx, 19.4 + U, 2.6, 2.8, S.belly, { normal: (_x, _y, dx, dy) => sphere(dx * 0.7, dy * 0.6, 1) });
      // The breast's divide and the belly's lines.
      c.shade(cx - 1, 18 + U, -1);
      c.shade(cx, 18 + U, -1);
      c.shade(cx - 1, 20 + U, -1);
      c.shade(cx, 20 + U, -1);
    }
    c.part();
    c.line(back ? cx + 4 : cx - 4, top + 1, back ? cx - 3 : cx + 3, waist - 1, LEATHER, () => sphere(0, -0.3));
    c.part();
    const px = back ? cx + 4.2 : cx - 4.2;
    c.ellipse(px, 15.8 + U, 2.5, 1.9, S.trim, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.4, 1) });
    c.shade(px - 0.5, 16.4 + U, -1);
    c.shade(px + 0.5, 16.4 + U, -1);
  }
  hips(c, cx, U, L, back, 4.7);
}

/** The dragon's body: scales over pale belly plates, glowing faintly as the fire rises. */
function dragonBody(c: PixelCanvas, cx: number, U: number, L: number, back: boolean, glow: number): void {
  const top = 15 + U;
  const waist = 22 + U;
  torso(c, cx, top, waist, (u) => 5.1 - 0.9 * u * u, back);
  if (!S.kit && !back) {
    c.part();
    c.shape(top + 1, waist, (y) => {
      const u = (y - top) / (waist - top);
      const hw = 2.4 - u * 0.5;
      return [cx - hw, cx + hw];
    }, S.belly, (_x, _y, t) => cyl(t * 0.8, 0.2));
    for (let y = top + 2; y <= waist; y += 2) for (let x = cx - 2; x < cx + 2; x++) c.shade(x, y, -1);
    if (glow > 0.3) for (let y = top + 1; y <= top + 4; y++) c.spark(cx - 0.5, y, S.light[2], (glow - 0.3) * 0.5);
  }
  if (back && !S.kit) {
    // A ridge of spines down the back.
    c.part();
    for (let y = top; y <= waist; y += 2) c.px(cx - (y & 2 ? 1 : 0), y, S.claw, sphere(0, -0.5));
  }
  hips(c, cx, U, L, back, 4.5);
}

/**
 * The belt and what hangs from it: the eagle's kilt, the lion's studded
 * war-kilt, the dragon's loincloth on an iron belt, or the club's shorts.
 */
function hips(c: PixelCanvas, cx: number, U: number, L: number, back: boolean, hw: number): void {
  const waist = 22 + U;
  const kit = S.kit;
  if (kit) {
    const hem = Math.round(26 + L);
    c.part();
    c.shape(waist + 1, hem, (y) => {
      const w = hw + (y - waist) * 0.12;
      return [cx - w, cx + w];
    }, kit.shorts, (_x, y, t) => sphere(t * 0.9, (y - waist) / 5 - 0.2, 1));
    // The legs' split and the hem's stripe.
    for (let y = hem - 1; y <= hem; y++) {
      c.erase(cx - 1, y);
      c.erase(cx, y);
    }
    for (let x = Math.round(cx - hw); x < cx + hw; x++) if (x !== cx - 1 && x !== cx) c.shade(x, hem, -1);
    if (kit.shorts !== kit.stripe) for (const x of [Math.round(cx - hw), Math.round(cx + hw) - 1]) for (let y = waist + 1; y < hem; y++) c.px(x, y, kit.stripe, cyl(x < cx ? -0.8 : 0.8, 0));
    return;
  }
  const hem = eagle() ? 26.5 + L : lion() ? 26 + L : 25 + L;
  c.part();
  c.shape(waist + 1, Math.round(hem), (y) => {
    const w = hw + (y - waist) * (eagle() ? 0.28 : 0.18);
    return [cx - w, cx + w];
  }, S.cloth, (_x, y, t) => sphere(t * 0.9, (y - waist) / 5 - 0.2, 1));
  // Pleats.
  for (let y = waist + 2; y <= hem; y++) for (let x = cx - 4; x <= cx + 3; x += 2) c.shade(x, y, -1);
  // The hem: gold for the eagle, bronze studs for the lion.
  c.part();
  const hy = Math.round(hem);
  const w = hw + (hy - waist) * (eagle() ? 0.28 : 0.18);
  for (let x = Math.round(cx - w); x < cx + w; x++) {
    if (eagle()) c.px(x, hy, S.trim, cyl((x + 0.5 - cx) / w, 0));
    else if (lion() && x % 2 === 0) c.px(x, hy, S.trim, sphere(0, 0.3));
  }
  // The belt and its buckle.
  c.part();
  c.shape(waist, waist, () => [cx - hw - 0.3, cx + hw + 0.3], dragon() ? S.trim : lion() ? S.trim : LEATHER, (_x, _y, t) => cyl(t, 0));
  if (!back) {
    c.part();
    const buckle = dragon() ? GOLD : S.trim === GOLD ? GOLD : BRONZE;
    c.px(cx - 1, waist, buckle, sphere(-0.3, 0), { bias: 1 });
    c.px(cx, waist, buckle, sphere(0.3, 0), { bias: 1 });
    if (lion()) c.px(cx - 1, waist + 1, buckle, sphere(0, 0.5));
    if (dragon()) {
      // The loincloth's front flap, hanging low.
      c.part();
      c.shape(waist + 1, Math.round(27.5 + L), () => [cx - 1.6, cx + 1.6], S.cloth, (_x, y, t) => sphere(t * 0.7, (y - waist) / 6, 1), { bias: 1 });
      c.part();
      for (const x of [cx - 2, cx + 1]) c.px(x, Math.round(27.5 + L), GOLD, sphere(0, 0.3));
    }
  }
}

// ---------------------------------------------------------------------------
// Views

const REACH_FRONT = 4.5;
const REACH_SIDE = 5.2;

function legsFront(c: PixelCanvas, L: number, fa: number, fb: number, back: boolean): void {
  const [l, r] = back ? [fb, fa] : [fa, fb];
  const spread = lion() ? 0.3 : 0;
  leg(c, 10.1 - spread, 24 + L, 9.9 - spread, 29.4 - l);
  leg(c, 13.9 + spread, 24 + L, 14.1 + spread, 29.4 - r);
  foot(c, 9.9 - spread, 30.3 - l, false);
  foot(c, 14.1 + spread, 30.3 - r, false);
}

function body(c: PixelCanvas, cx: number, U: number, L: number, back: boolean, p: Pose): void {
  if (eagle()) eagleBody(c, cx, U, L, back);
  else if (lion()) lionBody(c, cx, U, L, back);
  else dragonBody(c, cx, U, L, back, p.glow);
}

function drawDown(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('down', 'a', p.a, U, cx);
  const fb = place('down', 'b', p.b, U, cx);
  const armA = () => arm(c, 7.1, 16.4 + U, fa, REACH_FRONT, [-0.6, 1], p.claws, fa.behind ? -1 : 0);
  const armB = () => arm(c, 16.9, 16.4 + U, fb, REACH_FRONT, [0.6, 1], p.claws, fb.behind ? -1 : 0);

  wings(c, 'down', cx, U, p, 'behind');
  // The tail swings out past a leg.
  if (!eagle()) tail(c, cx + 2, 24 + L, 1, p.tail, 'down', -2);
  if (fa.behind) armA();
  if (fb.behind) armB();
  legsFront(c, L, p.footA, p.footB, false);
  body(c, cx, U, L, false, p);
  if (eagle()) eagleDown(c, cx, U, p);
  else if (lion()) lionDown(c, cx, U, p);
  else dragonDown(c, cx, U, p);
  if (!fb.behind) armB();
  if (!fa.behind) armA();
  held(c, p, fa, fb);
}

function drawUp(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('up', 'a', p.a, U, cx);
  const fb = place('up', 'b', p.b, U, cx);
  const armA = () => arm(c, 16.9, 16.4 + U, fa, REACH_FRONT, [0.6, 0.8], p.claws, fa.behind ? -1 : 0);
  const armB = () => arm(c, 7.1, 16.4 + U, fb, REACH_FRONT, [-0.6, 0.8], p.claws, fb.behind ? -1 : 0);

  if (fa.behind) armA();
  if (fb.behind) armB();
  legsFront(c, L, p.footA, p.footB, true);
  body(c, cx, U, L, true, p);
  if (eagle()) eagleUp(c, cx, U);
  else if (lion()) lionUp(c, cx, U, p);
  else dragonUp(c, cx, U);
  tail(c, cx - 1, 23.4 + L, -1, -p.tail, 'up', 0);
  wings(c, 'up', cx, U, p, 'front');
  if (!fb.behind) armB();
  if (!fa.behind) armA();
  held(c, p, fa, fb, 0.7);
}

/** Facing left. Right-facing frames are mirrored from these. */
function drawSide(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const hx = cx - p.lean;
  const fa = place('side', 'a', p.a, U, hx);
  const fb = place('side', 'b', p.b, U, hx);
  const top = 15 + U;
  const waist = 22 + U;
  const kit = S.kit;

  wings(c, 'side', cx, U, p, 'behind', hx);
  const armA = (bias: number) => arm(c, hx + 1.2, 16.4 + U, fa, REACH_SIDE, [0.3, 1], p.claws, bias);
  if (fa.behind) armA(-1);
  tail(c, cx + 2.6, eagle() ? 23 + L : 23.6 + L, 1, p.tail, 'side', -1);

  // Legs: the back one in shade first.
  const lift = (f: number) => Math.max(0, f) * 0.35;
  leg(c, cx + 0.8, 24 + L, cx + 1 - p.footB, 29.4 - lift(p.footB), -1);
  foot(c, cx + 0.6 - p.footB, 30.3 - lift(p.footB), true, -1);
  leg(c, cx - 0.6, 24 + L, cx - 0.4 - p.footA, 29.4 - lift(p.footA));
  foot(c, cx - 0.6 - p.footA, 30.3 - lift(p.footA), true);

  // The body in profile.
  const hw = lion() ? 4.0 : 3.7;
  c.part();
  for (let y = top; y <= waist; y++) {
    const u = (y + 0.5 - top) / (waist - top + 1);
    const w = hw - 0.6 * u * u;
    const l = hx - w - 0.3;
    const r = hx + w;
    for (let x = Math.round(l); x <= Math.round(r) - 1; x++) {
      const t = ((x + 0.5 - l) / (r - l)) * 2 - 1;
      let m: Material = S.hide;
      if (kit) {
        m = kit.shirt;
        if (kit.pattern === 'hoops' && Math.floor((waist - y) / 2) % 2 === 1) m = kit.stripe;
        if (kit.pattern === 'stripes' && Math.floor((x - hx + 10) / 2) % 2 === 1) m = kit.stripe;
      }
      c.px(x, y, m, sphere(t * 0.9 - 0.1, (u - 0.35) * 1.1, 1));
    }
  }
  if (kit) {
    c.part();
    c.px(hx - 3, top, kit.collar, sphere(-0.5, -0.4), { bias: 1 });
    c.px(hx - 2, top, kit.collar, sphere(-0.2, -0.4));
    c.px(hx - 3, top + 2, kit.badge[0], sphere(-0.5, 0));
    c.px(hx - 3, top + 3, kit.badge[1], sphere(-0.5, 0), { bias: 1 });
  } else if (lion()) {
    c.part();
    c.shape(top + 2, waist - 1, () => [hx - hw - 0.3, hx - hw + 1.6], S.belly, (_x, _y, t) => cyl(t - 0.4, 0.2));
    c.part();
    c.line(hx - 2, top + 1, hx + 2, waist - 1, LEATHER, () => sphere(0, -0.3));
  } else if (dragon()) {
    c.part();
    c.shape(top + 1, waist, () => [hx - hw - 0.3, hx - hw + 1.4], S.belly, (_x, _y, t) => cyl(t - 0.4, 0.2));
    for (let y = top + 2; y <= waist; y += 2) c.shade(Math.round(hx - hw), y, -1);
    if (p.glow > 0.3) c.spark(hx - hw + 0.4, top + 2, S.light[2], (p.glow - 0.3) * 0.5);
    c.part();
    for (let y = top; y <= waist; y += 2) c.px(hx + hw - 0.2, y, S.claw, sphere(0.6, -0.4));
  } else {
    c.part();
    c.line(hx - 3, top + 1, hx + 2, waist - 1, LEATHER, () => sphere(0, -0.3));
    for (let y = top + 1; y <= waist; y += 2) for (let x = hx - 3; x <= hx + 3; x += 2) c.shade(x + ((y >> 1) & 1), y, -1);
  }
  // The hips in profile: shorts or kilt, belt.
  c.part();
  const hem = kit ? 26 + L : eagle() ? 26.5 + L : lion() ? 26 + L : 25 + L;
  c.shape(Math.round(waist + 1), Math.round(hem), (y) => {
    const k = Math.max(0, Math.min(1, (y - waist) / 3));
    const x = hx + (cx - hx) * k;
    return [x - 3.6 - (y - waist) * 0.12, x + 3.4];
  }, kit ? kit.shorts : S.cloth, (_x, _y, t) => cyl(t, 0.1));
  if (kit && kit.shorts !== kit.stripe) for (let y = Math.round(waist + 1); y <= Math.round(hem); y++) c.shade(Math.round(cx - 3.6 + (hx - cx) * (1 - Math.min(1, (y - waist) / 3))), y, 1);
  if (!kit) {
    c.part();
    c.shape(Math.round(waist), Math.round(waist), () => [hx - 3.9, hx + 3.7], eagle() ? LEATHER : S.trim, (_x, _y, t) => cyl(t, 0));
    c.part();
    if (eagle()) for (let x = Math.round(cx - 3.8); x < cx + 3.4; x++) c.px(x, Math.round(hem), S.trim, cyl(0, 0));
    if (lion()) for (let x = Math.round(cx - 3.8); x < cx + 3.4; x += 2) c.px(x, Math.round(hem), S.trim, sphere(0, 0.3));
    if (dragon()) {
      c.shape(Math.round(waist + 1), Math.round(27.5 + L), () => [hx - 4.2, hx - 2.4], S.cloth, (_x, _y, t) => cyl(t, 0.2), { bias: 1 });
      c.px(hx - 4, Math.round(27.5 + L), GOLD, sphere(0, 0.3));
    }
  }
  if (lion() && !kit) {
    // The pauldron on the near shoulder.
    c.part();
    c.ellipse(hx + 0.2, 15.6 + U, 2.4, 1.8, S.trim, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.4, 1) });
  }

  if (eagle()) eagleSide(c, hx, U, p);
  else if (lion()) lionSide(c, hx, U, p);
  else dragonSide(c, hx, U, p);

  wings(c, 'side', cx, U, p, 'front', hx);
  if (!fa.behind) armA(0);
  // The near arm last.
  arm(c, hx + 0.2, 16.7 + U, fb, REACH_SIDE, [0.4, 1], p.claws, 0);
  held(c, p, fa, fb);
}

/** A feather of light held ready in a hand. */
function held(c: PixelCanvas, p: Pose, fa: Placed, fb: Placed, k = 1): void {
  if (!p.feather) return;
  const h = p.feather === 'a' ? fa : fb;
  const [core, hot, mid] = S.light;
  const g = (0.5 + p.glow * 0.5) * k;
  // The quill in the hand, the vane rising from it.
  for (let i = 0; i < 4; i++) c.spark(h.x + i * 0.5, h.y - 1 - i, i === 3 ? core : hot, g * (i === 3 ? 1 : 0.8));
  c.spark(h.x + 1.5, h.y - 2, mid, g * 0.6);
  c.spark(h.x - 0.5, h.y - 3, mid, g * 0.5);
  if (p.glow > 0.6) glowAt(c, h.x + 1.5, h.y - 4, (p.glow - 0.6) * 2 * k);
}

// ---------------------------------------------------------------------------
// Animations

/** Hands easy at the sides: the lion's paws a touch out and ready. */
const rest = (): Hand => (lion() ? H(1.2, 4.7, -2.7) : dragon() ? H(1, 4.5, -2.9) : H(0.7, 4.2, -3.1));

/** Side-view hands: a little further forward, both at the body's line. */
const side = (h: Hand, arm: 'a' | 'b'): Hand => H(h.f + (arm === 'b' ? 0.6 : 0.4), 0, h.h);

const base = (view: View): Pose => {
  const r = rest();
  return {
    lift: 0,
    breath: 0,
    footA: view === 'side' ? 1 : 0,
    footB: view === 'side' ? -1 : 0,
    lean: 0,
    a: view === 'side' ? side(r, 'a') : { ...r },
    b: view === 'side' ? side(r, 'b') : { ...r },
    wing: 0.06,
    raise: 0,
    mouth: 0,
    claws: false,
    glow: 0,
    feather: null,
    tail: 0,
    tick: 0,
  };
};

function idle(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = (f / N) * Math.PI * 2;
    const p = base(view);
    p.breath = Math.sin(ph) > 0.5 ? 1 : 0;
    p.tick = f;
    p.blink = f === 4;
    // The wings settle and ruffle; the tail flicks; the dragon's nostrils smoulder.
    p.wing = 0.06 + 0.05 * Math.max(0, Math.sin(ph));
    p.raise = 0.2 * Math.sin(ph);
    p.tail = Math.sin(ph) * 0.8;
    p.glow = dragon() ? 0.15 + 0.12 * Math.sin(ph * 2) : 0;
    frames.push(p);
  }
  return frames;
}

function walk(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = ((f + 0.5) / N) * Math.PI * 2;
    const s = Math.sin(ph);
    const p = base(view);
    p.lift = Math.abs(s) < 0.6 ? 1 : 0;
    p.tick = f;
    if (view === 'side') {
      p.footA = Math.round(s * 2.2);
      p.footB = -p.footA;
      p.lean = 1;
    } else {
      p.footA = s > 0.3 ? 1 : 0;
      p.footB = s < -0.3 ? 1 : 0;
    }
    p.a.f -= s * 1.3;
    p.b.f += s * 1.3;
    p.wing = 0.08 + 0.06 * p.lift;
    p.raise = p.lift * 0.4;
    p.tail = Math.sin(ph + 1) * 1;
    p.glow = dragon() ? 0.12 : 0;
    frames.push(p);
  }
  return frames;
}

interface Key {
  a?: Hand;
  b?: Hand;
  aSide?: Hand;
  bSide?: Hand;
  wing?: number;
  raise?: number;
  mouth?: number;
  claws?: boolean;
  glow?: number;
  feather?: 'a' | 'b';
  lean?: number;
  breath?: number;
  lift?: number;
  step?: number;
  tail?: number;
}

/** An action as keyframes; anything left out stays at rest. */
function action(keys: Key[]) {
  return (view: View): Pose[] =>
    keys.map((k, i) => {
      const p = base(view);
      if (k.a) p.a = view === 'side' ? { ...(k.aSide ?? side(k.a, 'a')) } : { ...k.a };
      if (k.b) p.b = view === 'side' ? { ...(k.bSide ?? side(k.b, 'b')) } : { ...k.b };
      p.wing = k.wing ?? 0.08;
      p.raise = k.raise ?? 0;
      p.mouth = k.mouth ?? 0;
      p.claws = !!k.claws;
      p.glow = k.glow ?? (dragon() ? 0.15 : 0);
      p.feather = k.feather ?? null;
      p.breath = k.breath ?? 0;
      p.lift = k.lift ?? 0;
      p.tail = k.tail ?? 0;
      p.tick = i;
      const step = k.step ?? 0;
      if (view === 'side') {
        p.lean = k.lean ?? 0;
        p.footA = 1 + step;
        p.footB = -1 - Math.round(step * 0.5);
      } else p.footA = step > 0 ? 1 : 0;
      return p;
    });
}

// The eagle: feathers flung from either hand, and a great beat of both wings.
const fling = action([
  { b: H(-0.6, 4.6, 3.2), feather: 'b', glow: 0.6, wing: 0.22, lean: -1, raise: 0.4 },
  { b: H(4.1, 2.4, 1.4), glow: 1, wing: 0.36, raise: -0.3, lean: 1, step: 1, mouth: 0.5 },
  { b: H(3.4, 0.8, 0.2), wing: 0.2, lean: 1, step: 1 },
  { b: H(1.6, 3.8, -1.4), wing: 0.1 },
]);

const fling2 = action([
  { a: H(-0.6, 4.6, 3.2), aSide: H(-1.2, 0, 3.4), feather: 'a', glow: 0.6, wing: 0.22, lean: -1, raise: 0.4 },
  { a: H(4.1, 2.4, 1.4), aSide: H(4.4, 0, 1.2), glow: 1, wing: 0.36, raise: -0.3, lean: 1, step: 1, mouth: 0.5 },
  { a: H(3.4, 0.8, 0.2), aSide: H(3.8, 0, 0.2), wing: 0.2, lean: 1, step: 1 },
  { a: H(1.6, 3.8, -1.4), wing: 0.1 },
]);

const gust = action([
  { a: H(0.4, 5, 1), b: H(0.4, 5, 1), wing: 0.8, raise: 1, breath: 1, lean: -1 },
  { a: H(0.2, 5.4, 2.4), b: H(0.2, 5.4, 2.4), wing: 1, raise: 1.3, lift: 1, lean: -1, mouth: 0.6 },
  { a: H(2.4, 4.6, 0.4), b: H(2.4, 4.6, 0.4), wing: 1, raise: -0.9, lean: 1, step: 1, mouth: 1, glow: 1 },
  { a: H(2, 4.4, -0.6), b: H(2, 4.4, -0.6), wing: 0.7, raise: -1, lean: 1, step: 1 },
  { wing: 0.3, raise: -0.2 },
]);

// The lion: a raking swipe from each paw, and a pounce that brings both down.
const claw = action([
  { b: H(0.2, 5.4, 3.4), a: H(1.8, 3.4, 0), claws: true, lean: -1, tail: -1 },
  { b: H(4.3, 2, 1), a: H(1.4, 3.8, -0.8), claws: true, lean: 1, step: 1, mouth: 0.4, tail: 0.5 },
  { b: H(3.6, -1.2, -0.6), claws: true, lean: 1, tail: 1 },
  { b: H(1.6, 3.8, -1.6), tail: 0.5 },
]);

const claw2 = action([
  { a: H(0.2, 5.4, 3.4), aSide: H(-0.8, 0, 3.6), b: H(1.8, 3.4, 0), claws: true, lean: -1, tail: 1 },
  { a: H(4.3, 2, 1), aSide: H(4.6, 0, 1), b: H(1.4, 3.8, -0.8), claws: true, lean: 1, step: 1, mouth: 0.4, tail: -0.5 },
  { a: H(3.6, -1.2, -0.6), aSide: H(4, 0, -0.6), claws: true, lean: 1, tail: -1 },
  { a: H(1.6, 3.8, -1.6), tail: -0.5 },
]);

const maul = action([
  { a: H(0.4, 3.8, 3.6), b: H(0.4, 3.8, 3.6), claws: true, breath: 1, lean: -1, tail: -1 },
  { a: H(1.2, 3.2, 6), b: H(1.2, 3.2, 6), claws: true, lift: 2, lean: -1, mouth: 0.7, tail: -0.5 },
  { a: H(4.6, 2.3, 0.6), b: H(4.6, 2.3, 0.6), claws: true, lean: 1, step: 1, breath: 1, mouth: 1, tail: 1 },
  { a: H(4.6, 2.5, 0.2), b: H(4.6, 2.5, 0.2), claws: true, lean: 1, step: 1, breath: 1, mouth: 0.5, tail: 0.6 },
  { a: H(2, 4, -1.4), b: H(2, 4, -1.4) },
]);

/** The roar: chest thrown out, arms flung wide, the jaws at their widest. */
const roar = action([
  { a: H(0.4, 5.2, -1), b: H(0.4, 5.2, -1), breath: 1, mouth: 0.3, lean: -1 },
  { a: H(0.6, 5.8, 0.4), b: H(0.6, 5.8, 0.4), mouth: 0.8, claws: true, lean: -1, glow: 0.6 },
  { a: H(1, 6.2, 1.2), b: H(1, 6.2, 1.2), mouth: 1, lift: 1, claws: true, glow: 1, tail: 1 },
  { a: H(1, 6.2, 1.4), b: H(1, 6.2, 1.4), mouth: 1, lift: 1, claws: true, glow: 1, tail: -1 },
  { a: H(0.8, 6, 1), b: H(0.8, 6, 1), mouth: 1, claws: true, glow: 0.7 },
  { a: H(0.6, 5.2, -1), b: H(0.6, 5.2, -1), mouth: 0.4 },
]);

// The dragon: a bolt of fire spat from the jaws, and a long breath of flame.
const spit = action([
  { a: H(1, 4.8, -1.4), b: H(1, 4.8, -1.4), lean: -1, glow: 0.7, mouth: 0.3, wing: 0.2, raise: 0.5, tail: -1 },
  { a: H(1.4, 4.6, -1), b: H(1.4, 4.6, -1), lean: 1, step: 1, glow: 1, mouth: 1, wing: 0.36, raise: -0.3, tail: 0.6 },
  { lean: 1, glow: 0.5, mouth: 0.5, wing: 0.2, tail: 1 },
  { glow: 0.25, tail: 0.5 },
]);

const breath = action([
  { a: H(0.4, 5.2, -0.8), b: H(0.4, 5.2, -0.8), lean: 1, step: 1, mouth: 1, glow: 1, wing: 0.55, raise: 0.6, tail: 0.6 },
  { a: H(0.4, 5.4, -0.6), b: H(0.4, 5.4, -0.6), lean: 1, step: 1, mouth: 1, glow: 0.85, wing: 0.6, raise: 0.8, tail: 1 },
  { a: H(0.4, 5.2, -0.8), b: H(0.4, 5.2, -0.8), lean: 1, step: 1, mouth: 1, glow: 1, wing: 0.55, raise: 0.6, tail: 0.6 },
  { a: H(0.4, 5, -1), b: H(0.4, 5, -1), lean: 1, step: 1, mouth: 1, glow: 0.9, wing: 0.5, raise: 0.4, tail: 0.2 },
]);

/** The Special's pose: arms raised high, wings spread to their full span, the beast crying out. */
const rally = action([
  { a: H(1, 4.6, 0), b: H(1, 4.6, 0), breath: 1, wing: 0.3, glow: 0.4, tail: -1 },
  { a: H(1, 4.8, 3), b: H(1, 4.8, 3), wing: 0.7, raise: 0.6, glow: 0.7, mouth: 0.4, claws: true },
  { a: H(0.8, 4.4, 6.2), b: H(0.8, 4.4, 6.2), wing: 1, raise: 1, lift: 1, glow: 1, mouth: 1, claws: true, tail: 1 },
  { a: H(0.8, 4.2, 6.6), b: H(0.8, 4.2, 6.6), wing: 1, raise: 1.2, lift: 1, glow: 1, mouth: 1, claws: true, tail: 0.5 },
  { a: H(0.8, 4.4, 6.2), b: H(0.8, 4.4, 6.2), wing: 1, raise: 1, lift: 1, glow: 1, mouth: 1, claws: true, tail: -0.5 },
  { a: H(0.8, 4.4, 6), b: H(0.8, 4.4, 6), wing: 1, raise: 0.9, glow: 0.9, mouth: 0.8, claws: true },
]);

// ---------------------------------------------------------------------------
// Frame generation

export type BeastAnim = 'idle' | 'walk' | 'fling' | 'fling2' | 'gust' | 'claw' | 'claw2' | 'maul' | 'roar' | 'spit' | 'breath' | 'rally';

interface BeastAnimDef {
  name: BeastAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => Pose[];
  /** Only drawn for this kind; for all when left out. */
  kind?: BeastKind;
}

const BEAST_ANIMS: BeastAnimDef[] = [
  { name: 'idle', fps: 6, loop: true, poses: idle },
  { name: 'walk', fps: 10, loop: true, poses: walk },
  { name: 'fling', fps: 14, loop: false, poses: fling, kind: 'eagle' },
  { name: 'fling2', fps: 14, loop: false, poses: fling2, kind: 'eagle' },
  { name: 'gust', fps: 12, loop: false, poses: gust, kind: 'eagle' },
  { name: 'claw', fps: 14, loop: false, poses: claw, kind: 'lion' },
  { name: 'claw2', fps: 14, loop: false, poses: claw2, kind: 'lion' },
  { name: 'maul', fps: 13, loop: false, poses: maul, kind: 'lion' },
  { name: 'roar', fps: 11, loop: false, poses: roar, kind: 'lion' },
  { name: 'spit', fps: 11, loop: false, poses: spit, kind: 'dragon' },
  { name: 'breath', fps: 12, loop: true, poses: breath, kind: 'dragon' },
  { name: 'rally', fps: 10, loop: false, poses: rally },
];

/** The anims a look has. */
export const beastAnims = (look: BeastLook): BeastAnimDef[] => BEAST_ANIMS.filter((a) => a.kind === undefined || a.kind === look.kind);

/** Each action's length and the frame it lands on, so the game's timing matches its animation. */
export const BEAST_TIMING: Record<'fling' | 'gust' | 'claw' | 'maul' | 'roar' | 'spit', { ms: number; land: number }> = {
  fling: { ms: (4 / 14) * 1000, land: (1 / 14) * 1000 },
  gust: { ms: (5 / 12) * 1000, land: (2 / 12) * 1000 },
  claw: { ms: (4 / 14) * 1000, land: (1 / 14) * 1000 },
  maul: { ms: (5 / 13) * 1000, land: (2 / 13) * 1000 },
  roar: { ms: (6 / 11) * 1000, land: (2 / 11) * 1000 },
  spit: { ms: (4 / 11) * 1000, land: (1 / 11) * 1000 },
};

export interface BeastFrame {
  key: string;
  anim: BeastAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawBeastFrame(dir: Dir, pose: Pose): PixelCanvas {
  const c = new PixelCanvas(BEAST_W, BEAST_H).offset(BODY_X, BODY_Y);
  if (dir === 'down') drawDown(c, pose);
  else if (dir === 'up') drawUp(c, pose);
  else drawSide(c, pose);
  return dir === 'right' ? c.mirrored() : c;
}

export function buildBeastFrames(look: BeastLook = EAGLE_LOOK): BeastFrame[] {
  S = look;
  const out: BeastFrame[] = [];
  for (const a of beastAnims(look)) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, index) => {
        out.push({ key: `${a.name}_${dir}_${index}`, anim: a.name, dir, canvas: drawBeastFrame(dir, pose) });
      });
    }
  }
  S = EAGLE_LOOK;
  return out;
}

// ---------------------------------------------------------------------------
// Projectiles: the eagle's feathers and the dragon's firebolts

export const FEATHER_DIRS = 16;
export const FEATHER_SIZE = 13;

/**
 * A razor feather in flight along heading `i`: a quill, a vane edged in
 * light, the tip brightest. Benfica's are red with white edges.
 */
export function featherFrame(i: number, look: BeastLook = EAGLE_LOOK): PixelCanvas {
  const c = new PixelCanvas(FEATHER_SIZE, FEATHER_SIZE);
  const a = (i / FEATHER_DIRS) * Math.PI * 2;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const m = FEATHER_SIZE / 2;
  const at = (t: number, s = 0): [number, number] => [m + ux * t - uy * s, m + uy * t + ux * s];
  const vane: Material = look.kit ? { ...BENFICA_RED, emissive: 0.25 } : { ...EAGLE_WHITE, emissive: 0.2 };
  const edge: Material = look.kit ? { ...KIT_WHITE, emissive: 0.5, noAO: true } : { ramp: ramp('#4a8ac0', '#8ad0f4', '#e0f8ff'), outline: hex('#0c2440'), emissive: 0.5, noAO: true };
  c.part();
  // The vane: widest a little behind the middle, tapering to the tip.
  for (let t = -4; t <= 4; t += 0.5) {
    const w = t < -3 ? 0.4 : 1.6 * Math.sin(((t + 4) / 8.4) * Math.PI);
    for (let s = -w; s <= w; s += 0.5) {
      const [x, y] = at(t, s);
      c.px(x, y, Math.abs(s) > w - 0.6 ? edge : vane, sphere(-uy * s * 0.4, ux * s * 0.4 - 0.2));
    }
  }
  c.part();
  // The quill down its middle.
  const [x0, y0] = at(-5);
  const [x1, y1] = at(3.5);
  c.line(x0, y0, x1, y1, look.kit ? KIT_WHITE : SCALY_YELLOW, () => sphere(0, -0.4));
  const [tx, ty] = at(4.4);
  c.spark(tx, ty, look.light[0], 0.9);
  c.spark(tx - ux, ty - uy, look.light[1], 0.6);
  return c;
}

export const FIREBOLT_SIZE = 14;
export const FIREBOLT_FRAMES = 4;

/** A firebolt: a white-hot heart in a ball of flame that licks back from it, flickering frame to frame. */
export function fireboltFrame(f: number, look: BeastLook = DRAGON_LOOK): PixelCanvas {
  const c = new PixelCanvas(FIREBOLT_SIZE, FIREBOLT_SIZE);
  const [core, hot, mid, deep] = look.light;
  const cx = FIREBOLT_SIZE / 2;
  const cy = FIREBOLT_SIZE / 2;
  for (let y = 0; y < FIREBOLT_SIZE; y++) {
    for (let x = 0; x < FIREBOLT_SIZE; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const ang = Math.atan2(dy, dx);
      // Tongues of flame round the rim, turning with the frame.
      const r = 3.6 + 1.3 * Math.sin(ang * 5 + f * 1.7) + 0.6 * Math.sin(ang * 3 - f * 2.3);
      const d = Math.hypot(dx, dy);
      if (d > r) continue;
      const u = d / r;
      c.spark(x, y, u < 0.3 ? core : u < 0.55 ? hot : u < 0.8 ? mid : deep, u < 0.8 ? 1 : 0.7);
    }
  }
  return c;
}

// ---------------------------------------------------------------------------
// Button icons

const tones = (look: BeastLook): Tones => look.light;

/** Razor feathers: three feathers fanned out on a diagonal, their edges lit. */
export function featherIcon(look: BeastLook = EAGLE_LOOK): Uint8ClampedArray {
  const t = tones(look);
  const vane: RGB = look.kit ? hex('#de2230') : hex('#e8ecf6');
  const dark: RGB = look.kit ? hex('#700a12') : hex('#8a90a8');
  return icon16((put) => {
    for (const [ox, oy, len] of [[-3, 2, 9], [0, 0, 11], [3, -2, 9]] as const) {
      const x0 = 3 + ox;
      const y0 = 13 + oy;
      for (let i = 0; i <= len; i++) {
        const x = x0 + i * 0.75;
        const y = y0 - i * 0.75;
        const w = i < 2 ? 0 : i > len - 2 ? 0 : 1;
        if (w) {
          put(x - 1, y, dark);
          put(x, y - 1, vane);
        }
        put(x, y, i > len - 3 ? t[0] : t[1]);
      }
      put(x0 + len * 0.75 + 1, y0 - len * 0.75 - 1, t[0]);
    }
    put(14, 1, t[2]);
    put(13, 3, t[2]);
  });
}

/** Gale: a pair of spread wings beating down, wind curling out beneath them. */
export function gustIcon(look: BeastLook = EAGLE_LOOK): Uint8ClampedArray {
  const t = tones(look);
  const wing: RGB = look.kit ? hex('#dab058') : hex('#7a5229');
  const dark: RGB = look.kit ? hex('#7e541c') : hex('#3a2212');
  return icon16((put) => {
    for (const k of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const x0 = 8 + k * 1;
        const y0 = 5;
        const a = (20 + i * 17) * RAD;
        const len = 6.5 - i * 0.4;
        seg(put, x0 + k * i * 0.9, y0 - i * 0.3, x0 + k * (i * 0.9 + Math.sin(a) * len), y0 - i * 0.3 + Math.cos(a) * len * 0.6 - 1, i % 2 ? dark : wing);
      }
    }
    put(7, 4, look.kit ? hex('#de2230') : hex('#f4f6fc'));
    put(8, 4, look.kit ? hex('#de2230') : hex('#f4f6fc'));
    // Wind swirling out underneath.
    for (let i = 0; i < 9; i++) {
      const a = i * 0.7;
      put(8 + Math.cos(a) * (2 + i * 0.5), 12 + Math.sin(a) * 1.4, i > 5 ? t[2] : t[1]);
    }
    seg(put, 1, 14, 5, 14, t[2]);
    seg(put, 11, 14, 15, 14, t[2]);
    put(8, 12, t[0]);
  });
}

/** Claws: three raking slashes, bright at their heads. */
export function clawIcon(look: BeastLook = LION_LOOK): Uint8ClampedArray {
  const t = tones(look);
  return icon16((put) => {
    for (let k = 0; k < 3; k++) {
      const ox = k * 3.4;
      for (let i = 0; i <= 10; i++) {
        const f = i / 10;
        const x = 2 + ox + f * 7 + Math.sin(f * Math.PI) * 1.2;
        const y = 2 + f * 11 + k * 0.5;
        put(x, y, f < 0.25 ? t[3] : f < 0.6 ? t[2] : f < 0.85 ? t[1] : t[0]);
        if (f > 0.3 && f < 0.8) put(x + 1, y, t[3]);
      }
    }
  });
}

/** The roar: a lion's head in its mane, jaws wide, rings of sound rolling out. */
export function roarIcon(look: BeastLook = LION_LOOK): Uint8ClampedArray {
  const t = tones(look);
  const mane: RGB = look.kit ? hex('#ae6a26') : hex('#6a3614');
  const fur: RGB = look.kit ? hex('#eeba3a') : hex('#d69a3a');
  const cream: RGB = hex('#f6e6c4');
  return icon16((put) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const d = Math.hypot(x + 0.5 - 5.5, y + 0.5 - 8.5);
        if (d <= 4.6 + (Math.atan2(y - 8, x - 5) * 3 > 0 ? 0.3 : 0)) put(x, y, d <= 2.8 ? fur : mane);
      }
    }
    put(4, 7, hex('#1c0b05'));
    put(6, 7, hex('#1c0b05'));
    put(5, 9, hex('#342020'));
    put(4, 10, cream);
    put(6, 10, cream);
    put(5, 10, hex('#6e1820'));
    put(5, 11, hex('#6e1820'));
    // Sound rolling out to the right.
    for (let r = 0; r < 3; r++) {
      for (let a = -0.9; a <= 0.9; a += 0.15) {
        put(6 + Math.cos(a) * (5 + r * 2.6), 9 + Math.sin(a) * (5 + r * 2.6), r === 0 ? t[1] : r === 1 ? t[2] : t[3]);
      }
    }
  });
}

/** Dragonfire: a firebolt streaking up and right, trailing flame. */
export function fireIcon(look: BeastLook = DRAGON_LOOK): Uint8ClampedArray {
  const t = tones(look);
  return icon16((put) => {
    for (let i = 0; i < 9; i++) {
      const x = 2 + i * 0.9;
      const y = 13 - i * 0.9;
      const w = i * 0.28;
      for (let s = -w; s <= w; s += 0.5) put(x + s * 0.7, y + s * 0.7, i < 3 ? t[3] : i < 6 ? t[2] : t[1]);
    }
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const d = Math.hypot(x + 0.5 - 11, y + 0.5 - 5);
        if (d <= 3.6) put(x, y, d <= 1.4 ? t[0] : d <= 2.5 ? t[1] : t[2]);
      }
    }
    put(14, 2, t[1]);
    put(8, 3, t[2]);
    put(13, 9, t[2]);
  });
}

/** Flame breath: a dragon's head in profile, a cone of fire roaring from its jaws. */
export function breathIcon(look: BeastLook = DRAGON_LOOK): Uint8ClampedArray {
  const t = tones(look);
  const scale: RGB = look.kit ? hex('#2a58c8') : hex('#c0302a');
  const dark: RGB = look.kit ? hex('#0a1c58') : hex('#560c10');
  const horn: RGB = look.kit ? hex('#ffd860') : hex('#c8baa0');
  return icon16((put) => {
    // The fire first, so the head sits over its root.
    for (let x = 6; x < 16; x++) {
      const f = (x - 6) / 9;
      const w = 0.8 + f * 4.4;
      for (let y = Math.ceil(9 - w); y <= Math.floor(9 + w); y++) {
        const u = Math.abs(y - 9) / w;
        put(x, y, u < 0.3 && f < 0.7 ? t[0] : u < 0.6 ? t[1] : u < 0.85 ? t[2] : t[3]);
      }
    }
    for (let y = 4; y <= 11; y++) for (let x = 0; x <= 6; x++) if ((x - 2.5) ** 2 / 9 + (y - 7.5) ** 2 / 10 <= 1) put(x, y, y > 9 ? dark : scale);
    seg(put, 3, 8, 7, 8, scale);
    seg(put, 3, 10, 6, 10, dark);
    put(3, 6, t[1]);
    seg(put, 1, 4, 0, 1, horn);
    seg(put, 3, 4, 3, 1, horn);
  });
}
