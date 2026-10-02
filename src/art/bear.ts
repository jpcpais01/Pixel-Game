// The Bear, the Beastkin's tank, drawn procedurally on the Beastkin's frame
// (the same frame size and origin as art/beast.ts, so Beast.ts carries it).
//
// The grizzly: a huge, broad beastfolk warrior in brown fur, darker on the
// arms and legs and grizzled pale at the shoulders' hump and the crown, a
// lighter muzzle and chest, small round ears, small amber eyes and a big
// black nose. Heavy ivory claws on every paw. A leather harness crosses his
// chest, a little carved wooden totem (a bear's face) hanging where the
// straps meet; a rough pauldron of bark plates sits on his right shoulder
// with moss growing over it; a belt with a bone buckle and a ragged kilt of
// forest-green wool.
//
// The Panda (his legendary look): black and white as a giant panda is, the
// black running over the shoulders and down the arms and legs, black ears and
// drooping patches round jade-glinting eyes, a warm white everywhere else. A
// bamboo-leaf talisman on a red cord in place of the totem, a woven bamboo
// pauldron with a sprig of leaves, and a little red sash knotted at his hip.
// At rest he munches a bamboo shoot, where the grizzly sniffs the air and
// scratches his belly.
//
// The body is the Beastkin's 24x32 box, filled nearly edge to edge: he is
// the biggest of them. Hands are posed in the rig's own terms (forward, out
// to the side, height) and placed per view, like the other Beastkin.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB } from './pixel';
import { DIRS, type Dir } from './wizard';
import { icon16, seg, type Tones } from './druid';
import { BEAST_H, BEAST_W } from './beast';

export const BEAR_W = BEAST_W;
export const BEAR_H = BEAST_H;
const BODY_X = 16;
const BODY_Y = 16;
/** Height above the feet of the paws as they strike, and of the mouth (roars leave it). */
export const BEAR_HAND_Y = 14;
export const BEAR_MOUTH_Y = 20;

const ramp = (...c: string[]): RGB[] => c.map(hex);
const INK = hex('#120e1f');

// ---------------------------------------------------------------------------
// Materials

// The grizzly.
const GRIZZLY_FUR: Material = { ramp: ramp('#1e1108', '#3a2210', '#5c3a1c', '#83562c', '#a87a46'), outline: hex('#0c0603'), outlineLit: hex('#1c0f06') };
const GRIZZLY_DARK: Material = { ramp: ramp('#140b06', '#28170b', '#3e2513', '#59381d', '#74502a'), outline: hex('#080402'), outlineLit: hex('#140a04') };
const GRIZZLY_CREAM: Material = { ramp: ramp('#5a3e22', '#8c683e', '#b8925e', '#d8b880', '#eed8a8'), outline: hex('#24160a'), outlineLit: hex('#34200e') };
const BEAR_NOSE: Material = { ramp: ramp('#0c0808', '#201616', '#3a2a2a', '#5a4646'), outline: INK, shine: true };
const AMBER_EYE: Material = { ramp: ramp('#2a1004', '#8a4a10', '#f0b040'), outline: INK, emissive: 0.55, noAO: true };
const IVORY_CLAW: Material = { ramp: ramp('#4a4234', '#8a8068', '#c8bc9c', '#f0e8d0'), outline: hex('#1c180e'), emissive: 0.3, shine: true };
const HARNESS: Material = { ramp: ramp('#1c0e06', '#38200e', '#5a3618', '#7c5026'), outline: hex('#0c0603') };
const TOTEM_WOOD: Material = { ramp: ramp('#3a220e', '#6a4420', '#9a6a36', '#c49456', '#e2bc7c'), outline: hex('#1a0e04') };
const BARK: Material = { ramp: ramp('#1a1610', '#322a20', '#4e4232', '#6c5c46', '#8a7a60'), outline: hex('#0a0806'), outlineLit: hex('#16120c') };
const MOSS: Material = { ramp: ramp('#0e2208', '#1e4210', '#36681c', '#56922c', '#7ab846'), outline: hex('#081404') };
const BONE: Material = { ramp: ramp('#5a5444', '#9a927a', '#d0c8ac', '#f2ecd6'), outline: hex('#201c12'), shine: true };
const FOREST_WOOL: Material = { ramp: ramp('#0c1a10', '#16301c', '#24482c', '#36603e', '#4c7a52'), outline: hex('#060c08'), outlineLit: hex('#0c160e') };
const MOUTH: Material = { ramp: ramp('#1c0406', '#3a0a10', '#5e1820'), outline: hex('#0c0204'), noAO: true };
const TONGUE: Material = { ramp: ramp('#6a1a2a', '#b83a50', '#e86a7a'), outline: hex('#2a0810') };
const FANG: Material = { ramp: ramp('#8a867a', '#cfcabc', '#fbf8ee'), outline: hex('#2a2820') };

// The panda.
const PANDA_WHITE: Material = { ramp: ramp('#5e6068', '#9ea0a8', '#cfd0d4', '#ecebe6', '#fbfaf4'), outline: hex('#1a1a22'), outlineLit: hex('#2a2a32') };
const PANDA_BLACK: Material = { ramp: ramp('#060608', '#101014', '#1c1c22', '#2c2c36', '#40404c'), outline: hex('#000000'), outlineLit: hex('#040406') };
const PANDA_MUZZLE: Material = { ramp: ramp('#6a645a', '#aaa496', '#d8d2c2', '#f2ecdc', '#fffaf0'), outline: hex('#22201a'), outlineLit: hex('#2e2a22') };
const JADE_EYE: Material = { ramp: ramp('#0a3a24', '#2a9a64', '#9cf0c0'), outline: INK, emissive: 0.55, noAO: true };
const PANDA_CLAW: Material = { ...IVORY_CLAW, ramp: ramp('#3e3c38', '#7a766c', '#b8b2a2', '#e4e0d4') };
const RED_SASH: Material = { ramp: ramp('#3a0408', '#6e0a10', '#a8161c', '#d8302c', '#f46a5a'), outline: hex('#180204'), outlineLit: hex('#28040a') };
const BAMBOO_LEAF: Material = { ramp: ramp('#0e2a10', '#1e5020', '#3a8030', '#62ae44', '#94d466'), outline: hex('#061206') };
const WOVEN_BAMBOO: Material = { ramp: ramp('#3a3612', '#6a6424', '#9e9638', '#c8c056', '#e6e08a'), outline: hex('#1a1806'), outlineLit: hex('#26240a') };
const JADE: Material = { ramp: ramp('#0a3a2a', '#1a7a56', '#3ab884', '#8ae8bc', '#d4fff0'), outline: hex('#04160e'), shine: true };
const BAMBOO_STALK: Material = { ramp: ramp('#1a3a10', '#2e6020', '#4e8a34', '#76b44e', '#a6d870'), outline: hex('#0a1a06') };

// ---------------------------------------------------------------------------
// Looks

export interface BearLook {
  key: string;
  /** The panda's markings, talisman, sash and bamboo. */
  panda: boolean;
  /** Body and upper arms. */
  fur: Material;
  head: Material;
  /** Forearms, paws, legs and ears (the panda's black). */
  limb: Material;
  /** Muzzle and chest. */
  cream: Material;
  nose: Material;
  eyes: Material;
  claw: Material;
  /** The harness's straps (the panda's cord). */
  harness: Material;
  /** The carved totem, or the bamboo leaves of the panda's talisman. */
  totem: Material;
  /** The pauldron's plates: bark, or woven bamboo. */
  pad: Material;
  /** What grows over it: moss, or a sprig of bamboo leaves. */
  moss: Material;
  /** Buckle and beads: bone, or jade. */
  trim: Material;
  /** The kilt, or the panda's sash. */
  cloth: Material;
  /** Light of its power (wrath, quakes), brightest first. */
  light: [RGB, RGB, RGB, RGB];
}

export const GRIZZLY_LOOK: BearLook = {
  key: 'bear',
  panda: false,
  fur: GRIZZLY_FUR,
  head: GRIZZLY_FUR,
  limb: GRIZZLY_DARK,
  cream: GRIZZLY_CREAM,
  nose: BEAR_NOSE,
  eyes: AMBER_EYE,
  claw: IVORY_CLAW,
  harness: HARNESS,
  totem: TOTEM_WOOD,
  pad: BARK,
  moss: MOSS,
  trim: BONE,
  cloth: FOREST_WOOL,
  light: [hex('#fff2dc'), hex('#ffc070'), hex('#f07a2a'), hex('#8e2a12')],
};

export const PANDA_LOOK: BearLook = {
  key: 'bear_panda',
  panda: true,
  fur: PANDA_WHITE,
  head: PANDA_WHITE,
  limb: PANDA_BLACK,
  cream: PANDA_MUZZLE,
  nose: BEAR_NOSE,
  eyes: JADE_EYE,
  claw: PANDA_CLAW,
  harness: RED_SASH,
  totem: BAMBOO_LEAF,
  pad: WOVEN_BAMBOO,
  moss: BAMBOO_LEAF,
  trim: JADE,
  cloth: RED_SASH,
  light: [hex('#f0fff6'), hex('#b0ffd8'), hex('#3ad89a'), hex('#0e7a58')],
};

export const BEAR_LOOKS = [GRIZZLY_LOOK, PANDA_LOOK];

/** The look being drawn; set by buildBearFrames. */
let S: BearLook = GRIZZLY_LOOK;

// ---------------------------------------------------------------------------
// The rig

/** A hand in the rig's terms: `f` forward, `s` out to its own side, `h` up from the chest. */
interface Hand {
  f: number;
  s: number;
  h: number;
}

const H = (f: number, s: number, h: number): Hand => ({ f, s, h });

interface Pose {
  /** Whole body raised (reared up on the hind legs). */
  lift: number;
  /** Upper body lowered (a crouch). */
  breath: number;
  /** Side view: forward (+) / back (-). Front/back: lift. */
  footA: number;
  footB: number;
  /** Upper body shifted forward (side view), in pixels. */
  lean: number;
  a: Hand;
  b: Hand;
  /** 0..1 the jaws open; past 1 a yawn-wide roar. */
  mouth: number;
  /** The claws flashing as they strike. */
  claws: boolean;
  /** 0..1 power in the eyes. */
  glow: number;
  tick: number;
  blink?: boolean;
  /** The upper body rolling side to side as he lumbers (front and back views), in pixels. */
  sway?: number;
  // The idle moment's extras (front view only).
  /** The head shifted aside (turned) and down (nodded), in pixels. */
  turn?: number;
  nod?: number;
  /** Nose twitching up as he sniffs. */
  sniff?: boolean;
  /** An ear flicked down. */
  ear?: boolean;
  /** The panda's bamboo shoot in his paws: how much is left, 0..1. */
  bamboo?: number;
}

type View = 'down' | 'up' | 'side';

/** The chest row in body coordinates, the height hands are posed from. */
const CH = 16;

interface Placed {
  x: number;
  y: number;
  /** Drawn behind the body. */
  behind: boolean;
}

/** Where a hand lands on screen in each view. `hx` is the upper body's centre. */
function place(view: View, arm: 'a' | 'b', q: Hand, U: number, hx: number): Placed {
  const side = arm === 'a' ? -1 : 1;
  if (view === 'down') return { x: hx + side * q.s, y: CH + U - q.h + q.f * 0.7, behind: q.f < -1 };
  if (view === 'up') return { x: hx - side * q.s, y: CH + U - q.h - q.f * 0.8, behind: q.f > 1 };
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

/** A cheap fixed scatter for fur texture: the same pixels every frame, so it doesn't shimmer. */
const speck = (x: number, y: number, n: number): boolean => {
  let h = (Math.floor(x) * 374761393 + Math.floor(y) * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) % n === 0;
};

// ---------------------------------------------------------------------------
// Arms and legs

/**
 * An arm: the upper arm in the body's fur, the forearm in the darker fur of
 * the limbs (the panda's all black), a leather wrap at the grizzly's wrist,
 * then the great paw and its claws.
 */
function arm(c: PixelCanvas, sx: number, sy: number, p: Placed, reach: number, hint: [number, number], claws: boolean, bias = 0): void {
  const [ex, ey] = elbow(sx, sy, p.x, p.y, reach, hint);
  const wx = ex + (p.x - ex) * 0.62;
  const wy = ey + (p.y - ey) * 0.62;
  c.part();
  c.capsule(sx, sy, ex, ey, 2.5, 2.2, S.panda ? S.limb : S.fur, { bias });
  c.part();
  c.capsule(ex, ey, wx, wy, 2.2, 2.0, S.limb, { bias });
  if (!S.panda) {
    c.part();
    c.ellipse(wx, wy, 2.0, 1.15, S.harness, { bias: bias + 1 });
  }
  paw(c, p.x, p.y, ex, ey, claws, bias);
}

/** A paw: broad and round, three heavy ivory claws along the way the forearm points, gleaming as they strike. */
function paw(c: PixelCanvas, x: number, y: number, ex: number, ey: number, claws: boolean, bias = 0): void {
  const r = 2.2;
  c.part();
  c.ellipse(x, y, r, r * 0.95, S.limb, { bias });
  const dx = x - ex;
  const dy = y - ey;
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l;
  const uy = dy / l;
  c.part();
  for (const s of [-1.3, 0, 1.3]) {
    const bx = x + ux * (r + 0.2) - uy * s;
    const by = y + uy * (r + 0.2) + ux * s;
    c.px(bx, by, S.claw, sphere(ux * 0.5, -uy * 0.5 - 0.2), { bias: bias + 1 });
    if (s === 0 || claws) c.px(bx + ux, by + uy, S.claw, sphere(ux * 0.6, -uy * 0.6), { bias: bias + 1 });
  }
  if (claws) {
    const [core, hot] = S.light;
    c.spark(x + ux * (r + 1.6), y + uy * (r + 1.6), core, 0.5);
    c.spark(x + ux * (r + 1.2) - uy * 1.3, y + uy * (r + 1.2) + ux * 1.3, hot, 0.35);
    c.spark(x + ux * (r + 1.2) + uy * 1.3, y + uy * (r + 1.2) - ux * 1.3, hot, 0.35);
  }
}

/** A hind foot: a broad paw, clawed at the toes. */
function foot(c: PixelCanvas, x: number, y: number, side: boolean, bias = 0): void {
  c.part();
  c.ellipse(x - (side ? 0.8 : 0), y + 0.2, side ? 3.1 : 2.7, 1.55, S.limb, { flatten: 0.8, bias });
  c.part();
  if (side) {
    c.px(x - 4, y + 0.6, S.claw, sphere(-0.5, 0.3), { bias });
    c.px(x - 3.4, y + 1.4, S.claw, sphere(-0.4, 0.5), { bias: bias - 1 });
  } else for (const dx of [-1.5, 0, 1.5]) c.px(x + dx - 0.5, y + 1.5, S.claw, sphere(dx * 0.3, 0.5), { bias });
}

/** A leg from the hip to the ankle, short and thick. */
function leg(c: PixelCanvas, hx: number, hy: number, ax: number, ay: number, bias = 0): void {
  c.part();
  c.capsule(hx, hy, ax, ay, 3.0, 2.5, S.limb, { bias });
}

// ---------------------------------------------------------------------------
// Heads

/** The panda's eye patches: drooping outward from each eye. Offsets from the head's centre, eye row 0. */
const PATCH_L: [number, number][] = [[-3, -1], [-4, 0], [-3, 0], [-2, 0], [-5, 1], [-4, 1], [-3, 1], [-4, 2]];
const PATCH_R: [number, number][] = PATCH_L.map(([x, y]) => [-1 - x, y]);

/** The front of the head: round ears, full cheeks, small eyes, the pale muzzle and big black nose; roaring, the jaws gape. */
function headDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const ey = 8 + U;
  // The ears, small and round, set wide on the crown.
  c.part();
  c.ellipse(cx - 4.2, 4.5 + U + (p.ear ? 0.7 : 0), 1.8, 1.7, S.limb);
  c.ellipse(cx + 4.2, 4.5 + U, 1.8, 1.7, S.limb);
  c.shade(cx - 5, 5 + U + (p.ear ? 1 : 0), -2);
  c.shade(cx + 4, 5 + U, -2);
  // Full cheeks under the skull, then the skull.
  c.part();
  c.ellipse(cx, 10.6 + U, 5.8, 2.8, S.head, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.6 + 0.2, 1) });
  c.part();
  c.ellipse(cx, 8.2 + U, 5.1, 4.4, S.head);
  if (!S.panda) {
    // Grizzled: pale tips through the crown's fur.
    for (let y = 5; y <= 7; y++) for (let x = cx - 4; x <= cx + 3; x++) if (speck(x, y, 5)) c.shade(x, y + U, 1);
  }
  for (const [x, y] of [[cx - 5, 11], [cx + 4, 11], [cx - 4, 12], [cx + 3, 12]] as const) c.shade(x, y + U, -1);
  if (S.panda) {
    c.part();
    for (const [dx, dy] of PATCH_L) c.px(cx + dx, ey + dy, S.limb, sphere(dx / 5, -dy / 3));
    for (const [dx, dy] of PATCH_R) c.px(cx + dx, ey + dy, S.limb, sphere(dx / 5, -dy / 3));
  }
  // Small eyes under a heavy brow.
  c.part();
  for (const x of [cx - 3, cx + 2]) {
    if (p.blink) c.px(x, ey, S.panda ? S.limb : S.head, sphere(0, -0.3), { bias: -1 });
    else c.px(x, ey, S.eyes);
  }
  if (!S.panda) for (const x of [cx - 4, cx - 3, cx + 2, cx + 3]) c.shade(x, ey - 1, -1);
  if (p.glow > 0.3) for (const x of [cx - 3, cx + 2]) c.spark(x, ey, S.light[1], p.glow * 0.6);
  // The muzzle and nose.
  const open = p.mouth;
  c.part();
  c.ellipse(cx, 10.9 + U + open * 0.3, 2.6, 1.8 + open * 0.3, S.cream, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.7 - 0.1, 1) });
  c.part();
  const ny = 9.6 + U - (p.sniff ? 1 : 0);
  for (const x of [cx - 2, cx - 1, cx, cx + 1]) c.px(x, ny, S.nose, sphere((x + 0.5 - cx) / 2.2, 0.4));
  c.px(cx - 1, ny + 1, S.nose, sphere(-0.3, -0.2));
  c.px(cx, ny + 1, S.nose, sphere(0.3, -0.2));
  if (p.sniff) {
    c.px(cx - 1, ny + 2, S.nose, sphere(0, -0.4), { bias: -1 });
    c.px(cx, ny + 2, S.nose, sphere(0, -0.4), { bias: -1 });
  }
  if (open > 0.3) {
    // A yawn-wide roar (past 1) gapes down to the tongue.
    const rows = open > 1.2 ? 3 : open > 0.7 ? 2 : 1;
    const xs = rows > 1 ? [cx - 2, cx - 1, cx, cx + 1] : [cx - 1, cx];
    c.part();
    for (let r = 0; r < rows; r++) for (const x of xs) c.px(x, 12 + U + r, MOUTH, sphere(0, 0));
    if (rows > 1) {
      c.px(cx - 1, 11 + U + rows, TONGUE, sphere(-0.3, -0.4), { bias: 1 });
      c.px(cx, 11 + U + rows, TONGUE, sphere(0.3, -0.4), { bias: 1 });
    }
    c.part();
    c.px(cx - 2, 12 + U, FANG, sphere(-0.4, 0.3));
    c.px(cx + 1, 12 + U, FANG, sphere(0.4, 0.3));
    if (rows > 1) {
      c.px(cx - 2, 11 + U + rows, FANG, sphere(-0.4, -0.3), { bias: -1 });
      c.px(cx + 1, 11 + U + rows, FANG, sphere(0.4, -0.3), { bias: -1 });
      c.px(cx - 3, 12 + U, S.cream, sphere(-0.7, 0));
      c.px(cx + 2, 12 + U, S.cream, sphere(0.7, 0));
    }
    // The chin.
    for (const x of [cx - 2, cx - 1, cx, cx + 1]) c.px(x, 12 + U + rows, S.cream, sphere((x + 0.5 - cx) / 2.5, 0.6), { bias: -1 });
  } else {
    c.shade(cx - 1, 11.6 + U, -1);
    c.shade(cx, 11.6 + U, -1);
    for (const x of [cx - 2, cx + 1]) c.shade(x, 12.2 + U, -2);
  }
}

/** The back of the head: ears, the round skull, the heavy nape. */
function headUp(c: PixelCanvas, cx: number, U: number): void {
  c.part();
  c.ellipse(cx - 3.9, 4.7 + U, 1.7, 1.6, S.limb);
  c.ellipse(cx + 3.9, 4.7 + U, 1.7, 1.6, S.limb);
  c.part();
  c.ellipse(cx, 10.4 + U, 5.4, 2.8, S.head, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.6 + 0.2, 1) });
  c.part();
  c.ellipse(cx, 8.3 + U, 4.8, 4.2, S.head);
  // Fur lying down the nape in tufts.
  for (let y = 7; y <= 12; y++) for (let x = cx - 4; x <= cx + 3; x++) {
    if (speck(x, y, 6)) c.shade(x, y + U, -1);
    else if (!S.panda && y < 9 && speck(x + 2, y, 5)) c.shade(x, y + U, 1);
  }
  // From behind, the cheeks' fur sticks out past the ears.
  c.px(cx - 6, 10 + U, S.head, sphere(-0.8, 0), { bias: -1 });
  c.px(cx + 5, 10 + U, S.head, sphere(0.8, 0), { bias: -1 });
}

/** The head in profile, facing left: the round skull, the long pale snout and the nose at its tip; the jaw drops as he roars. */
function headSide(c: PixelCanvas, hx: number, U: number, p: Pose): void {
  const open = p.mouth;
  c.part();
  c.ellipse(hx + 1.3, 5.1 + U, 1.6, 1.6, S.limb);
  c.shade(hx + 1, 5 + U, -2);
  c.part();
  c.ellipse(hx - 0.2, 10.4 + U, 4.0, 2.6, S.head, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.6 + 0.2, 1) });
  c.part();
  c.ellipse(hx - 0.6, 8.2 + U, 3.9, 3.9, S.head);
  if (!S.panda) for (let y = 5; y <= 7; y++) for (let x = hx - 2; x <= hx + 3; x++) if (speck(x, y, 4)) c.shade(x, y + U, 1);
  // The snout jutting forward, the lower jaw hinged under it.
  c.part();
  c.capsule(hx - 3, 10 + U, hx - 6.2, 10.4 + U, 1.9, 1.5, S.cream, { bias: 1 });
  c.part();
  c.capsule(hx - 2.6, 11.8 + U + open * 0.6, hx - 5.6, 12.1 + U + open * 1.9, 1.15, 0.9, S.cream, { bias: -1 });
  if (open > 0.3) {
    c.part();
    const drop = open > 0.7 ? 2 : 1;
    for (let r = 0; r < drop; r++) for (let x = Math.round(hx - 6); x <= hx - 3; x++) c.px(x, 11.4 + U + r, MOUTH, sphere(0, 0));
    c.part();
    c.px(hx - 6, 11.4 + U, FANG, sphere(-0.4, 0.2));
    c.px(hx - 4, 11.4 + U + drop, FANG, sphere(-0.3, -0.3), { bias: -1 });
  } else c.shade(hx - 5, 11.6 + U, -1);
  // The nose at the tip.
  c.part();
  c.px(hx - 8, 9.6 + U - (p.sniff ? 1 : 0), S.nose, sphere(-0.6, 0.5));
  c.px(hx - 8, 10.6 + U, S.nose, sphere(-0.6, -0.2));
  c.px(hx - 7, 9.6 + U - (p.sniff ? 1 : 0), S.nose, sphere(-0.2, 0.6), { bias: 1 });
  if (S.panda) {
    c.part();
    for (const [dx, dy] of [[-3, -1], [-2, -1], [-4, 0], [-3, 0], [-2, 0], [-3, 1], [-4, 1]] as const) c.px(hx + dx, 8 + U + dy, S.limb, sphere(dx / 5, -dy / 3));
  }
  c.part();
  if (p.blink) c.px(hx - 3, 8 + U, S.panda ? S.limb : S.head, sphere(0, -0.3), { bias: -1 });
  else c.px(hx - 3, 8 + U, S.eyes);
  if (!S.panda) {
    c.shade(hx - 3, 7 + U, -1);
    c.shade(hx - 4, 7 + U, -1);
  }
  if (p.glow > 0.3) c.spark(hx - 3, 8 + U, S.light[1], p.glow * 0.6);
}

// ---------------------------------------------------------------------------
// Bodies

/** The torso's half-width down its height: round shoulders, a great barrel of a belly, narrower hips. */
const torsoHalf = (u: number): number => (7.0 + 0.9 * Math.sin(u * Math.PI) - 0.7 * u) * Math.min(1, 0.74 + u * 3.4);

/**
 * The torso from the front or back: fur in tufts, grizzled pale at the
 * shoulders (the grizzly) or the black band over them (the panda).
 */
function torso(c: PixelCanvas, cx: number, top: number, waist: number): void {
  c.part();
  for (let y = top; y <= waist; y++) {
    const u = (y + 0.5 - top) / (waist - top + 1);
    const hw = torsoHalf(u);
    const l = cx - hw;
    const r = cx + hw;
    for (let x = Math.round(l); x <= Math.round(r) - 1; x++) {
      const t = ((x + 0.5 - l) / (r - l)) * 2 - 1;
      // The panda's black runs over the shoulders, deepest where the arms join.
      const band = S.panda && y - top < 2.6 + 1.6 * Math.abs(t);
      c.px(x, y, band ? S.limb : S.fur, sphere(t * 0.9, (u - 0.35) * 1.1, 1));
    }
  }
  for (let y = top + 1; y <= waist; y++) {
    for (let x = cx - 7; x <= cx + 6; x++) {
      if (speck(x, y, 9)) c.shade(x, y, -1);
      else if (!S.panda && y < top + 4 && speck(x + 3, y, 4)) c.shade(x, y, 1);
    }
  }
}

/** The grizzly's harness from the front: two straps crossing the chest, the carved totem where they meet. */
function harnessFront(c: PixelCanvas, cx: number, top: number, waist: number): void {
  c.part();
  c.line(cx - 6, top + 1, cx + 4, waist - 1, S.harness, () => sphere(0, -0.3));
  c.part();
  c.line(cx + 5, top + 1, cx - 5, waist - 1, S.harness, () => sphere(0, -0.3));
  // The totem: a little bear's face carved in pale wood, a bone bead over it.
  const ty = top + 4;
  c.part();
  c.px(cx - 1, ty - 1, S.trim, sphere(0, -0.4), { bias: 1 });
  c.part();
  c.px(cx - 2, ty, S.totem, sphere(-0.6, -0.6), { bias: 1 });
  c.px(cx, ty, S.totem, sphere(0.6, -0.6), { bias: 1 });
  for (let y = ty + 1; y <= ty + 2; y++) for (const x of [cx - 2, cx - 1, cx]) c.px(x, y, S.totem, sphere((x + 0.5 - (cx - 0.5)) / 1.6, (y - ty - 1.5) / 2));
  c.px(cx - 1, ty + 3, S.totem, sphere(0, 0.6));
  c.shade(cx - 2, ty + 1, -2);
  c.shade(cx, ty + 1, -2);
  c.shade(cx - 1, ty + 2, -1);
}

/** The panda's bamboo-leaf talisman: a red cord, a jade bead, three leaves fanned below it. */
function talisman(c: PixelCanvas, cx: number, top: number): void {
  c.part();
  c.line(cx - 4, top, cx - 2, top + 3, S.cloth, () => sphere(0, -0.3));
  c.line(cx + 3, top, cx + 1, top + 3, S.cloth, () => sphere(0, -0.3));
  c.part();
  c.px(cx - 1, top + 3, S.trim, sphere(-0.4, -0.4), { bias: 1 });
  c.px(cx, top + 3, S.trim, sphere(0.4, -0.4));
  c.part();
  const leaf = S.totem;
  for (const [x, y, b] of [[-2, 4, 1], [-3, 5, 0], [-3, 6, -1], [-1, 4, 1], [-1, 5, 1], [-1, 6, 0], [-1, 7, -1], [0, 4, 1], [1, 5, 0], [1, 6, -1]] as const) {
    c.px(cx + x, top + y, leaf, sphere((x + 0.5) / 3, (4 - y) / 4), { bias: b });
  }
}

/**
 * The hips: the grizzly's belt with its bone buckle and the ragged green
 * kilt; the panda's white rump and the red sash knotted at his hip, its ends
 * hanging. `back` turns the knot and the buckle away.
 */
function hips(c: PixelCanvas, cx: number, U: number, L: number, back: boolean): void {
  const waist = 23 + U;
  const hw = torsoHalf(1);
  const hem = Math.round(26.6 + L);
  if (S.panda) {
    c.part();
    c.shape(waist + 1, hem, (y) => {
      const w = hw - (y - waist) * 0.25;
      return [cx - w, cx + w];
    }, S.fur, (_x, y, t) => sphere(t * 0.9, (y - waist) / 4 - 0.1, 1));
    c.part();
    c.shape(waist - 1, waist, () => [cx - hw - 0.4, cx + hw + 0.4], S.cloth, (_x, _y, t) => cyl(t, 0));
    for (let x = Math.round(cx - hw); x < cx + hw; x += 3) c.shade(x, waist, -1);
    // The knot at his left hip, the ends hanging from it.
    const kx = back ? cx - 4 : cx + 3;
    c.part();
    c.px(kx, waist - 1, S.cloth, sphere(-0.3, -0.4), { bias: 1 });
    c.px(kx + 1, waist - 1, S.cloth, sphere(0.3, -0.4), { bias: 1 });
    c.px(kx, waist, S.cloth, sphere(-0.3, 0.3), { bias: 1 });
    c.px(kx + 1, waist, S.cloth, sphere(0.3, 0.3));
    c.part();
    for (const [x, y] of [[0, 1], [0, 2], [1, 1], [1, 2], [1, 3]] as const) c.px(kx + x, waist + y, S.cloth, sphere(x - 0.5, -0.2), { bias: y === 3 ? -1 : 0 });
    return;
  }
  c.part();
  c.shape(waist + 1, hem, (y) => {
    const w = hw + (y - waist) * 0.18;
    return [cx - w, cx + w];
  }, S.cloth, (_x, y, t) => sphere(t * 0.9, (y - waist) / 5 - 0.2, 1));
  // Folds, and a ragged hem.
  for (let y = waist + 2; y <= hem; y++) for (let x = cx - 6; x <= cx + 5; x += 3) c.shade(x, y, -1);
  const w = hw + (hem - waist) * 0.18;
  for (let x = Math.round(cx - w); x < cx + w; x++) if ((x * 5) % 3 === 0) c.erase(x, hem);
  c.part();
  c.shape(waist, waist, () => [cx - hw - 0.3, cx + hw + 0.3], S.harness, (_x, _y, t) => cyl(t, 0));
  if (!back) {
    c.part();
    c.px(cx - 1, waist, S.trim, sphere(-0.3, 0), { bias: 1 });
    c.px(cx, waist, S.trim, sphere(0.3, 0), { bias: 1 });
  }
}

/** The pauldron: rough plates of bark, moss creeping over their top (or woven bamboo under a sprig of leaves). */
function pauldron(c: PixelCanvas, x: number, y: number, rx: number, ry: number): void {
  c.part();
  c.ellipse(x, y, rx, ry, S.pad, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.4, 1) });
  if (S.panda) {
    // The weave: slats across, every other one in shade.
    for (let yy = Math.floor(y - ry) + 1; yy <= y + ry; yy += 2) for (let xx = Math.floor(x - rx); xx <= x + rx; xx++) c.shade(xx, yy, -1);
    for (let xx = Math.floor(x - rx) + 1; xx <= x + rx; xx += 3) c.shade(xx, y, 1);
  } else {
    // Bark: furrows down the plates, and the plates' lower rims.
    for (let xx = Math.floor(x - rx) + 1; xx <= x + rx; xx += 2) c.shade(xx, y - 0.2 + ((xx & 2) ? 1 : 0), -1);
    for (let xx = Math.floor(x - rx); xx <= x + rx; xx++) c.shade(xx, y + ry - 0.6, -1);
  }
  // What grows over it.
  c.part();
  const top = y - ry - 0.2;
  if (S.panda) {
    c.px(x - 1, top, S.moss, sphere(-0.4, 0.6), { bias: 1 });
    c.px(x - 2, top - 1, S.moss, sphere(-0.6, 0.6), { bias: 1 });
    c.px(x, top - 1, S.moss, sphere(0.2, 0.7), { bias: 1 });
    c.px(x + 1, top - 2, S.moss, sphere(0.5, 0.7));
  } else {
    for (const [dx, dy, b] of [[-2, 0.4, 0], [-1, 0, 1], [0, -0.3, 1], [1, 0, 0], [2, 0.6, -1], [-3, 1.4, 0], [0, 0.8, 0]] as const) c.px(x + dx, top + dy, S.moss, sphere(dx / 3, 0.6), { bias: b });
    // A trailing wisp of moss down its side.
    c.px(x + rx - 0.4, y + 0.4, S.moss, sphere(0.7, 0), { bias: -1 });
  }
}

// ---------------------------------------------------------------------------
// Views

const REACH_FRONT = 4.7;
const REACH_SIDE = 5.0;

function legsFront(c: PixelCanvas, L: number, fa: number, fb: number, back: boolean): void {
  const [l, r] = back ? [fb, fa] : [fa, fb];
  leg(c, 8.7, 24 + L, 8.5, 29.4 - l);
  leg(c, 15.3, 24 + L, 15.5, 29.4 - r);
  foot(c, 8.5, 30.3 - l, false);
  foot(c, 15.5, 30.3 - r, false);
}

function drawDown(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12 + (p.sway ?? 0);
  const top = 12 + U;
  const waist = 23 + U;
  const fa = place('down', 'a', p.a, U, cx);
  const fb = place('down', 'b', p.b, U, cx);
  const armA = () => arm(c, cx - 6.7, 14.2 + U, fa, REACH_FRONT, [-0.2, 1], p.claws, fa.behind ? -1 : 0);
  const armB = () => arm(c, cx + 6.7, 14.2 + U, fb, REACH_FRONT, [0.2, 1], p.claws, fb.behind ? -1 : 0);

  if (fa.behind) armA();
  if (fb.behind) armB();
  legsFront(c, L, p.footA, p.footB, false);
  torso(c, cx, top, waist);
  if (S.panda) talisman(c, cx, top);
  else {
    // The pale chest under the harness.
    c.part();
    c.ellipse(cx, 17.2 + U, 3.7, 3.4, S.cream, { normal: (_x, _y, dx, dy) => sphere(dx * 0.7, dy * 0.6, 1) });
    for (const [x, y] of [[cx - 3, 20], [cx + 2, 20], [cx - 4, 18], [cx + 3, 18]] as const) c.shade(x, y + U, -1);
    harnessFront(c, cx, top, waist);
  }
  hips(c, cx, U, L, false);
  const hx = cx + (p.turn ?? 0);
  headDown(c, hx, U + (p.nod ?? 0), p);
  if (!fb.behind) armB();
  if (!fa.behind) armA();
  pauldron(c, cx - 6.6, 13 + U, 3.2, 2.3);
  if (p.bamboo !== undefined) bamboo(c, fa, fb, p.bamboo);
}

function drawUp(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12 + (p.sway ?? 0);
  const top = 12 + U;
  const waist = 23 + U;
  const fa = place('up', 'a', p.a, U, cx);
  const fb = place('up', 'b', p.b, U, cx);
  const armA = () => arm(c, cx + 6.7, 14.2 + U, fa, REACH_FRONT, [0.2, 1], p.claws, fa.behind ? -1 : 0);
  const armB = () => arm(c, cx - 6.7, 14.2 + U, fb, REACH_FRONT, [-0.2, 1], p.claws, fb.behind ? -1 : 0);

  if (fa.behind) armA();
  if (fb.behind) armB();
  legsFront(c, L, p.footA, p.footB, true);
  torso(c, cx, top, waist);
  if (!S.panda) {
    // The harness's straps crossing the back.
    c.part();
    c.line(cx + 6, top + 1, cx - 4, waist - 1, S.harness, () => sphere(0, -0.3));
    c.part();
    c.line(cx - 5, top + 1, cx + 5, waist - 1, S.harness, () => sphere(0, -0.3));
    c.part();
    c.px(cx - 1, top + 5, S.harness, sphere(-0.3, 0), { bias: 1 });
    c.px(cx, top + 5, S.harness, sphere(0.3, 0), { bias: 1 });
  } else {
    c.part();
    c.line(cx - 3, top, cx + 2, top, S.cloth, () => sphere(0, -0.3));
  }
  hips(c, cx, U, L, true);
  // A stubby tail over the kilt.
  c.part();
  c.ellipse(cx - 0.5, 24.2 + L, 1.4, 1.2, S.fur);
  headUp(c, cx, U);
  if (!fb.behind) armB();
  if (!fa.behind) armA();
  pauldron(c, cx + 6.6, 13 + U, 3.2, 2.3);
}

/** Facing left. Right-facing frames are mirrored from these. */
function drawSide(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const hx = cx - p.lean;
  const fa = place('side', 'a', p.a, U, hx);
  const fb = place('side', 'b', p.b, U, hx);
  const top = 12 + U;
  const waist = 23 + U;

  const armA = (bias: number) => arm(c, hx + 1.4, 14.4 + U, fa, REACH_SIDE, [0.3, 1], p.claws, bias);
  if (fa.behind) armA(-1);
  // The stubby tail at the rump.
  c.part();
  c.ellipse(cx + 5.6, 23.4 + L, 1.3, 1.2, S.fur, { bias: -1 });

  // Legs: the back one in shade first.
  const lift = (f: number) => Math.max(0, f) * 0.35;
  leg(c, cx + 1.4, 24 + L, cx + 1.6 - p.footB, 29.4 - lift(p.footB), -1);
  foot(c, cx + 1.2 - p.footB, 30.3 - lift(p.footB), true, -1);
  leg(c, cx - 1, 24 + L, cx - 0.8 - p.footA, 29.4 - lift(p.footA));
  foot(c, cx - 1 - p.footA, 30.3 - lift(p.footA), true);

  // The hump over the shoulders, then the body in profile: a deep chest and belly.
  c.part();
  c.ellipse(hx + 2.6, 12.6 + U, 3.4, 2.6, S.panda ? S.limb : S.fur, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.9 - 0.3, 1) });
  if (!S.panda) for (let x = hx; x <= hx + 5; x++) if (speck(x, 11, 2)) c.shade(x, 11 + U, 1);
  c.part();
  for (let y = top; y <= waist; y++) {
    const u = (y + 0.5 - top) / (waist - top + 1);
    const w = 5.2 - 0.6 * u * u;
    const l = hx - w - 0.9 * Math.sin(u * Math.PI);
    const r = hx + w + 0.3;
    for (let x = Math.round(l); x <= Math.round(r) - 1; x++) {
      const t = ((x + 0.5 - l) / (r - l)) * 2 - 1;
      const band = S.panda && y - top < 3.2 - u * 2;
      c.px(x, y, band ? S.limb : S.fur, sphere(t * 0.9 - 0.1, (u - 0.35) * 1.1, 1));
    }
  }
  for (let y = top + 1; y <= waist; y++) for (let x = hx - 6; x <= hx + 5; x++) if (speck(x, y, 9)) c.shade(x, y, -1);
  if (!S.panda) {
    // The pale chest along the front, the strap across, the totem hanging at the chest.
    for (let y = top + 2; y <= waist - 3; y++) {
      const u = (y + 0.5 - top) / (waist - top + 1);
      const l = Math.round(hx - 5.2 - 0.9 * Math.sin(u * Math.PI));
      c.shade(l, y, 1);
      if (speck(l + 1, y, 2)) c.shade(l + 1, y, 1);
    }
    c.part();
    c.line(hx - 2, top + 1, hx + 3, waist - 1, S.harness, () => sphere(0, -0.3));
    c.part();
    c.px(hx - 6, top + 4, S.totem, sphere(-0.6, -0.3), { bias: 1 });
    c.px(hx - 6, top + 5, S.totem, sphere(-0.6, 0.3));
    c.shade(hx - 6, top + 4, -1);
  } else {
    c.part();
    c.px(hx - 6, top + 4, S.trim, sphere(-0.6, -0.3), { bias: 1 });
    c.px(hx - 6, top + 5, S.totem, sphere(-0.6, 0.3));
    c.px(hx - 7, top + 6, S.totem, sphere(-0.7, 0.3));
  }

  // The hips in profile: kilt and belt, or white rump and sash.
  c.part();
  const hem = 26.6 + L;
  c.shape(Math.round(waist + 1), Math.round(hem), (y) => {
    const k = Math.max(0, Math.min(1, (y - waist) / 3));
    const x = hx + (cx - hx) * k;
    return S.panda ? [x - 4.6 + (y - waist) * 0.3, x + 5.2 - (y - waist) * 0.3] : [x - 4.8 - (y - waist) * 0.15, x + 5.2];
  }, S.panda ? S.fur : S.cloth, (_x, _y, t) => cyl(t, 0.1));
  if (!S.panda) for (let x = Math.round(cx - 4.8); x < cx + 5.2; x++) if ((x * 5) % 3 === 0) c.erase(x, Math.round(hem));
  c.part();
  c.shape(Math.round(waist) - (S.panda ? 1 : 0), Math.round(waist), () => [hx - 5.4, hx + 5.4], S.panda ? S.cloth : S.harness, (_x, _y, t) => cyl(t, 0));
  if (S.panda) {
    // The sash's ends hanging at the back.
    c.part();
    c.px(hx + 4, waist + 1, S.cloth, sphere(0.6, 0));
    c.px(hx + 4, waist + 2, S.cloth, sphere(0.6, 0), { bias: -1 });
    c.px(hx + 5, waist + 1, S.cloth, sphere(0.7, 0));
  }

  headSide(c, hx, U, p);
  pauldron(c, hx + 1, 13.2 + U, 2.9, 2.2);

  if (!fa.behind) armA(0);
  // The near arm last.
  arm(c, hx + 0.2, 14.8 + U, fb, REACH_SIDE, [0.4, 1], p.claws, 0);
}

/** The panda's bamboo shoot, held across his paws to his mouth: a jointed stalk, leaves at its top. */
function bamboo(c: PixelCanvas, fa: Placed, fb: Placed, left: number): void {
  if (left <= 0) return;
  const x0 = (fa.x + fb.x) / 2 - 3;
  const y0 = (fa.y + fb.y) / 2 + 1;
  // It runs up and across to the mouth; bites shorten it from the top.
  const len = 3 + 7 * left;
  const x1 = x0 + len * 0.55;
  const y1 = y0 - len * 0.8;
  c.part();
  c.capsule(x0, y0, x1, y1, 0.75, 0.7, BAMBOO_STALK, { bias: 1 });
  for (let k = 0.3; k < 1; k += 0.35) c.shade(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, -2);
  c.part();
  if (left > 0.5) {
    c.px(x1 + 1, y1 - 1, BAMBOO_LEAF, sphere(0.5, 0.6), { bias: 1 });
    c.px(x1 + 2, y1 - 1, BAMBOO_LEAF, sphere(0.7, 0.3));
    c.px(x1 - 1, y1 - 1, BAMBOO_LEAF, sphere(-0.5, 0.6));
  } else c.px(x1, y1 - 0.5, BAMBOO_STALK, sphere(0, 0.8), { bias: 2 });
}

// ---------------------------------------------------------------------------
// Animations

/** Paws hanging heavy at the sides, a touch out from the belly. */
const rest = (): Hand => H(0.8, 7.6, -5.6);

/** Side-view hands: a little further forward, both at the body's line. */
const side = (h: Hand, arm: 'a' | 'b'): Hand => H(h.f + (arm === 'b' ? 0.8 : 0.5), 0, h.h);

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
    mouth: 0,
    claws: false,
    glow: 0,
    tick: 0,
  };
};

function idle(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = (f / N) * Math.PI * 2;
    const p = base(view);
    // Slow, heavy breaths; the paws stir with them; an ear flicks now and then.
    p.breath = Math.sin(ph) > 0.4 ? 1 : 0;
    p.a.h += p.breath * 0.4;
    p.b.h += p.breath * 0.4;
    p.tick = f;
    p.blink = f === 4;
    p.ear = f === 2;
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
      p.footA = Math.round(s * 2.4);
      p.footB = -p.footA;
      p.lean = 1;
    } else {
      p.footA = s > 0.3 ? 1 : 0;
      p.footB = s < -0.3 ? 1 : 0;
      // A lumbering roll from foot to foot.
      p.sway = s > 0.5 ? 1 : s < -0.5 ? -1 : 0;
    }
    p.a.f -= s * 1.5;
    p.b.f += s * 1.5;
    frames.push(p);
  }
  return frames;
}

interface Key {
  a?: Hand;
  b?: Hand;
  aSide?: Hand;
  bSide?: Hand;
  mouth?: number;
  claws?: boolean;
  glow?: number;
  lean?: number;
  breath?: number;
  lift?: number;
  step?: number;
}

/** An action as keyframes; anything left out stays at rest. */
function action(keys: Key[]) {
  return (view: View): Pose[] =>
    keys.map((k, i) => {
      const p = base(view);
      if (k.a) p.a = view === 'side' ? { ...(k.aSide ?? side(k.a, 'a')) } : { ...k.a };
      if (k.b) p.b = view === 'side' ? { ...(k.bSide ?? side(k.b, 'b')) } : { ...k.b };
      p.mouth = k.mouth ?? 0;
      p.claws = !!k.claws;
      p.glow = k.glow ?? 0;
      p.breath = k.breath ?? 0;
      p.lift = k.lift ?? 0;
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

// Maul: a heavy swipe from each paw in a wide arc, then both paws raised
// overhead and brought crashing down.
const swipe = action([
  { b: H(-0.4, 8, 3.6), a: H(1.6, 5, 0), claws: true, lean: -1 },
  { b: H(0.8, 8.2, 3), a: H(1.6, 5, -0.4), claws: true, lean: -1, breath: 1 },
  { b: H(4.6, 2.6, 0.8), a: H(1.2, 5.6, -1), claws: true, lean: 1, step: 1, mouth: 0.5 },
  { b: H(3.8, -2.2, -1), claws: true, lean: 1, step: 1, mouth: 0.3 },
  { b: H(1.6, 5, -2.4) },
]);

const swipe2 = action([
  { a: H(-0.4, 8, 3.6), aSide: H(-1.2, 0, 3.8), b: H(1.6, 5, 0), claws: true, lean: -1 },
  { a: H(0.8, 8.2, 3), aSide: H(-0.6, 0, 3.4), b: H(1.6, 5, -0.4), claws: true, lean: -1, breath: 1 },
  { a: H(4.6, 2.6, 0.8), aSide: H(4.8, 0, 0.8), b: H(1.2, 5.6, -1), claws: true, lean: 1, step: 1, mouth: 0.5 },
  { a: H(3.8, -2.2, -1), aSide: H(4.2, 0, -1), claws: true, lean: 1, step: 1, mouth: 0.3 },
  { a: H(1.6, 5, -2.4) },
]);

const smash = action([
  { a: H(0.6, 6, 3), b: H(0.6, 6, 3), claws: true, breath: 1, lean: -1 },
  { a: H(0.4, 4, 8.6), b: H(0.4, 4, 8.6), aSide: H(-1, 0, 9), bSide: H(-0.6, 0, 9), claws: true, lift: 2, lean: -1, mouth: 0.8 },
  { a: H(0.6, 3.6, 9.2), b: H(0.6, 3.6, 9.2), aSide: H(-0.8, 0, 9.4), bSide: H(-0.4, 0, 9.4), claws: true, lift: 2, lean: -1, mouth: 1 },
  { a: H(5, 3, -0.6), b: H(5, 3, -0.6), claws: true, lean: 1, step: 1, breath: 2, mouth: 1 },
  { a: H(5, 3.2, -1), b: H(5, 3.2, -1), claws: true, lean: 1, step: 1, breath: 2, mouth: 0.5 },
  { a: H(2.2, 5.6, -2.4), b: H(2.2, 5.6, -2.4), breath: 1 },
]);

/** Earthsplitter: he crouches, rears up on his hind legs roaring with his paws high, and slams down. */
const quake = action([
  { a: H(1.2, 7.6, -2.6), b: H(1.2, 7.6, -2.6), breath: 1, mouth: 0.3 },
  { a: H(0.6, 7.2, 5), b: H(0.6, 7.2, 5), aSide: H(0, 0, 6), bSide: H(0.4, 0, 6), lift: 2, mouth: 0.8, claws: true, glow: 0.5 },
  { a: H(0.4, 6, 8.8), b: H(0.4, 6, 8.8), aSide: H(-0.6, 0, 9.6), bSide: H(-0.2, 0, 9.6), lift: 3, mouth: 1.4, claws: true, glow: 1 },
  { a: H(3.4, 5, 2.4), b: H(3.4, 5, 2.4), lift: 1, mouth: 1, claws: true, lean: 1, glow: 0.8 },
  { a: H(4.6, 5.4, -2.4), b: H(4.6, 5.4, -2.4), breath: 2, mouth: 0.8, claws: true, lean: 1, step: 1, glow: 0.6 },
  { a: H(4.4, 5.6, -2.6), b: H(4.4, 5.6, -2.6), breath: 2, mouth: 0.4, lean: 1, step: 1 },
  { a: H(2, 6.6, -2.8), b: H(2, 6.6, -2.8), breath: 1 },
]);

/** Ursine Wrath's pose: chest thrown out, arms flung wide and up, a roar with the eyes ablaze. */
const rally = action([
  { a: H(1, 7, -1.6), b: H(1, 7, -1.6), breath: 1, glow: 0.3 },
  { a: H(0.8, 8, 2), b: H(0.8, 8, 2), mouth: 0.6, glow: 0.6, claws: true },
  { a: H(0.6, 8.4, 5), b: H(0.6, 8.4, 5), lift: 1, mouth: 1.4, glow: 1, claws: true },
  { a: H(0.6, 8.6, 5.6), b: H(0.6, 8.6, 5.6), lift: 1, mouth: 1.4, glow: 1, claws: true },
  { a: H(0.6, 8.4, 5), b: H(0.6, 8.4, 5), lift: 1, mouth: 1.4, glow: 1, claws: true },
  { a: H(0.8, 8, 4.4), b: H(0.8, 8, 4.4), mouth: 1, glow: 0.9, claws: true },
]);

// ---------------------------------------------------------------------------
// The idle moment (`rest`), played facing us when he has stood still a while.
// Each starts and ends on idle's first frame so it slips in and out unseen.

/** Idle's first frame, with changes. */
const still = (o: Partial<Pose> = {}): Pose => ({ ...idle('down')[0], ...o });

/** The belly scratch: the paw's two ends of the stroke. */
const SCRATCH_LO = H(2.4, 2.6, -3.4);
const SCRATCH_HI = H(2.6, 2.2, -1.2);

/**
 * The grizzly lifts his nose and sniffs the air this way and that, then
 * gives his belly a long, lazy scratch, eyes half shut, and pats it twice,
 * content.
 */
function sniff(view: View): Pose[] {
  if (view !== 'down') return [];
  return [
    still(),
    still({ nod: -1, sniff: true, tick: 1 }),
    still({ nod: -1, turn: -1, sniff: true, tick: 2 }),
    still({ nod: -1, turn: -1, tick: 3 }),
    still({ nod: -1, turn: 1, sniff: true, tick: 4 }),
    still({ nod: -1, turn: 1, tick: 5 }),
    // The scratch.
    still({ b: SCRATCH_LO, claws: false, tick: 6 }),
    still({ b: SCRATCH_HI, blink: true, nod: 1, tick: 7 }),
    still({ b: SCRATCH_LO, blink: true, nod: 1, tick: 8 }),
    // Two pats, and a contented breath.
    still({ a: H(2.2, 3.2, -1.6), b: H(2.2, 3.2, -1.6), breath: 1, blink: true, tick: 9 }),
    still({ a: H(2.4, 3, -2.6), b: H(2.4, 3, -2.6), breath: 1, blink: true, tick: 10 }),
    still({ mouth: 0.4, blink: true, tick: 11 }),
  ];
}
const SNIFF_ORDER = [0, 1, 2, 3, 2, 3, 4, 5, 4, 5, 0, 6, 7, 8, 7, 8, 7, 8, 9, 10, 9, 10, 11, 11, 0];

/** The panda's paws holding the shoot up to his mouth. */
const HOLD_A = H(2.6, 2.4, 1.6);
const HOLD_B = H(2.6, 2.4, 0.6);

/**
 * The panda draws out a bamboo shoot and munches it, bite by bite, the
 * stalk getting shorter, chewing with his eyes shut, until it's gone.
 */
function munch(view: View): Pose[] {
  if (view !== 'down') return [];
  return [
    still(),
    still({ a: H(1.8, 4.6, -0.6), b: H(1.8, 4.6, -1.2), bamboo: 1, tick: 1 }),
    still({ a: HOLD_A, b: HOLD_B, bamboo: 1, tick: 2 }),
    // Bite...
    still({ a: HOLD_A, b: HOLD_B, bamboo: 1, mouth: 0.6, nod: 1, tick: 3 }),
    // ...chew.
    still({ a: HOLD_A, b: HOLD_B, bamboo: 0.75, blink: true, tick: 4 }),
    still({ a: HOLD_A, b: HOLD_B, bamboo: 0.75, mouth: 0.4, blink: true, tick: 5 }),
    still({ a: HOLD_A, b: HOLD_B, bamboo: 0.75, mouth: 0.6, nod: 1, tick: 6 }),
    still({ a: HOLD_A, b: HOLD_B, bamboo: 0.45, blink: true, tick: 7 }),
    still({ a: HOLD_A, b: HOLD_B, bamboo: 0.45, mouth: 0.4, blink: true, tick: 8 }),
    still({ a: HOLD_A, b: HOLD_B, bamboo: 0.45, mouth: 0.6, nod: 1, tick: 9 }),
    still({ a: HOLD_A, b: HOLD_B, bamboo: 0.15, blink: true, tick: 10 }),
    // The last of it, and a happy sigh.
    still({ a: H(1.8, 4.2, -0.4), b: H(1.8, 4.2, -0.4), mouth: 0.4, blink: true, tick: 11 }),
    still({ breath: 1, blink: true, tick: 12 }),
  ];
}
const MUNCH_ORDER = [0, 1, 2, 3, 4, 5, 4, 5, 6, 7, 8, 7, 8, 9, 10, 10, 11, 11, 12, 12, 0];

// ---------------------------------------------------------------------------
// Frame generation

export type BearAnim = 'idle' | 'walk' | 'swipe' | 'swipe2' | 'smash' | 'quake' | 'rally' | 'rest';

interface BearAnimDef {
  name: BearAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => Pose[];
  /** Only drawn for the panda (true) or the grizzly (false); for both when left out. */
  panda?: boolean;
  /** Frames played in this order, some held or repeated. */
  order?: readonly number[];
}

const BEAR_ANIMS: BearAnimDef[] = [
  { name: 'idle', fps: 5, loop: true, poses: idle },
  { name: 'walk', fps: 9, loop: true, poses: walk },
  { name: 'swipe', fps: 12, loop: false, poses: swipe },
  { name: 'swipe2', fps: 12, loop: false, poses: swipe2 },
  { name: 'smash', fps: 11, loop: false, poses: smash },
  { name: 'quake', fps: 10, loop: false, poses: quake },
  { name: 'rally', fps: 10, loop: false, poses: rally },
  { name: 'rest', fps: 7, loop: false, poses: sniff, panda: false, order: SNIFF_ORDER },
  { name: 'rest', fps: 7, loop: false, poses: munch, panda: true, order: MUNCH_ORDER },
];

/** The anims a look has. */
export const bearAnims = (look: BearLook): BearAnimDef[] => BEAR_ANIMS.filter((a) => a.panda === undefined || a.panda === look.panda);

/** Each action's length and the frame it lands on, so the game's timing matches its animation. */
export const BEAR_TIMING: Record<'swipe' | 'smash' | 'quake', { ms: number; land: number }> = {
  swipe: { ms: (5 / 12) * 1000, land: (2 / 12) * 1000 },
  smash: { ms: (6 / 11) * 1000, land: (3 / 11) * 1000 },
  quake: { ms: (7 / 10) * 1000, land: (4 / 10) * 1000 },
};

export interface BearFrame {
  key: string;
  anim: BearAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawBearFrame(dir: Dir, pose: Pose): PixelCanvas {
  const c = new PixelCanvas(BEAR_W, BEAR_H).offset(BODY_X, BODY_Y);
  if (dir === 'down') drawDown(c, pose);
  else if (dir === 'up') drawUp(c, pose);
  else drawSide(c, pose);
  return dir === 'right' ? c.mirrored() : c;
}

export function buildBearFrames(look: BearLook = GRIZZLY_LOOK): BearFrame[] {
  S = look;
  const out: BearFrame[] = [];
  for (const a of bearAnims(look)) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, index) => {
        out.push({ key: `${a.name}_${dir}_${index}`, anim: a.name, dir, canvas: drawBearFrame(dir, pose) });
      });
    }
  }
  S = GRIZZLY_LOOK;
  return out;
}

// ---------------------------------------------------------------------------
// Button icons

const tones = (look: BearLook): Tones => look.light;

/** Maul: a great paw, claws out, three wide arcs of the swipe sweeping past it. */
export function maulIcon(look: BearLook = GRIZZLY_LOOK): Uint8ClampedArray {
  const t = tones(look);
  const fur: RGB = look.panda ? hex('#2c2c36') : hex('#5a3a1c');
  const dark: RGB = look.panda ? hex('#101014') : hex('#2e1a0c');
  const pad: RGB = look.panda ? hex('#4a4a56') : hex('#24160c');
  const claw: RGB = hex('#f0e8d0');
  return icon16((put) => {
    // The swipe's arcs, behind the paw.
    for (let k = 0; k < 3; k++) {
      const r = 10.5 - k * 2.2;
      for (let a = -0.15; a <= 1.75; a += 0.06) {
        const x = 15 - Math.cos(a) * r;
        const y = 15 - Math.sin(a) * r;
        put(x, y, a > 1.3 ? t[0] : a > 0.8 ? t[1] : k === 2 ? t[3] : t[2]);
      }
    }
    // The paw: a broad palm, four toes over it, a claw from each.
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const dx = x + 0.5 - 6.5;
        const dy = y + 0.5 - 9.5;
        if ((dx * dx) / 12 + (dy * dy) / 9 <= 1) put(x, y, dx + dy < -2 ? fur : dark);
      }
    }
    put(5, 10, pad);
    put(6, 10, pad);
    put(7, 10, pad);
    put(6, 11, pad);
    for (const [x, y] of [[2, 6], [4, 4], [7, 4], [10, 6]] as const) {
      put(x, y, fur);
      put(x + 1, y, fur);
      put(x, y + 1, dark);
      put(x + 1, y + 1, dark);
    }
    for (const [x, y, dx] of [[1, 4, 0], [3, 2, 0], [8, 2, 1], [11, 4, 1]] as const) {
      put(x + dx, y + 1, claw);
      put(x + (dx ? 1 : 0) + (dx ? 0 : 1) - 1 + dx, y, claw);
    }
  });
}

/** Earthsplitter: the ground split by cracks running out from a slam, a ring of force round it, rock thrown up. */
export function quakeIcon(look: BearLook = GRIZZLY_LOOK): Uint8ClampedArray {
  const t = tones(look);
  const earth: RGB = hex('#7a5a38');
  const deep: RGB = hex('#3a281a');
  const leaf: RGB = hex('#62ae44');
  return icon16((put) => {
    // The ring of force on the ground.
    for (let a = 0; a < Math.PI * 2; a += 0.08) {
      const x = 8 + Math.cos(a) * 7;
      const y = 11 + Math.sin(a) * 3.6;
      put(x, y, Math.sin(a) > 0 ? t[1] : t[2]);
    }
    // Cracks running out from the heart, lit from inside.
    const cracks: [number, number][][] = [
      [[8, 11], [6, 10], [5, 11], [2, 10]],
      [[8, 11], [10, 10], [11, 11], [14, 10]],
      [[8, 11], [7, 13], [8, 14]],
      [[8, 11], [9, 8], [8, 7]],
    ];
    for (const path of cracks) {
      for (let i = 1; i < path.length; i++) seg(put, path[i - 1][0], path[i - 1][1], path[i][0], path[i][1], i === 1 ? t[0] : t[1]);
    }
    put(8, 11, t[0]);
    // Rock flung up, or the panda's bamboo leaves.
    const bits: [number, number][] = [[3, 4], [12, 3], [6, 2], [14, 6], [1, 7]];
    bits.forEach(([x, y], i) => {
      if (look.panda && i % 2 === 0) {
        put(x, y, leaf);
        put(x + 1, y - 1, leaf);
      } else {
        put(x, y, i % 2 ? deep : earth);
        put(x + 1, y, earth);
        put(x, y + 1, deep);
      }
    });
  });
}

/** Every look's button icons, handed to `add` by texture key. */
export function registerBearIcons(add: (key: string, px: Uint8ClampedArray) => void): void {
  for (const look of BEAR_LOOKS) {
    add(`icon_maul_${look.key}`, maulIcon(look));
    add(`icon_quake_${look.key}`, quakeIcon(look));
  }
}
