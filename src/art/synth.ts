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

export const SYNTH_W = 48;
export const SYNTH_H = 50;
/** Drawn in the 24x32 body box every hero uses, placed in a larger frame. */
const BODY_X = 12;
const BODY_Y = 12;
export const SYNTH_ORIGIN_X = BODY_X + 12;
export const SYNTH_ORIGIN_Y = BODY_Y + 31;
/** The chest's height above the feet, where drones launch from and return to. */
export const SYNTH_CHEST_Y = 14;
/** A hand raised this far (px, up is -) is at the side of the head, and drawn over it. */
const RAISED = -6;

// ---------------------------------------------------------------------------
// Materials

const SHELL: Material = { ramp: ramp('#2e3444', '#525c72', '#7e8aa2', '#aeb8cc', '#d8e0ec'), outline: hex('#0c0f18'), outlineLit: hex('#1a2030'), shine: true };
const CHROME: Material = { ramp: ramp('#161a24', '#30384a', '#56627a', '#8e9ab0', '#c8d2e2'), outline: hex('#07080e'), shine: true };
const JOINT: Material = { ramp: ramp('#07090e', '#10141e', '#1c2230'), outline: hex('#030406') };
const CYAN: Material = { ramp: ramp('#0a4a66', '#1690c0', '#3ad0f8', '#9af0ff'), outline: hex('#041c28'), emissive: 1, noAO: true };
/** The halo: pure light, no outline, so it reads as a thin ring and not a disc. */
const HALO: Material = { ...CYAN, noOutline: true };

const GOLD: Material = { ramp: ramp('#3e2206', '#74440c', '#b07818', '#dca432', '#f6d470'), outline: hex('#160c02'), outlineLit: hex('#261604'), shine: true };
const CHITIN: Material = { ramp: ramp('#050408', '#0e0c16', '#1a1726', '#2c283e', '#443e5e'), outline: hex('#010102'), shine: true };
const EYE: Material = { ramp: ramp('#200602', '#561604', '#963a0c', '#d87424', '#ffb850'), outline: hex('#0a0302'), shine: true, emissive: 0.3 };
const AMBER: Material = { ramp: ramp('#b0580a', '#f0a030', '#ffe090'), outline: hex('#3a1a02'), emissive: 1, noAO: true };
const WING: Material = { ramp: ramp('#8a7040', '#c0a868', '#e8d8a8'), outline: hex('#4a3410'), emissive: 0.3, noAO: true };

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
  /** The idle moment: the head tilted a px left (-) or right; the halo spinning, a bright spot at this step of its ring (-1 still). */
  tilt: number;
  spin: number;
  /** The scanning beam out of the visor (or the compound eyes): -2..2 from far left through facing the viewer (0) to far right; null off. */
  scan: number | null;
  /** 0..1: the visor (or eyes) flashing bright, a ping when the scan ends. */
  ping: number;
}

const base = (): SynthPose => ({ bob: 0, liftA: 0, liftB: 0, strideA: 0, strideB: 0, handA: { x: 0, y: 0 }, handB: { x: 0, y: 0 }, open: 0, float: 0, flap: 0, tilt: 0, spin: -1, scan: null, ping: 0 });

// ---------------------------------------------------------------------------
// Parts (in body-box coordinates: 24 wide, the feet at y 31)

/** A limb: upper part, a joint, lower part (the hive's chitin jointed every other pixel). */
function limb(c: PixelCanvas, a: Pt, b: Pt, bend: Pt, upper: Material, lower: Material, r0: number, r1: number, joint: Material): void {
  const k = { x: (a.x + b.x) / 2 + bend.x, y: (a.y + b.y) / 2 + bend.y };
  c.capsule(a.x, a.y, k.x, k.y, r0, r0 * 0.9, upper);
  c.px(Math.round(k.x - 0.5), Math.round(k.y - 0.5), joint, { x: 0, y: 0.2, z: 1 });
  c.capsule(k.x, k.y, b.x, b.y, r1, r1 * 0.85, lower);
  if (L.hive && lower === CHITIN) {
    const n = Math.max(1, Math.round(Math.hypot(b.x - k.x, b.y - k.y) / 2));
    for (let i = 1; i < n; i++) c.shade(Math.round(k.x + ((b.x - k.x) * i) / n), Math.round(k.y + ((b.y - k.y) * i) / n), -1);
  }
}

function leg(c: PixelCanvas, hip: Pt, foot: Pt, out: number, side: boolean): void {
  c.part();
  limb(c, hip, { x: foot.x, y: foot.y - 1.5 }, { x: out * 0.4, y: -0.3 }, L.hive ? CHITIN : SHELL, L.hive ? GOLD : CHROME, 1.35, 1.2, JOINT);
  c.part();
  if (side) c.shape(Math.round(foot.y - 1), Math.round(foot.y), (y) => [foot.x - (y < foot.y - 0.5 ? 1.5 : 2.5), foot.x + 1.2], L.hive ? CHITIN : CHROME, (_x, _y, t) => cyl(t, 0.4));
  else c.ellipse(foot.x, foot.y - 0.6, 1.5, 1.1, L.hive ? CHITIN : CHROME);
}

function arm(c: PixelCanvas, shoulder: Pt, hand: Pt, out: number): void {
  c.part();
  c.ellipse(shoulder.x, shoulder.y, 1.7, 1.6, L.hive ? GOLD : SHELL);
  limb(c, { x: shoulder.x, y: shoulder.y + 0.8 }, hand, { x: out * 0.5, y: 0 }, L.hive ? CHITIN : SHELL, L.hive ? CHITIN : CHROME, 1.15, 1.05, L.hive ? GOLD : CHROME);
  c.part();
  c.ellipse(hand.x, hand.y + 0.4, 1, 1, L.hive ? GOLD : CHROME);
}

/** Honeycomb: dark seams along a hex grid (the Hive Queen's armour and wings). */
function hexEdge(x: number, y: number, s = 2.4): boolean {
  const q = (x + 0.5) / s;
  const r = (y + 0.5) / (s * 0.866);
  const row = Math.floor(r);
  const qx = q - (row % 2 ? 0.5 : 0);
  const fx = qx - Math.floor(qx);
  const fy = r - row;
  return fx < 0.2 || fy < 0.22;
}

/** The chest: shoulders to waist, its seam and core (parted for the Special). */
function torso(c: PixelCanvas, cx: number, top: number, open: number, view: View): void {
  const bottom = top + 7;
  const m = L.hive ? GOLD : SHELL;
  const edges = (y: number): [number, number] => {
    const k = (y - top) / (bottom - top);
    const hw = view === 'side' ? 3.2 - k * 0.6 : 4.8 - k * 1.6;
    return [cx - hw, cx + hw];
  };
  c.shape(top, bottom, (y) => {
    const [l, r] = edges(y);
    const part = view === 'down' ? open * 0.8 : 0;
    return [l - part, r + part];
  }, m, (_x, y, t) => sphere(t * 0.9, ((y - top) / (bottom - top)) * 0.9 - 0.4, 1));
  c.part();
  if (L.hive) {
    for (let y = top; y <= bottom; y++) {
      const [l, r] = edges(y);
      for (let x = Math.round(l); x < r; x++) if (hexEdge(x, y)) c.shade(x, y, -1);
    }
  } else if (view !== 'side') {
    for (let y = top + 3; y <= bottom; y++) c.shade(Math.round(cx - 0.5), y, -1);
  }
  if (view === 'down') {
    const coreY = top + 2.6;
    const r = 1.2 + open * 1.2;
    if (L.hive) {
      for (let y = Math.floor(coreY - r); y <= coreY + r; y++) {
        const hw = r - Math.abs(y + 0.5 - coreY) * 0.5;
        for (let x = Math.round(cx - hw); x < cx + hw; x++) c.px(x, y, AMBER, sphere((x + 0.5 - cx) / r, (y + 0.5 - coreY) / r), { glow: 0.8 + open * 0.2 });
      }
    } else c.ellipse(cx, coreY, r, r, CYAN, { glow: 0.8 + open * 0.2 });
    if (open > 0) {
      const core: RGB = L.hive ? hex('#fff0b0') : hex('#e6fcff');
      for (let i = 1; i <= 3; i++) for (let s = -1; s <= 1; s++) c.spark(cx + s, coreY + r + i, core, open * (0.6 - i * 0.12));
    }
  } else if (view === 'up') {
    for (let y = top + 1; y <= bottom - 1; y++) c.px(Math.round(cx - 0.5), y, L.hive ? AMBER : CYAN, { x: 0, y: 0, z: 1 }, { glow: 0.5 });
  }
}

/** The Synth's head: a smooth shell with a band of light for eyes. */
function synthHead(c: PixelCanvas, cx: number, cy: number, view: View, tilt = 0, ping = 0): void {
  c.part();
  c.ellipse(cx, cy, view === 'side' ? 4.1 : 4.6, 4.3, SHELL, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.15, 1) });
  c.part();
  if (view === 'down') {
    // The visor's band, sloping with a tilt of the head (the side it leans to drops).
    for (let x = Math.round(cx - 3); x < cx + 3; x++) {
      const k = (x + 0.5 - cx) / 3.3;
      c.px(x, Math.round(cy + 0.4 + k * k * 0.6 + k * tilt * 0.9), CYAN, sphere(k, 0, 1), ping > 0 ? { bias: 1, glow: 1 } : undefined);
    }
    if (ping > 0) for (let x = Math.round(cx - 3); x < cx + 3; x++) c.spark(x, cy - 0.5, hex('#e6fcff'), ping * 0.5);
    for (let x = Math.round(cx - 1.5); x <= cx + 0.5; x++) c.shade(x, Math.round(cy + 3), -1);
  } else if (view === 'side') {
    for (let x = Math.round(cx - 4); x <= cx - 1.5; x++) c.px(x, Math.round(cy + 0.4), CYAN, { x: -0.7, y: 0, z: 0.7 });
    c.ellipse(cx + 1, cy + 0.3, 1.1, 1.3, CHROME);
  } else {
    c.px(Math.round(cx - 0.5), Math.round(cy + 2.5), CYAN);
    c.ellipse(cx - 4, cy + 0.3, 0.7, 1.2, CHROME);
    c.ellipse(cx + 4, cy + 0.3, 0.7, 1.2, CHROME);
  }
}

/** The halo, a thin ring of light floating over the head. */
function halo(c: PixelCanvas, cx: number, cy: number, spin = -1): void {
  c.part();
  const y = Math.round(cy);
  const x0 = Math.round(cx - 3);
  // Seen from above at a slant: a line of light front and back, closing at the ends.
  for (let x = x0 + 1; x <= x0 + 4; x++) {
    c.px(x, y - 1, HALO, { x: 0, y: 1, z: 0.3 }, { glow: 0.7 });
    c.px(x, y + 1, HALO, { x: 0, y: -0.5, z: 0.8 }, { glow: 0.9 });
  }
  c.px(x0, y, HALO, { x: -1, y: 0, z: 0.3 }, { glow: 0.9 });
  c.px(x0 + 5, y, HALO, { x: 1, y: 0, z: 0.3 }, { glow: 0.9 });
  if (spin < 0) return;
  // Spinning up: a bright spot running round the ring with a fading tail behind it.
  const ring: [number, number][] = [[1, 1], [2, 1], [3, 1], [4, 1], [5, 0], [4, -1], [3, -1], [2, -1], [1, -1], [0, 0]];
  const hot = hex('#e6fcff');
  for (let t = 0; t < 3; t++) {
    const [dx, dy] = ring[(((spin - t) % ring.length) + ring.length) % ring.length];
    if (t === 0) c.px(x0 + dx, y + dy, HALO, { x: 0, y: 0, z: 1 }, { glow: 1, bias: 2 });
    c.spark(x0 + dx, y + dy, hot, 0.9 - t * 0.3);
  }
  // A glint thrown off the ring as it whirls.
  const [gx, gy] = ring[spin % ring.length];
  c.spark(x0 + gx + (gx > 2.5 ? 1 : gx < 2.5 ? -1 : 0), y + gy * 2, hot, 0.5);
}

/**
 * The idle moment's scanning beam, thrown from the visor (the eyes) at
 * (x, y): a wedge of light out to the side that shortens as it swings round
 * to face the viewer, where it is only a flare.
 */
function scanBeam(c: PixelCanvas, x: number, y: number, dir: number, col: RGB): void {
  const s = Math.sign(dir);
  const len = Math.abs(dir) * 5.5;
  if (s === 0) {
    for (let a = 0; a < 8; a++) {
      const q = (a / 8) * Math.PI * 2;
      c.spark(x + Math.cos(q) * 2, y + 0.5 + Math.sin(q) * 1.2, col, 0.3);
    }
    return;
  }
  for (let i = 1; i <= len; i++) {
    const k = i / len;
    // Spreading and dipping a little as it goes, brightest at its core.
    const hw = 0.5 + k * 2.2;
    const cy = y + 0.5 + k * 3.5;
    for (let d = -hw; d <= hw; d += 0.5) {
      const core = 1 - Math.abs(d) / (hw + 0.5);
      c.spark(x + s * (3 + i), cy + d, col, (0.9 - k * 0.45) * core);
    }
  }
  // Where it lands: a bright scan line across the ground.
  if (Math.abs(dir) > 1) for (let d = -1; d <= 1; d++) c.spark(x + s * (3 + len), y + 4.5 + d * 1.5, col, 0.9);
}

/** The Hive Queen's head: compound eyes, a gold tiara, and curled antennae with glowing tips. */
function beeHead(c: PixelCanvas, cx: number, cy: number, view: View, float: number, tilt = 0, ping = 0): void {
  c.part();
  const antenna = (s: number, lean = 0) => {
    const x0 = cx + s * 1.2 + lean;
    // A tilt of the head swings both antennae over, the lower one drooping.
    const droop = s === Math.sign(tilt) ? 1 : 0;
    const pts: Pt[] = [
      { x: x0, y: cy - 3.5 },
      { x: x0 + s * 1.2 + tilt * 0.5, y: cy - 5.5 + droop },
      { x: x0 + s * 2.8 + tilt, y: cy - 7 - float + droop * 1.5 },
    ];
    for (let i = 0; i < pts.length - 1; i++) c.line(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, CHITIN);
    const tip = pts[pts.length - 1];
    c.ellipse(tip.x + s * 0.6, tip.y, 0.9, 0.9, AMBER);
  };
  if (view === 'side') {
    antenna(-1, 1);
    antenna(1, -1.5);
  } else {
    antenna(-1);
    antenna(1);
  }
  c.part();
  c.ellipse(cx, cy, view === 'side' ? 3.8 : 4.2, 4, CHITIN, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.15, 1) });
  c.part();
  if (view === 'down') {
    for (const s of [-1, 1]) {
      // A tilt drops the eye on the side it leans to.
      const ey = cy + 0.4 + (s === Math.sign(tilt) ? 0.6 : 0);
      c.ellipse(cx + s * 2, ey, 1.6, 2, EYE, ping > 0 ? { glow: 0.3 + ping * 0.7, bias: 1 } : {});
      c.px(Math.round(cx + s * 2 - 0.6), Math.round(ey - 1), EYE, { x: -0.4, y: 0.6, z: 0.7 }, { bias: 2 });
    }
    c.px(Math.round(cx - 1), Math.round(cy + 3), GOLD);
    c.px(Math.round(cx), Math.round(cy + 3), GOLD);
  } else if (view === 'side') {
    c.ellipse(cx - 1.8, cy + 0.4, 1.5, 2, EYE);
    c.px(Math.round(cx - 2.4), Math.round(cy - 0.6), EYE, { x: -0.4, y: 0.6, z: 0.7 }, { bias: 2 });
    c.px(Math.round(cx - 3.6), Math.round(cy + 2.6), GOLD);
  }
  // The tiara: three gold points on the brow (a band round the back).
  c.part();
  const ty = cy - 3;
  if (view === 'up') for (let x = Math.round(cx - 3); x <= cx + 2; x++) c.px(x, Math.round(ty + 0.5), GOLD, cyl((x + 0.5 - cx) / 3.5, 0.5));
  else {
    const step = view === 'side' ? 0.8 : 1.1;
    const x0 = view === 'side' ? cx - 2.6 : cx - 2.2;
    for (let i = 0; i < 5; i++) c.px(Math.round(x0 + i * step), Math.round(ty), GOLD, cyl(i / 2 - 1, 0.5));
    for (const i of [0, 2, 4]) c.px(Math.round(x0 + i * step), Math.round(ty - 1), GOLD, { x: 0, y: 0.8, z: 0.6 }, { bias: 1 });
    c.px(Math.round(x0 + 2 * step), Math.round(ty), AMBER);
  }
}

/** The striped abdomen, with its stinger. */
function abdomen(c: PixelCanvas, cx: number, cy: number, rx: number, ry: number, tipX: number, tipY: number): void {
  c.part();
  c.capsule(cx, cy, tipX, tipY, 0.9, 0.3, CHITIN);
  c.ellipse(cx, cy, rx, ry, GOLD);
  c.part();
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      const along = rx > ry ? dx : dy;
      if (Math.floor((along + 1) * 2.2) % 2 === 1) c.px(x, y, CHITIN, sphere(dx, dy, 1));
    }
  }
}

/** Two small wings on one side, veined with honeycomb, swept by `flap`. */
function wings(c: PixelCanvas, root: Pt, s: number, flap: number, view: View): void {
  c.part();
  const wing = (len: number, ang: number, w: number) => {
    const ex = root.x + s * Math.cos(ang) * len;
    const ey = root.y - Math.sin(ang) * len;
    const n = Math.ceil(len * 2);
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const hw = Math.sin(k * Math.PI) * w;
      const px = root.x + (ex - root.x) * k;
      const py = root.y + (ey - root.y) * k;
      for (let d = -hw; d <= hw; d += 0.5) {
        const x = Math.round(px);
        const y = Math.round(py + d);
        if (c.filled(x, y)) continue;
        c.px(x, y, WING, { x: s * 0.3, y: 0.5, z: 0.8 }, { bias: hexEdge(x, y, 2) ? -1 : 1 });
      }
    }
  };
  if (view === 'side') {
    wing(7, 0.8 + flap * 0.4, 1.6);
    wing(5.5, 0.3 + flap * 0.3, 1.3);
  } else {
    wing(7.5, 0.6 + flap * 0.25, 1.7);
    wing(5.5, 0.1 + flap * 0.2, 1.4);
  }
}

// ---------------------------------------------------------------------------
// The figure

function drawFigure(c: PixelCanvas, p: SynthPose, view: View): void {
  const hive = L.hive;
  const U = -p.bob;
  const hipY = 23 + U;
  const chest = 15 + U;
  const headY = 10.4 + U;
  const cx = 12;

  // Behind: the hive's wings (and from the front, her abdomen).
  if (hive) {
    if (view === 'side') wings(c, { x: cx + 1.5, y: chest + 1.5 }, 1, p.flap, view);
    else if (view === 'down') {
      for (const s of [-1, 1]) wings(c, { x: cx + s * 1.5, y: chest + 1.5 }, s, p.flap, view);
      abdomen(c, cx, hipY + 1.4, 3.2, 2.4, cx, hipY + 5.5);
    }
  }
  if (view === 'side') {
    // The far arm and leg, a shade darker.
    arm(c, { x: cx + 0.8, y: chest + 1 }, { x: cx + 1 + p.handB.x, y: hipY - 1 + p.handB.y }, 1);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 24; x++) if (c.filled(x, y) && c.materialAt(x, y) !== WING) c.shade(x, y, -1);
    leg(c, { x: cx + 0.5, y: hipY }, { x: cx + 0.5 + p.strideB, y: 31 - p.liftB }, 1, true);
  } else {
    leg(c, { x: cx - 2, y: hipY }, { x: cx - 2.4, y: 31 - p.liftA }, -1, false);
    leg(c, { x: cx + 2, y: hipY }, { x: cx + 2.4, y: 31 - p.liftB }, 1, false);
  }
  c.part();
  c.ellipse(cx, hipY - 0.3, view === 'side' ? 2.3 : 3, 1.4, hive ? CHITIN : JOINT);
  if (view === 'side') {
    if (hive) abdomen(c, cx + 3.4, hipY - 0.6, 3.2, 2.4, cx + 7.2, hipY + 1.6);
    leg(c, { x: cx - 0.5, y: hipY }, { x: cx - 0.5 + p.strideA, y: 31 - p.liftA }, 1, true);
  }
  c.part();
  c.px(Math.round(cx - 0.5), Math.round(chest - 1), hive ? CHITIN : JOINT);
  torso(c, cx, chest, p.open, view);

  if (hive && view === 'up') {
    abdomen(c, cx, hipY + 1.4, 3.6, 3, cx, hipY + 6);
    for (const s of [-1, 1]) wings(c, { x: cx + s * 1.5, y: chest + 1.5 }, s, p.flap, view);
  }

  if (view === 'side') arm(c, { x: cx - 0.2, y: chest + 1 }, { x: cx - 0.6 + p.handA.x, y: hipY - 1 + p.handA.y }, 1);
  else {
    arm(c, { x: cx - 5, y: chest + 1 }, { x: cx - 5.8 + p.handA.x, y: hipY - 1.5 + p.handA.y }, -1);
    // (A hand raised to the side of the head, in the idle moment, is drawn over it, after the head.)
    if (p.handB.y > RAISED) arm(c, { x: cx + 5, y: chest + 1 }, { x: cx + 5.8 + p.handB.x, y: hipY - 1.5 + p.handB.y }, 1);
  }

  const hx = cx + p.tilt;
  if (hive) beeHead(c, hx, headY, view, p.float, p.tilt, p.ping);
  else {
    synthHead(c, hx, headY, view, p.tilt, p.ping);
    halo(c, hx, headY - 6.4 - p.float, p.spin);
  }
  if (view !== 'side' && p.handB.y <= RAISED) arm(c, { x: cx + 5, y: chest + 1 }, { x: cx + 5.8 + p.handB.x, y: hipY - 1.5 + p.handB.y }, 1);
  if (p.scan !== null) scanBeam(c, hx - 0.5, headY + (hive ? 0.4 : 0.4), p.scan, hive ? hex('#ffc860') : hex('#7ae8ff'));
}

// ---------------------------------------------------------------------------
// Animations

export type SynthAnim = 'idle' | 'walk' | 'command' | 'grid' | 'open' | 'rest';

interface AnimDef {
  name: SynthAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => SynthPose[];
  /** Frame indices to play in order, when some are held or repeated. */
  order?: readonly number[];
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
    p.liftA = Math.max(0, Math.round(s * 1.5));
    p.liftB = Math.max(0, Math.round(-s * 1.5));
    if (view === 'side') {
      p.strideA = Math.round(-Math.cos(a) * 2.5);
      p.strideB = Math.round(Math.cos(a) * 2.5);
      p.handA = { x: Math.round(Math.cos(a) * 1.5), y: 0 };
      p.handB = { x: Math.round(-Math.cos(a) * 1.5), y: 0 };
    } else {
      p.handA = { x: 0, y: Math.round(s) };
      p.handB = { x: 0, y: Math.round(-s) };
    }
    p.flap = i % 2;
    p.float = i % 3 === 0 ? 1 : 0;
    return p;
  });

/** Sending a drone: an arm flung out the way it goes. */
const command = (view: View): SynthPose[] =>
  [0.4, 1, 1, 0.5].map((k, i) => {
    const p = base();
    const reach = view === 'side' ? { x: -5 * k, y: -4 * k } : view === 'down' ? { x: 2 * k, y: -2.5 * k } : { x: 2 * k, y: -5 * k };
    if (view === 'side') p.handA = reach;
    else p.handB = reach;
    p.flap = i % 2;
    p.float = 1;
    return p;
  });

/** Casting the grid: both arms spread wide and up. */
const grid = (view: View): SynthPose[] =>
  [0.3, 0.7, 1, 1, 0.6].map((k, i) => {
    const p = base();
    if (view === 'side') {
      p.handA = { x: -3.5 * k, y: -6 * k };
      p.handB = { x: 2 * k, y: -6 * k };
    } else {
      p.handA = { x: -3 * k, y: -6 * k };
      p.handB = { x: 3 * k, y: -6 * k };
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
    const back = view === 'side' ? { x: 3 * k, y: -2 * k } : { x: 0, y: -3.5 * k };
    p.handA = view === 'side' ? back : { x: -2.5 * k, y: back.y };
    p.handB = view === 'side' ? back : { x: 2.5 * k, y: back.y };
    p.flap = i % 2;
    p.float = 1;
    return p;
  });

/**
 * The idle moment, facing the viewer only: a hand goes up to the side of its
 * head as the halo lifts and spins up, then it sweeps a beam of light across
 * the ground from one side to the other, the head tilting after it; back to
 * the middle, a ping of the visor (all clear), and it settles. The Hive
 * Queen does the same with her antennae up and amber light from her eyes.
 */
const rest = (view: View): SynthPose[] => {
  if (view !== 'down') return [];
  const at = (o: Partial<SynthPose>): SynthPose => ({ ...base(), ...o });
  // The hand at its temple, and on its way up and down.
  const up = { x: 0, y: -10 };
  const half = { x: 0.5, y: -4.5 };
  return [
    at({}),
    at({ handB: half, float: 1, spin: 0, flap: 1 }),
    at({ handB: up, float: 2, spin: 3 }),
    at({ handB: up, float: 2, spin: 6, tilt: -1, scan: -2, flap: 1 }),
    at({ handB: up, float: 2, spin: 9, tilt: -1, scan: -1 }),
    at({ handB: up, float: 2, spin: 2, scan: 0, flap: 1 }),
    at({ handB: up, float: 2, spin: 5, tilt: 1, scan: 1 }),
    at({ handB: up, float: 2, spin: 8, tilt: 1, scan: 2, flap: 1 }),
    at({ handB: up, float: 2, spin: 1, ping: 1 }),
    at({ handB: half, float: 1, spin: 4, bob: 1, flap: 1 }),
    at({ float: 1, handB: { x: 0, y: 1 } }),
  ];
};

export const SYNTH_ANIMS: AnimDef[] = [
  { name: 'idle', fps: 5, loop: true, poses: idle },
  { name: 'walk', fps: 10, loop: true, poses: walk },
  { name: 'command', fps: 18, loop: false, poses: command },
  { name: 'grid', fps: 14, loop: false, poses: grid },
  { name: 'open', fps: 10, loop: false, poses: open },
  { name: 'rest', fps: 9, loop: false, poses: rest, order: [0, 1, 2, 2, 3, 3, 3, 4, 5, 6, 7, 7, 7, 6, 5, 4, 3, 3, 4, 5, 5, 8, 8, 8, 2, 9, 10, 0] },
];

export interface SynthFrame {
  key: string;
  anim: SynthAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawFrame(dir: Dir, p: SynthPose): PixelCanvas {
  const c = new PixelCanvas(SYNTH_W, SYNTH_H).offset(BODY_X, BODY_Y);
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
