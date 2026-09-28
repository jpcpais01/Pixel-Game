// The Synth: a slim android in white shell and chrome, a band of cyan light
// for a visor, a halo ring floating over its head and a core glowing in its
// chest, which opens for its Special. Three drones orbit it (drawn apart, see
// `droneFrame`). Its Hive Queen skin is bio-mechanical on the same rig: a
// bee's head with great amber compound eyes, curled antennae with glowing
// tips and a little gold tiara; honeycomb armour over the chest with a hive
// core, black chitin limbs with gold greaves, a striped abdomen behind and
// four see-through wings that beat. Her drones are bee-bots.
//
// Three views like every hero: down, up, and the side view drawn facing
// left and mirrored for right.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB } from './pixel';
import { DIRS, type Dir } from './wizard';
import { icon16, seg, type Tones } from './druid';

const ramp = (...c: string[]): RGB[] => c.map(hex);

export const SYNTH_W = 36;
export const SYNTH_H = 46;
const CX = 18;
const GROUND = 43;
export const SYNTH_ORIGIN_X = CX;
export const SYNTH_ORIGIN_Y = GROUND;
/** The chest's height above the feet, where drones launch from and return to. */
export const SYNTH_CHEST_Y = 20;

// ---------------------------------------------------------------------------
// Materials

const SHELL: Material = { ramp: ramp('#5e687c', '#9ea8bc', '#d2dae8', '#f2f6ff', '#ffffff'), outline: hex('#161c2a'), outlineLit: hex('#262e40'), shine: true };
const CHROME: Material = { ramp: ramp('#1e222c', '#464e5e', '#8690a4', '#d0d8e6', '#ffffff'), outline: hex('#0a0c12'), shine: true };
const JOINT: Material = { ramp: ramp('#0a0d14', '#161c28', '#262e3e'), outline: hex('#04050a') };
const CYAN: Material = { ramp: ramp('#0e5a7e', '#1aa6d8', '#3ad6ff', '#8af0ff'), outline: hex('#062a3a'), emissive: 1, noAO: true };
/** The halo: pure light, no outline, so it reads as a thin ring and not a disc. */
const HALO: Material = { ...CYAN, noOutline: true };

const GOLD: Material = { ramp: ramp('#4e2a06', '#8e520e', '#d0901e', '#f4c63e', '#fff0a0'), outline: hex('#1e1002'), outlineLit: hex('#2e1a04'), shine: true };
const CHITIN: Material = { ramp: ramp('#060509', '#12101c', '#221f32', '#3a3652', '#5c5880'), outline: hex('#020203'), shine: true };
const EYE: Material = { ramp: ramp('#2a0802', '#6a1c06', '#b4440e', '#f08a2a', '#ffd070'), outline: hex('#0e0402'), shine: true, emissive: 0.3 };
const AMBER: Material = { ramp: ramp('#c86a0e', '#ffb03a', '#fff0b0'), outline: hex('#3a1a02'), emissive: 1, noAO: true };
const WING: Material = { ramp: ramp('#b89a5a', '#e8d49a', '#fff4d0'), outline: hex('#6a4a1a'), emissive: 0.35, noAO: true };

export interface SynthLook {
  key: string;
  /** The Hive Queen. */
  hive: boolean;
}

export const SYNTH_LOOK: SynthLook = { key: 'synth', hive: false };
export const HIVE_LOOK: SynthLook = { key: 'synth_hive', hive: true };
export const SYNTH_LOOKS = [SYNTH_LOOK, HIVE_LOOK];

let L: SynthLook = SYNTH_LOOK;

type View = 'down' | 'up' | 'side';

interface Pt {
  x: number;
  y: number;
}

export interface SynthPose {
  /** Whole body raised (walk). */
  bob: number;
  /** Feet lifted; in the side view stepped forward (+) or back. */
  liftA: number;
  liftB: number;
  strideA: number;
  strideB: number;
  /** Hands: where each is, relative to its default hanging spot. */
  handA: Pt;
  handB: Pt;
  /** 0..1: the chest plates parted, the core blazing (the Special). */
  open: number;
  /** The halo's (or the antennae's) bob, and the wings' beat 0..1. */
  float: number;
  flap: number;
}

const base = (): SynthPose => ({ bob: 0, liftA: 0, liftB: 0, strideA: 0, strideB: 0, handA: { x: 0, y: 0 }, handB: { x: 0, y: 0 }, open: 0, float: 0, flap: 0 });

// ---------------------------------------------------------------------------
// Parts

/** A limb: upper part, a dark joint, lower part, and the end (hand or foot). */
function limb(c: PixelCanvas, a: Pt, b: Pt, bend: Pt, upper: Material, lower: Material, r0: number, r1: number, joint: Material = JOINT): void {
  const k = { x: (a.x + b.x) / 2 + bend.x, y: (a.y + b.y) / 2 + bend.y };
  c.capsule(a.x, a.y, k.x, k.y, r0, r0 * 0.9, upper);
  c.ellipse(k.x, k.y, r1, r1, joint);
  c.capsule(k.x, k.y, b.x, b.y, r1, r1 * 0.85, lower);
  // The Hive Queen's chitin is jointed every couple of pixels.
  if (L.hive && lower === CHITIN) {
    const n = Math.max(1, Math.round(Math.hypot(b.x - k.x, b.y - k.y) / 2));
    for (let i = 1; i < n; i++) c.shade(Math.round(k.x + ((b.x - k.x) * i) / n), Math.round(k.y + ((b.y - k.y) * i) / n), -1);
  }
}

function leg(c: PixelCanvas, hip: Pt, foot: Pt, out: number, side: boolean): void {
  c.part();
  limb(c, hip, { x: foot.x, y: foot.y - 2 }, { x: out, y: -0.5 }, L.hive ? CHITIN : SHELL, L.hive ? GOLD : CHROME, 1.8, 1.5);
  c.part();
  // A small pointed foot.
  if (side) c.shape(Math.round(foot.y - 2), Math.round(foot.y - 1), (y) => [foot.x - (y < foot.y - 1.5 ? 2 : 3.2), foot.x + 1.5], L.hive ? CHITIN : CHROME, (_x, _y, t) => cyl(t, 0.4));
  else c.ellipse(foot.x, foot.y - 1.5, 1.8, 1.4, L.hive ? CHITIN : CHROME);
}

function arm(c: PixelCanvas, shoulder: Pt, hand: Pt, out: number): void {
  c.part();
  c.ellipse(shoulder.x, shoulder.y, 2.1, 2, L.hive ? GOLD : SHELL);
  limb(c, { x: shoulder.x, y: shoulder.y + 1 }, hand, { x: out, y: 0 }, L.hive ? CHITIN : SHELL, L.hive ? CHITIN : CHROME, 1.5, 1.35, L.hive ? GOLD : CHROME);
  c.part();
  c.ellipse(hand.x, hand.y + 0.5, 1.3, 1.3, L.hive ? GOLD : CHROME);
}

/** Honeycomb: dark seams along a hex grid (the Hive Queen's armour and wings). */
function hexEdge(x: number, y: number, s = 3): boolean {
  const q = (x + 0.5) / s;
  const r = (y + 0.5) / (s * 0.866);
  const row = Math.floor(r);
  const qx = q - (row % 2 ? 0.5 : 0);
  const fx = qx - Math.floor(qx);
  const fy = r - row;
  return fx < 0.18 || fy < 0.2;
}

/** The chest: waist to shoulders, with its seam and core (parted for the Special). */
function torso(c: PixelCanvas, cx: number, top: number, open: number, view: View): void {
  const bottom = top + 10;
  const m = L.hive ? GOLD : SHELL;
  const edges = (y: number): [number, number] => {
    const k = (y - top) / (bottom - top);
    const hw = view === 'side' ? 3.6 - k * 1 : 5.6 - k * 2.6;
    return [cx - hw, cx + hw + (view === 'side' ? 0.5 : 0)];
  };
  c.shape(top, bottom, (y) => {
    const [l, r] = edges(y);
    // The plates part down the middle when it opens.
    return [l - (view === 'down' ? open : 0), r + (view === 'down' ? open : 0)];
  }, m, (_x, _y, t, u) => cyl(t, 0.35 - u * 0.4));
  c.part();
  if (L.hive) {
    for (let y = top; y <= bottom; y++) {
      const [l, r] = edges(y);
      for (let x = Math.round(l); x < r; x++) if (hexEdge(x, y)) c.shade(x, y, -2);
    }
  } else if (view !== 'side') {
    // Panel seams.
    for (let y = top + 2; y <= bottom; y++) c.shade(Math.round(cx), y, -1);
    for (let x = Math.round(cx - 3); x <= cx + 3; x++) c.shade(x, top + 7, -1);
  }
  if (view === 'down') {
    // The core: a disc of light (a hexagon for the hive), wider and brighter as the plates part.
    const r = 1.6 + open * 1.8;
    const coreY = top + 3.5;
    if (L.hive) {
      for (let y = Math.floor(coreY - r); y <= coreY + r; y++) {
        const hw = r - Math.abs(y + 0.5 - coreY) * 0.5;
        for (let x = Math.round(cx - hw); x < cx + hw; x++) c.px(x, y, AMBER, sphere((x + 0.5 - cx) / r, (y + 0.5 - coreY) / r), { glow: 0.8 + open * 0.2 });
      }
    } else c.ellipse(cx, coreY, r, r, CYAN, { glow: 0.8 + open * 0.2 });
    if (open > 0) {
      // Light pours out of the gap.
      const core = L.hive ? hex('#fff0b0') : hex('#e6fcff');
      for (let i = 1; i <= 4; i++) for (let s = -1; s <= 1; s++) c.spark(cx + s, coreY + r + i, core, open * (0.6 - i * 0.1));
    }
  } else if (view === 'up') {
    // A power conduit down the spine.
    for (let y = top + 1; y <= bottom - 1; y++) c.px(Math.round(cx), y, L.hive ? AMBER : CYAN, { x: 0, y: 0, z: 1 }, { glow: 0.6 });
  }
}

/** The Synth's head: a smooth shell with a band of light for eyes. */
function synthHead(c: PixelCanvas, cx: number, cy: number, view: View): void {
  c.part();
  c.ellipse(cx, cy, view === 'side' ? 4 : 4.2, 4.6, SHELL);
  c.part();
  if (view === 'down') {
    for (let x = Math.round(cx - 3.5); x < cx + 3.5; x++) {
      const k = (x + 0.5 - cx) / 3.8;
      const y = Math.round(cy + k * k * 0.8);
      c.px(x, y, CYAN, sphere(k, 0, 1));
      c.px(x, y - 1, CYAN, sphere(k, -0.2, 1), { glow: 0.6 });
    }
    // The seam of the jaw.
    for (let x = Math.round(cx - 2); x <= cx + 1; x++) c.shade(x, Math.round(cy + 3), -1);
  } else if (view === 'side') {
    for (let x = Math.round(cx - 4); x <= cx - 1; x++) {
      c.px(x, Math.round(cy), CYAN, { x: -0.7, y: 0, z: 0.7 });
      c.px(x, Math.round(cy - 1), CYAN, { x: -0.7, y: 0.2, z: 0.7 }, { glow: 0.6 });
    }
    // An ear disc.
    c.ellipse(cx + 1, cy, 1.4, 1.6, CHROME);
  } else {
    // A small light at the base of the skull.
    c.px(Math.round(cx), Math.round(cy + 2), CYAN);
    c.ellipse(cx - 4, cy, 0.8, 1.4, CHROME);
    c.ellipse(cx + 4, cy, 0.8, 1.4, CHROME);
  }
}

/** The halo, a thin ring of light floating over the head. */
function halo(c: PixelCanvas, cx: number, cy: number): void {
  c.part();
  for (let y = Math.floor(cy - 2); y <= cy + 2; y++) {
    for (let x = Math.floor(cx - 6); x <= cx + 6; x++) {
      const dx = (x + 0.5 - cx) / 5.2;
      const dy = (y + 0.5 - cy) / 1.5;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (Math.abs(d - 1) < 0.22) c.px(x, y, HALO, { x: 0, y: 1, z: 0.3 }, { glow: 0.9 });
    }
  }
}

/** The Hive Queen's head: great compound eyes, a gold tiara, and curled antennae with glowing tips. */
function beeHead(c: PixelCanvas, cx: number, cy: number, view: View, float: number): void {
  // Antennae behind the head, curling out.
  c.part();
  const antenna = (s: number, lean = 0) => {
    const x0 = cx + s * 1.4 + lean;
    const pts: Pt[] = [
      { x: x0, y: cy - 4 },
      { x: x0 + s * 1.5, y: cy - 7 },
      { x: x0 + s * 3.5, y: cy - 9 - float },
      { x: x0 + s * 5, y: cy - 8.5 - float },
    ];
    for (let i = 0; i < pts.length - 1; i++) c.line(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, CHITIN);
    const tip = pts[pts.length - 1];
    c.ellipse(tip.x, tip.y, 1.1, 1.1, AMBER);
  };
  if (view === 'side') {
    antenna(-1, 1);
    antenna(1, -2);
  } else {
    antenna(-1);
    antenna(1);
  }
  c.part();
  c.ellipse(cx, cy, view === 'side' ? 4 : 4.3, 4.4, CHITIN);
  c.part();
  if (view === 'down') {
    for (const s of [-1, 1]) {
      c.ellipse(cx + s * 2.2, cy + 0.2, 2, 2.6, EYE);
      // Facets glinting.
      c.px(Math.round(cx + s * 2.2 - 0.5), Math.round(cy - 1), EYE, { x: -0.4, y: 0.6, z: 0.7 }, { bias: 2 });
    }
    // Mandibles.
    c.px(Math.round(cx - 1), Math.round(cy + 3.5), GOLD);
    c.px(Math.round(cx), Math.round(cy + 3.5), GOLD);
  } else if (view === 'side') {
    c.ellipse(cx - 1.8, cy + 0.2, 1.8, 2.6, EYE);
    c.px(Math.round(cx - 2.5), Math.round(cy - 1), EYE, { x: -0.4, y: 0.6, z: 0.7 }, { bias: 2 });
    c.px(Math.round(cx - 4), Math.round(cy + 3), GOLD);
  }
  // The tiara: three gold points on the brow (a band round the back).
  c.part();
  const ty = cy - 3.5;
  if (view === 'up') for (let x = Math.round(cx - 3); x <= cx + 2; x++) c.px(x, Math.round(ty + 0.5), GOLD, cyl((x + 0.5 - cx) / 3.5, 0.5));
  else {
    const x0 = view === 'side' ? cx - 3 : cx - 2.5;
    for (let i = 0; i < 5; i++) c.px(Math.round(x0 + i * (view === 'side' ? 0.8 : 1.2)), Math.round(ty), GOLD, cyl(i / 2 - 1, 0.5));
    for (const i of [0, 2, 4]) c.px(Math.round(x0 + i * (view === 'side' ? 0.8 : 1.2)), Math.round(ty - 1), GOLD, { x: 0, y: 0.8, z: 0.6 }, { bias: 1 });
    c.px(Math.round(x0 + 2 * (view === 'side' ? 0.8 : 1.2)), Math.round(ty - 1), AMBER);
  }
}

/** The striped abdomen, with its stinger. */
function abdomen(c: PixelCanvas, cx: number, cy: number, rx: number, ry: number, tipX: number, tipY: number): void {
  c.part();
  c.capsule(cx, cy, tipX, tipY, 1.2, 0.4, CHITIN);
  c.ellipse(cx, cy, rx, ry, GOLD);
  c.part();
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      // Stripes across its length.
      const along = rx > ry ? dx : dy;
      if (Math.floor((along + 1) * 2.6) % 2 === 1) c.px(x, y, CHITIN, sphere(dx, dy, 1));
    }
  }
}

/** Two wings on one side, see-through gold with honeycomb veins, swept by `flap`. */
function wings(c: PixelCanvas, root: Pt, s: number, flap: number, view: View): void {
  c.part();
  const lift = flap * 4;
  const wing = (len: number, ang: number, w: number) => {
    const a = ang - (s < 0 ? 0 : 0);
    const ex = root.x + s * Math.cos(a) * len;
    const ey = root.y - Math.sin(a) * len;
    const n = Math.ceil(len * 2);
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const hw = Math.sin(k * Math.PI) * w;
      const px = root.x + (ex - root.x) * k;
      const py = root.y + (ey - root.y) * k;
      for (let d = -hw; d <= hw; d += 0.5) {
        const x = Math.round(px - Math.sin(a) * d * s * 0.3);
        const y = Math.round(py + d);
        if (c.filled(x, y)) continue;
        c.px(x, y, WING, { x: s * 0.3, y: 0.5, z: 0.8 }, { bias: hexEdge(x, y, 2.5) ? -1 : 1 });
      }
    }
  };
  if (view === 'side') {
    wing(10, 0.7 + flap * 0.5, 2.2);
    wing(8, 0.25 + flap * 0.4, 1.8);
  } else {
    wing(11, 0.55 + lift * 0.06, 2.4);
    wing(8.5, 0.05 + lift * 0.05, 1.9);
  }
}

// ---------------------------------------------------------------------------
// The figure

function drawFigure(c: PixelCanvas, p: SynthPose, view: View): void {
  const hive = L.hive;
  const hipY = 30 - p.bob;
  const chest = hipY - 10;
  const headY = chest - 6;
  const cx = view === 'side' ? CX + 0.5 : CX;

  // Behind: the hive's wings and (seen from the front) her abdomen; the Synth's halo when seen from behind.
  if (hive) {
    if (view === 'side') {
      wings(c, { x: cx + 2, y: chest + 2 }, 1, p.flap, view);
    } else if (view === 'down') {
      for (const s of [-1, 1]) wings(c, { x: cx + s * 2, y: chest + 2 }, s, p.flap, view);
      abdomen(c, cx, hipY + 1.5, 4.2, 3.4, cx, hipY + 7);
    }
  }
  if (view === 'side') {
    // The far arm, and the far leg.
    arm(c, { x: cx + 1, y: chest + 1 }, { x: cx + 1 + p.handB.x, y: hipY - 0.5 + p.handB.y }, 1);
    for (let y = 0; y < SYNTH_H; y++) for (let x = 0; x < SYNTH_W; x++) if (c.filled(x, y) && c.materialAt(x, y) !== WING) c.shade(x, y, -1);
    leg(c, { x: cx + 0.5, y: hipY }, { x: cx + 0.5 + p.strideB, y: GROUND - p.liftB }, 1, true);
  }

  // Legs.
  if (view !== 'side') {
    leg(c, { x: cx - 2.5, y: hipY }, { x: cx - 3, y: GROUND - p.liftA }, -1, false);
    leg(c, { x: cx + 2.5, y: hipY }, { x: cx + 3, y: GROUND - p.liftB }, 1, false);
  }
  // The pelvis.
  c.part();
  c.ellipse(cx, hipY, view === 'side' ? 2.8 : 3.8, 1.9, hive ? CHITIN : JOINT);

  if (view === 'side') {
    if (hive) abdomen(c, cx + 4.5, hipY - 0.5, 4.6, 3.4, cx + 10, hipY + 2);
    leg(c, { x: cx - 0.5, y: hipY }, { x: cx - 0.5 + p.strideA, y: GROUND - p.liftA }, 1, true);
  }
  // The neck and chest.
  c.part();
  c.capsule(cx, chest - 1, cx, chest - 2.5, 1.2, 1.2, hive ? CHITIN : JOINT);
  torso(c, cx, chest, p.open, view);

  // The back: the abdomen hangs in full view, the wings over it.
  if (hive && view === 'up') {
    abdomen(c, cx, hipY + 2, 5, 4.6, cx, hipY + 9);
    for (const s of [-1, 1]) wings(c, { x: cx + s * 2, y: chest + 2 }, s, p.flap, view);
  }

  // Arms.
  if (view === 'side') arm(c, { x: cx, y: chest + 1 }, { x: cx - 0.5 + p.handA.x, y: hipY - 0.5 + p.handA.y }, 1);
  else {
    arm(c, { x: cx - 6, y: chest + 1 }, { x: cx - 7 + p.handA.x, y: hipY - 0.5 + p.handA.y }, -1);
    arm(c, { x: cx + 6, y: chest + 1 }, { x: cx + 7 + p.handB.x, y: hipY - 0.5 + p.handB.y }, 1);
  }

  // The head, and over it the halo.
  if (hive) beeHead(c, cx, headY, view, p.float);
  else {
    synthHead(c, cx, headY, view);
    halo(c, cx, headY - 8 - p.float);
  }
}

// ---------------------------------------------------------------------------
// Animations

export type SynthAnim = 'idle' | 'walk' | 'command' | 'grid' | 'open';

interface AnimDef {
  name: SynthAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => SynthPose[];
}

const idle = (): SynthPose[] =>
  [0, 1, 2, 3].map((i) => {
    const p = base();
    p.float = i === 1 || i === 2 ? 1 : 0;
    p.bob = i === 2 ? 1 : 0;
    p.flap = i % 2;
    return p;
  });

/** A light, gliding stride. */
const walk = (view: View): SynthPose[] =>
  Array.from({ length: 6 }, (_, i) => {
    const p = base();
    const a = (i / 6) * Math.PI * 2;
    const s = Math.sin(a);
    p.bob = Math.round(Math.abs(Math.cos(a)));
    p.liftA = Math.max(0, Math.round(s * 2));
    p.liftB = Math.max(0, Math.round(-s * 2));
    if (view === 'side') {
      p.strideA = Math.round(-Math.cos(a) * 3);
      p.strideB = Math.round(Math.cos(a) * 3);
      p.handA = { x: Math.round(Math.cos(a) * 2), y: 0 };
      p.handB = { x: Math.round(-Math.cos(a) * 2), y: 0 };
    } else {
      p.handA = { x: 0, y: Math.round(s) };
      p.handB = { x: 0, y: Math.round(-s) };
    }
    p.flap = i % 2;
    p.float = i % 3 === 0 ? 1 : 0;
    return p;
  });

/** Sending a drone: the arm flung out the way it goes. */
const command = (view: View): SynthPose[] =>
  [0.4, 1, 1, 0.5].map((k, i) => {
    const p = base();
    const reach = view === 'side' ? { x: -7 * k, y: -6 * k } : view === 'down' ? { x: 3 * k, y: -3 * k } : { x: 3 * k, y: -7 * k };
    p.handB = view === 'side' ? { x: 0, y: 0 } : reach;
    if (view === 'side') p.handA = reach;
    p.flap = i % 2;
    p.float = 1;
    return p;
  });

/** Casting the grid: both arms spread wide and up. Also the pose it holds while a drone is summoned back. */
const grid = (view: View): SynthPose[] =>
  [0.3, 0.7, 1, 1, 0.6].map((k, i) => {
    const p = base();
    if (view === 'side') {
      p.handA = { x: -5 * k, y: -9 * k };
      p.handB = { x: 3 * k, y: -9 * k };
    } else {
      p.handA = { x: -4 * k, y: -9 * k };
      p.handB = { x: 4 * k, y: -9 * k };
    }
    p.flap = i % 2;
    p.float = i % 2;
    p.bob = k > 0.9 ? 1 : 0;
    return p;
  });

/** The Special: arms thrown back, the chest opening and the core blazing. */
const open = (view: View): SynthPose[] =>
  [0.2, 0.5, 0.8, 1, 1, 1].map((k, i) => {
    const p = base();
    p.open = k;
    p.bob = 1;
    const back = view === 'side' ? { x: 4 * k, y: -3 * k } : { x: 0, y: -5 * k };
    p.handA = view === 'side' ? back : { x: -3 * k, y: back.y };
    p.handB = view === 'side' ? back : { x: 3 * k, y: back.y };
    p.flap = i % 2;
    p.float = 1;
    return p;
  });

export const SYNTH_ANIMS: AnimDef[] = [
  { name: 'idle', fps: 5, loop: true, poses: idle },
  { name: 'walk', fps: 10, loop: true, poses: walk },
  { name: 'command', fps: 18, loop: false, poses: command },
  { name: 'grid', fps: 14, loop: false, poses: grid },
  { name: 'open', fps: 10, loop: false, poses: open },
];

export interface SynthFrame {
  key: string;
  anim: SynthAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawFrame(dir: Dir, p: SynthPose): PixelCanvas {
  const c = new PixelCanvas(SYNTH_W, SYNTH_H);
  drawFigure(c, p, dir === 'left' || dir === 'right' ? 'side' : dir);
  return dir === 'right' ? c.mirrored() : c;
}

export function buildSynthFrames(look: SynthLook = SYNTH_LOOK): SynthFrame[] {
  L = look;
  const out: SynthFrame[] = [];
  for (const a of SYNTH_ANIMS) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, i) => out.push({ key: `${a.name}_${dir}_${i}`, anim: a.name, dir, canvas: drawFrame(dir, pose) }));
    }
  }
  L = SYNTH_LOOK;
  return out;
}

// ---------------------------------------------------------------------------
// The drones

export const DRONE_SIZE = 12;
export const DRONE_FRAMES = 4;

/**
 * A drone, frame `f` of its hover: the Synth's is a white saucer with a cyan
 * eye and a rotor either side, blurring round; the Hive Queen's a round
 * striped bee-bot with an amber eye, a stinger and wings beating.
 */
export function droneFrame(f: number, hive: boolean): PixelCanvas {
  const c = new PixelCanvas(DRONE_SIZE, DRONE_SIZE);
  const cx = 6;
  const cy = 6;
  if (hive) {
    c.part();
    // Wings, up and down in turn.
    const up = f % 2 === 0;
    for (const s of [-1, 1]) {
      c.ellipse(cx + s * 2.5, cy - (up ? 3 : 1.5), 2.2, up ? 1.6 : 1.2, WING);
    }
    c.part();
    c.capsule(cx + 3, cy + 1, cx + 5, cy + 2, 0.7, 0.3, CHITIN);
    c.ellipse(cx, cy + 0.5, 3.4, 2.9, GOLD);
    c.part();
    for (const x of [cx - 1, cx + 1.5]) for (let y = Math.round(cy - 2); y <= cy + 3; y++) c.px(Math.round(x), y, CHITIN, sphere((x - cx) / 3.4, (y - cy) / 3, 1));
    c.ellipse(cx - 2.2, cy, 1, 1.1, AMBER);
    return c;
  }
  c.part();
  // Rotors: a blur that turns.
  for (const s of [-1, 1]) {
    const rx = cx + s * 4.2;
    const long = (f + (s > 0 ? 2 : 0)) % 4 < 2;
    c.ellipse(rx, cy - 2, long ? 2 : 1, 0.6, CHROME, { flatten: 0.5 });
  }
  c.part();
  c.ellipse(cx, cy, 3.6, 2.4, SHELL, { flatten: 0.9 });
  c.part();
  for (let x = cx - 3; x <= cx + 2; x++) c.shade(x, cy + 1, -1);
  c.ellipse(cx, cy - 0.2, 1.1, 1, CYAN);
  // A tiny antenna light, blinking.
  if (f % 2 === 0) c.spark(cx, cy - 3, [214, 251, 255], 1);
  return c;
}

// ---------------------------------------------------------------------------
// Button icons

const SYNTH_TONES: Tones = [hex('#e6fcff'), hex('#52e2ff'), hex('#1a86b0'), hex('#0a3a52')];
const HIVE_TONES: Tones = [hex('#fff0b0'), hex('#ffb03a'), hex('#c86a0e'), hex('#4e2a06')];

/** The drones' strike: a drone and a zap of light from it. */
export function droneIcon(hive = false): Uint8ClampedArray {
  const t = hive ? HIVE_TONES : SYNTH_TONES;
  const body: RGB = hive ? hex('#f4c63e') : hex('#f2f6ff');
  const dark: RGB = hive ? hex('#12101c') : hex('#8690a4');
  return icon16((put) => {
    for (let y = -3; y <= 3; y++) for (let x = -4; x <= 4; x++) if ((x * x) / 16 + (y * y) / 7 <= 1) put(5 + x, 5 + y, hive && (x === -1 || x === 2) ? dark : y > 1 ? dark : body);
    put(4, 5, t[1]);
    put(5, 5, t[0]);
    if (hive) {
      put(2, 1, hex('#e8d49a'));
      put(3, 1, hex('#e8d49a'));
      put(7, 1, hex('#e8d49a'));
      put(8, 1, hex('#e8d49a'));
    } else {
      seg(put, 0, 1, 3, 1, dark);
      seg(put, 7, 1, 10, 1, dark);
    }
    // The zap, jagged, to the corner.
    const pts: [number, number][] = [[8, 8], [10, 9], [9, 11], [12, 12], [11, 14], [15, 15]];
    for (let i = 0; i < pts.length - 1; i++) seg(put, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], i % 2 ? t[1] : t[0]);
    put(15, 15, t[0]);
  });
}

/** The grid: a triangle of lasers between three drones (a wall of honeycomb for the hive). */
export function gridIcon(hive = false): Uint8ClampedArray {
  const t = hive ? HIVE_TONES : SYNTH_TONES;
  return icon16((put) => {
    const pts: [number, number][] = [[8, 2], [2, 13], [14, 13]];
    if (hive) {
      // Hexagons along the edges.
      for (let i = 0; i < 3; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[(i + 1) % 3];
        for (let k = 0.2; k < 0.9; k += 0.3) {
          const x = x0 + (x1 - x0) * k;
          const y = y0 + (y1 - y0) * k;
          for (let a = 0; a < 6; a++) {
            const q = (a / 6) * Math.PI * 2;
            const q2 = ((a + 1) / 6) * Math.PI * 2;
            seg(put, x + Math.cos(q) * 1.6, y + Math.sin(q) * 1.6, x + Math.cos(q2) * 1.6, y + Math.sin(q2) * 1.6, t[1]);
          }
        }
      }
    } else for (let i = 0; i < 3; i++) seg(put, pts[i][0], pts[i][1], pts[(i + 1) % 3][0], pts[(i + 1) % 3][1], t[1]);
    for (const [x, y] of pts) {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) put(x + dx, y + dy, dx === 0 && dy === 0 ? t[0] : hive ? hex('#f4c63e') : hex('#f2f6ff'));
    }
  });
}
