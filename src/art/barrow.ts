// The Barrow Knight: a knight of the old kings, risen from his barrow mound,
// drawn from his own rig.
//
// A broad, heavy figure in black-iron plate gone to rust and dents: a flat-
// topped great helm with two pale-green eye-lights burning in its slit and
// a strip of burial linen knotted round it, great rounded pauldrons, a
// gorget, a breastplate and a skirt of lames over mail. Over the plate hangs
// a grave-green tabard torn into two tails, a faded barrow-door sigil on its
// chest; a tattered cloak falls behind him, and the linen he was buried in
// is still wound round his forearms and hangs in strips from his belt. A
// small soul-lamp hangs at his hip. In his hands is a maul: an ash haft
// socketed into the arch of a carved gravestone, bound in iron, its flat
// foot the striking face. Planted, it stands like the stone it was.
//
// Mossgrave is his skin: a bog-barrow the marsh has half taken back. Moss
// furs his pauldrons and the crown of his helm, lichen spots the plate,
// toadstools sprout on his shoulders, roots bind the maul's haft and creep
// over its stone, and his eyes and lamp burn with a wisp's blue-green.
//
// The body keeps to the 24x32 box; frames are larger so the maul can be
// raised overhead and swung out to either side. Like the necromancer's rig,
// the left-facing frames are drawn and the right-facing ones mirrored.

import { PixelCanvas, cyl, hex, sphere, FLAT, type Material, type RGB } from './pixel';
import { iconPainter } from './effects';
import { DIRS, type Dir } from './wizard';

export const BARROW_W = 60;
export const BARROW_H = 58;
const BODY_X = 18;
const BODY_Y = 18;
/** Sprite origin in the frame: body centre, just under the feet. */
export const BARROW_ORIGIN_X = BODY_X + 12;
export const BARROW_ORIGIN_Y = BODY_Y + 31;

const ramp = (...c: string[]): RGB[] => c.map(hex);

/** The moss on Mossgrave: clumps, lichen, the toadstools on his shoulders and the roots round his maul. */
export interface Overgrowth {
  moss: Material;
  lichen: Material;
  cap: Material;
  stem: Material;
  root: Material;
}

/** One look for the Barrow Knight: his harness, his rags, his maul and his lamp. */
export interface BarrowLook {
  key: string;
  /** The black iron of his harness, and what eats it (rust; verdigris on Mossgrave). */
  plate: Material;
  rust: Material;
  mail: Material;
  tabard: Material;
  cloak: Material;
  /** The burial linen wound on his arms and hanging from his belt; the tabard's sigil is stitched in it. */
  wrap: Material;
  belt: Material;
  /** The dark inside the helm, and the eye-lights burning in it. */
  slit: Material;
  eyes: Material;
  /** The maul: its haft, its gravestone and the iron binding it, the earth on its foot. */
  haft: Material;
  stone: Material;
  band: Material;
  dirt: Material;
  /** The soul-lamp's cage and its glass. */
  cage: Material;
  glass: Material;
  /** The corpse-light, brightest first. */
  light: [RGB, RGB, RGB, RGB];
  overgrowth?: Overgrowth;
}

// ---------------------------------------------------------------------------
// Looks

/** The corpse-light's sickly green, brightest first. */
export const SOUL_CORE = hex('#f4ffe0');
export const SOUL_HOT = hex('#d0ff8a');
export const SOUL_MID = hex('#8ad84a');
export const SOUL_DEEP = hex('#2e6a2a');
/** The will-o'-wisp's blue-green. */
export const WISP_CORE = hex('#ecfffc');
export const WISP_HOT = hex('#9ff8ee');
export const WISP_MID = hex('#3ad0c8');
export const WISP_DEEP = hex('#0e5a68');

export const BARROW_LOOK: BarrowLook = {
  key: 'necro_barrow',
  plate: { ramp: ramp('#0f1113', '#1c2024', '#2c3237', '#434a50', '#626a71', '#8a9198'), outline: hex('#050607'), outlineLit: hex('#0d0f11'), shine: true },
  rust: { ramp: ramp('#26120a', '#45210f', '#683417', '#8c4c22'), outline: hex('#0c0603') },
  mail: { ramp: ramp('#121416', '#22262a', '#363b40', '#4e545a'), outline: hex('#060708') },
  tabard: { ramp: ramp('#10170d', '#1c2a16', '#2c4020', '#3e5a2c', '#527236'), outline: hex('#060a04'), outlineLit: hex('#0c1208') },
  cloak: { ramp: ramp('#0a0c0a', '#141814', '#1f251d', '#2b3227'), outline: hex('#040504') },
  wrap: { ramp: ramp('#3c372c', '#686048', '#948a6c', '#bab091', '#d6ceb2'), outline: hex('#16140e') },
  belt: { ramp: ramp('#170e08', '#2a1b11', '#40291a'), outline: hex('#080503') },
  slit: { ramp: ramp('#020302', '#060806'), outline: hex('#020302'), noAO: true },
  eyes: { ramp: ramp('#3a7a1a', '#6ac838', '#a8ec60', '#d0ff98'), outline: hex('#0c1408'), emissive: 1, noAO: true, noOutline: true },
  haft: { ramp: ramp('#1c120a', '#302016', '#483222', '#60462e'), outline: hex('#0a0604') },
  stone: { ramp: ramp('#25282a', '#3c4144', '#585e60', '#787e7e', '#9a9f9c', '#b8bcb6'), outline: hex('#0a0b0c'), outlineLit: hex('#141618') },
  band: { ramp: ramp('#15171a', '#2a2e33', '#464c52', '#6c737a', '#9aa1a6'), outline: hex('#060708'), shine: true },
  dirt: { ramp: ramp('#22160e', '#3a281a', '#563c26', '#6e5034'), outline: hex('#0e0805') },
  cage: { ramp: ramp('#1c1408', '#33260f', '#523e1a', '#76602c'), outline: hex('#0a0602'), shine: true },
  glass: { ramp: ramp('#4a8a22', '#86c840', '#c0f07a', '#ecffc0'), outline: hex('#14200a'), emissive: 0.9, noAO: true },
  light: [SOUL_CORE, SOUL_HOT, SOUL_MID, SOUL_DEEP],
};

/** Mossgrave: moss, lichen and root over peat-dark iron, a mossy standing stone for a maul, a wisp's eyes. */
export const MOSSGRAVE_LOOK: BarrowLook = {
  key: 'necro_mossgrave',
  plate: { ramp: ramp('#0b100e', '#161f1b', '#24302a', '#36463c', '#4e6254', '#6e8472'), outline: hex('#040605'), outlineLit: hex('#0a0e0c'), shine: true },
  rust: { ramp: ramp('#142a26', '#1e463c', '#2c5e50', '#3e7a66'), outline: hex('#06100c') },
  mail: { ramp: ramp('#0c100e', '#18201c', '#28322c', '#3a463e'), outline: hex('#040605') },
  tabard: { ramp: ramp('#0e1a0c', '#1a2e14', '#2a461e', '#3c6028', '#4e7a32'), outline: hex('#050a04'), outlineLit: hex('#0a1208') },
  cloak: { ramp: ramp('#0c0a06', '#17130c', '#241e14', '#322a1c'), outline: hex('#050402') },
  wrap: { ramp: ramp('#2c3226', '#4c5642', '#6e7a62', '#909c80', '#aeb89c'), outline: hex('#0e120c') },
  belt: { ramp: ramp('#140e08', '#261a10', '#3a2a18'), outline: hex('#080503') },
  slit: { ramp: ramp('#010303', '#040908'), outline: hex('#010303'), noAO: true },
  eyes: { ramp: ramp('#0e6a6a', '#2ec8c0', '#6ae8e0', '#a8fff6'), outline: hex('#041a1c'), emissive: 1, noAO: true, noOutline: true },
  haft: { ramp: ramp('#1a1209', '#2e2014', '#46321e', '#5e462a'), outline: hex('#0a0603') },
  stone: { ramp: ramp('#1e221a', '#33392c', '#4c5442', '#68725a', '#868f74', '#a2aa8e'), outline: hex('#080a06'), outlineLit: hex('#12150e') },
  band: { ramp: ramp('#0f1612', '#1e2c24', '#325040', '#4e7860', '#78a488'), outline: hex('#040806'), shine: true },
  dirt: { ramp: ramp('#141e0e', '#243418', '#365022', '#4a6a2c'), outline: hex('#060a04') },
  cage: { ramp: ramp('#1a120a', '#2e2012', '#48321c', '#624628'), outline: hex('#0a0603') },
  glass: { ramp: ramp('#147a7a', '#3ab8b4', '#86ece4', '#dcfffa'), outline: hex('#041a1c'), emissive: 0.9, noAO: true },
  light: [WISP_CORE, WISP_HOT, WISP_MID, WISP_DEEP],
  overgrowth: {
    moss: { ramp: ramp('#1a3010', '#2c4c18', '#447022', '#5e922e', '#80b440'), outline: hex('#08120a') },
    lichen: { ramp: ramp('#7a8a5a', '#a0ac76', '#c4cc96'), outline: hex('#2a3020') },
    cap: { ramp: ramp('#4a1e10', '#7a3a1a', '#a85a2a', '#d08a44'), outline: hex('#1a0804'), shine: true },
    stem: { ramp: ramp('#8a8268', '#b8b090', '#dcd6b8'), outline: hex('#2a2618') },
    root: { ramp: ramp('#1a120a', '#2e2012', '#48321c', '#624628'), outline: hex('#0a0603') },
  },
};

export const BARROW_LOOKS = [BARROW_LOOK, MOSSGRAVE_LOOK];

/** The look being drawn; set by buildBarrowFrames. */
let S: BarrowLook = BARROW_LOOK;

const hash = (a: number, b: number): number => {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// ---------------------------------------------------------------------------
// The pose

type View = 'down' | 'up' | 'side';

export interface Pose {
  /** Whole body raised (walk passing frames, the heave). */
  lift: number;
  /** Upper body lowered (crouching into a blow). */
  breath: number;
  /** Feet: lifted (front, back) or forward (+) / back (-) in profile. */
  footA: number;
  footB: number;
  /** Upper body leaning forward (side view), px. */
  lean: number;
  /** The cloak's and the tabard's hems swinging, px. */
  sway: number;
  /**
   * The maul: its grip end in body coordinates, the way from there to the
   * stone in screen degrees (0 right, 90 down), how much of its length shows
   * (pointing at or away from the viewer shortens it) and how much of the
   * stone's face (0 edge on, 1 full face).
   */
  g: [number, number];
  d: number;
  fore: number;
  face: number;
  /** Drawn over the body, or behind it. */
  front: boolean;
  /**
   * Where each hand holds the haft, px from the grip end, or null when it's
   * free. `a` is the screen-left arm from the front and back, the far arm in
   * profile; `b` the other.
   */
  ta: number | null;
  tb: number | null;
  /** A free hand's place. */
  fa: [number, number];
  fb: [number, number];
  /** The hands on the haft drawn over the body or behind it, whichever layer the maul is on. */
  hands?: 'front' | 'behind';
  /** The soul-lamp's swing, -1..1, and its flame, 0..1. */
  lamp: number;
  flame: number;
  /** Frame counter, for the flame's flicker. */
  tick: number;
  /** The eye-lights: 0 out, 1 burning, over 1 flaring. */
  eyes?: number;
  /** The head shifted (x, y), px: a bow, a look up (front view). */
  head?: [number, number];
  /** Where the eye-lights turn: -1 left, 0 ahead, 1 right (front view). */
  look?: number;
  /** Earth clinging to the stone's foot, 0..1. */
  dirt?: number;
  /** Below this row (body coordinates) the stone is in the ground. */
  sink?: number;
  /** A glint running along the iron bands, 0..1 along the stone. */
  glint?: number;
  /** Down on one knee, 0..1 (front view only). */
  kneel?: number;
}

/** The haft, and the gravestone at its end, in px at full length; the stone's half width. */
const HAFT = 10;
const STONE = 8;
const STONE_W = 3.1;

const rad = (deg: number): number => (deg * Math.PI) / 180;

/** Where a hand is: on the haft, or free. */
function handAt(p: Pose, arm: 'a' | 'b'): [number, number] {
  const t = arm === 'a' ? p.ta : p.tb;
  if (t === null) return arm === 'a' ? p.fa : p.fb;
  const a = rad(p.d);
  return [p.g[0] + Math.cos(a) * t * p.fore, p.g[1] + Math.sin(a) * t * p.fore];
}

// ---------------------------------------------------------------------------
// The maul

/**
 * The maul: an iron pommel, a leather-wrapped ash haft (roots wound round
 * it on Mossgrave), an iron collar where it is socketed into the arch of a
 * gravestone, the stone itself with a cross cut in its face and an iron band
 * round its foot. The foot is the striking face; below `sink` it is in the
 * ground.
 */
function drawMaul(c: PixelCanvas, p: Pose, bias: number): void {
  const a = rad(p.d);
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const nx = -uy;
  const ny = ux;
  const f = p.fore;
  const [gx, gy] = p.g;
  const sx = gx + ux * HAFT * f;
  const sy = gy + uy * HAFT * f;
  const sink = p.sink ?? Infinity;
  const og = S.overgrowth;
  // The pommel, then the haft down to the stone, its grip wound in leather.
  c.part();
  c.capsule(gx, gy, sx, sy, 0.75, 0.8, S.haft, { bias });
  for (let i = 1; i <= 4; i += 2) c.shade(gx + ux * i * f, gy + uy * i * f, -1);
  c.part();
  c.ellipse(gx - ux * 0.4, gy - uy * 0.4, 1.0, 1.0, S.band, { bias });
  if (og) {
    // Roots wound round the haft, a leaf of moss by the grip.
    c.part();
    const n = Math.max(2, Math.round(HAFT * f));
    for (let i = 3; i <= n; i++) {
      const s = ((i & 1) * 2 - 1) * 0.9;
      c.px(gx + ux * i + nx * s, gy + uy * i + ny * s, og.root, sphere(s * 0.6, -0.2), { bias });
    }
    c.part();
    c.px(gx + ux * 2.4 - nx * 1.6, gy + uy * 2.4 - ny * 1.6, og.moss, sphere(-0.4, -0.5), { bias });
  }

  // The stone: an arch where the haft goes in, straight sides, a square foot.
  const L = STONE * (0.55 + 0.45 * Math.min(1, f));
  const W = STONE_W * (0.4 + 0.6 * p.face);
  const arch = Math.min(W, L * 0.4);
  const width = (u: number): number => {
    if (u < arch) {
      const k = (arch - u) / arch;
      return Math.max(0.7, W * Math.sqrt(Math.max(0, 1 - k * k)));
    }
    return W + 0.25 * ((u - arch) / Math.max(1, L - arch));
  };
  // Where the cross is cut, and the band round the foot.
  const crossU = arch + 0.6;
  const bandU = L - 1.6;
  c.part();
  const R = L + W + 2;
  for (let y = Math.floor(sy - R); y <= Math.ceil(sy + R); y++) {
    if (y + 0.5 > sink) continue;
    for (let x = Math.floor(sx - R); x <= Math.ceil(sx + R); x++) {
      const dx = x + 0.5 - sx;
      const dy = y + 0.5 - sy;
      const u = dx * ux + dy * uy;
      const v = dx * nx + dy * ny;
      if (u < -0.2 || u > L) continue;
      const w = width(u);
      const onBand = Math.abs(u - bandU) < 0.6;
      if (Math.abs(v) > w + (onBand ? 0.45 : 0)) continue;
      const t = v / Math.max(0.6, w);
      if (onBand) {
        c.px(x, y, S.band, sphere(nx * t * 0.7, ny * t * 0.7 - 0.2, 1), { bias });
        continue;
      }
      // Bevelled edges round a flat face that turns toward the light as it faces us.
      const foot = u > L - 0.9;
      const rim = Math.abs(v) > w - 0.9 || foot || u < arch * 0.5;
      const side = Math.sign(t) || 1;
      const n = rim
        ? sphere(nx * side * 0.65 + (foot ? ux * 0.5 : 0), ny * side * 0.65 + (foot ? uy * 0.5 : 0), 1)
        : sphere(nx * t * (0.25 + 0.6 * (1 - p.face)), ny * t * (0.25 + 0.6 * (1 - p.face)) + 0.1, 1);
      // The cross, cut in the face (only when it faces us), and the stone's pitting.
      const cut =
        p.face > 0.45 &&
        f > 0.55 &&
        ((Math.abs(v) < 0.55 && u > crossU && u < crossU + 3.2) || (Math.abs(u - (crossU + 1.1)) < 0.55 && Math.abs(v) < 1.6));
      const pit = !cut && hash(Math.round(u * 2) + 3, Math.round(v * 2) + 11) > 0.84 ? -1 : 0;
      c.px(x, y, S.stone, n, { bias: bias + (cut ? -3 : rim ? pit : pit - 1) });
    }
  }
  // The iron collar the haft is socketed in.
  c.part();
  c.ellipse(sx + ux * 0.2, sy + uy * 0.2, 1.1, 1.1, S.band, { bias });
  if (og) {
    // Moss on its shoulders, a root crawling down the face.
    c.part();
    for (const s of [-1, 1]) c.px(sx + ux * (arch + 0.5) + nx * s * (W - 0.4), sy + uy * (arch + 0.5) + ny * s * (W - 0.4), og.moss, sphere(nx * s * 0.5, -0.5), { bias });
    for (let u = 1.5; u < bandU; u += 1) c.px(sx + ux * u + nx * (W - 0.8 - u * 0.15), sy + uy * u + ny * (W - 0.8 - u * 0.15), og.root, sphere(0.3, -0.2), { bias });
    c.px(sx + ux * (L - 0.5) - nx * (W - 0.5), sy + uy * (L - 0.5) - ny * (W - 0.5), og.moss, sphere(-0.3, 0.2), { bias });
  }
  if (p.dirt && p.dirt > 0) {
    // Earth caked on the foot, a clod or two clinging to its corners.
    const k = p.dirt;
    c.part();
    for (let s = -W; s <= W; s += 0.8) c.px(sx + ux * (L - 0.3) + nx * s, sy + uy * (L - 0.3) + ny * s, S.dirt, sphere(nx * s * 0.3, -0.3), { bias });
    if (k > 0.6) {
      c.px(sx + ux * (L + 0.6) - nx * (W - 0.5), sy + uy * (L + 0.6) - ny * (W - 0.5), S.dirt, sphere(-0.3, 0.4), { bias });
      c.px(sx + ux * (L + 0.5) + nx * W * 0.5, sy + uy * (L + 0.5) + ny * W * 0.5, S.dirt, sphere(0.3, 0.4), { bias });
    }
    if (og) c.px(sx + ux * (L - 0.6), sy + uy * (L - 0.6), og.moss, sphere(0, -0.7), { bias });
  }
  if (p.glint !== undefined) {
    // Light running along the iron band.
    const s = (p.glint * 2 - 1) * W;
    c.spark(sx + ux * bandU + nx * s, sy + uy * bandU + ny * s, SOUL_CORE, 0.85);
    c.spark(sx + ux * bandU + nx * (s + 1), sy + uy * bandU + ny * (s + 1), S.light[1], 0.35);
  }
  if (sink < Infinity) {
    // Turned earth heaped where it is driven in, the seam lit from below.
    const t = (sink - sy) / (Math.abs(uy) > 0.2 ? uy : 1);
    const ex = sx + ux * Math.max(0, Math.min(L, t));
    c.part();
    c.ellipse(ex, sink - 0.2, 3.2, 1.0, S.dirt, { bias: bias - 1 });
    c.px(ex - 3, sink - 1, S.dirt, sphere(-0.5, -0.5), { bias });
    c.px(ex + 2, sink - 1.2, S.dirt, sphere(0.5, -0.5), { bias });
    c.spark(ex - 1, sink - 0.2, S.light[2], 0.5);
    c.spark(ex + 1, sink - 0.2, S.light[2], 0.4);
  }
}

// ---------------------------------------------------------------------------
// Parts

const REACH = 5.6;

/**
 * A plated arm from the shoulder to a gauntlet, bent at the elbow towards
 * `hint`: the rerebrace, a cop at the elbow, the vambrace with a turn of
 * burial linen round it, the gauntlet.
 */
function arm(c: PixelCanvas, sx: number, sy: number, fx: number, fy: number, hint: [number, number], bias = 0): void {
  const dx = fx - sx;
  const dy = fy - sy;
  const d = Math.hypot(dx, dy) || 0.01;
  let ex = sx + dx / 2;
  let ey = sy + dy / 2;
  if (d < REACH * 2) {
    const ang = Math.acos(Math.min(1, d / (REACH * 2)));
    const base = Math.atan2(dy, dx);
    let best = -Infinity;
    for (const t of [base + ang, base - ang]) {
      const cx = sx + Math.cos(t) * REACH;
      const cy = sy + Math.sin(t) * REACH;
      const score = (cx - sx) * hint[0] + (cy - sy) * hint[1];
      if (score > best) {
        best = score;
        ex = cx;
        ey = cy;
      }
    }
  }
  const wx = ex + (fx - ex) * 0.74;
  const wy = ey + (fy - ey) * 0.74;
  c.part();
  c.capsule(sx, sy, ex, ey, 1.8, 1.6, S.plate, { bias });
  c.part();
  c.capsule(ex, ey, wx, wy, 1.55, 1.45, S.plate, { bias });
  // A turn of burial linen round the vambrace near the wrist, its frayed end hanging.
  const fl = Math.hypot(wx - ex, wy - ey) || 1;
  const ax = (wx - ex) / fl;
  const ay = (wy - ey) / fl;
  const at = Math.max(1, fl - 1.4);
  c.part();
  for (const o of [-1.2, -0.4, 0.4, 1.2]) c.px(ex + ax * at - ay * o, ey + ay * at + ax * o, S.wrap, sphere(-ay * o * 0.5, ax * o * 0.5, 1), { bias: bias - 1 });
  c.px(ex + ax * at + 0.5, ey + ay * at + 1.8, S.wrap, sphere(0.2, 0.4), { bias: bias - 2 });
  c.part();
  c.ellipse(ex, ey, 1.35, 1.35, S.plate, { bias: bias + 1 });
  c.part();
  c.ellipse(fx, fy, 1.45, 1.4, S.plate, { bias });
}

/** A great rounded pauldron at the shoulder: a lame under it, a rivet, a dent; moss and a toadstool on Mossgrave. */
function pauldron(c: PixelCanvas, x: number, y: number, side: number, bias = 0): void {
  c.part();
  c.ellipse(x + side * 0.4, y + 1.8, 2.5, 1.3, S.plate, { bias: bias - 1, normal: (_x, _y, dx, dy) => sphere(dx * 0.7, dy * 0.4 + 0.3, 1) });
  c.part();
  c.ellipse(x, y, 2.9, 2.2, S.plate, { bias, normal: (_x, _y, dx, dy) => sphere(dx * 0.85, dy * 0.85 - 0.15, 1) });
  c.part();
  c.px(x + side * 1.2, y + 0.6, S.band, sphere(side * 0.3, -0.4), { bias: bias + 1 });
  c.shade(x - side * 1, y - 1, -1);
  const og = S.overgrowth;
  if (og) {
    c.part();
    for (let i = -2; i <= 1; i++) c.px(x + i, y - 1.6 - (i === -2 || i === 1 ? -0.6 : 0), og.moss, sphere(i * 0.3, -0.7), { bias });
    c.px(x + side * 2, y - 0.4, og.moss, sphere(side * 0.6, -0.3), { bias });
    toadstool(c, Math.round(x - side * 0.6), Math.round(y - 2));
  }
}

/** A little toadstool, its cap faintly aglow. */
function toadstool(c: PixelCanvas, x: number, y: number): void {
  const og = S.overgrowth;
  if (!og) return;
  c.part();
  c.px(x, y, og.stem, sphere(0, 0));
  c.part();
  c.px(x - 1, y - 1, og.cap, sphere(-0.6, -0.4));
  c.px(x, y - 1, og.cap, sphere(0, -0.8));
  c.px(x + 1, y - 1, og.cap, sphere(0.6, -0.4), { bias: -1 });
  c.spark(x, y - 1, S.light[2], 0.25);
}

/**
 * The soul-lamp hung at (x, y): an iron (Mossgrave: root) cage round a
 * bead of glass with a flame of corpse-light in it, its light spilling.
 */
function lamp(c: PixelCanvas, x: number, y: number, p: Pose, bias = 0): void {
  const lx = Math.round(x);
  const ly = Math.round(y);
  const [core, hot, mid] = S.light;
  c.part();
  c.px(lx, ly, S.cage, sphere(0, -0.6), { bias: bias - 1 });
  c.part();
  for (let i = -1; i <= 1; i++) c.px(lx + i, ly + 1, S.cage, sphere(i * 0.5, -0.6), { bias });
  for (const r of [2, 3]) {
    c.px(lx - 1, ly + r, S.cage, sphere(-0.7, 0), { bias });
    c.px(lx + 1, ly + r, S.cage, sphere(0.7, 0), { bias });
    c.px(lx, ly + r, S.glass, sphere(0, (r - 2.5) * 0.6));
  }
  c.px(lx, ly + 4, S.cage, sphere(0, 0.6), { bias });
  if (S.overgrowth) c.px(lx - 1, ly + 1, S.overgrowth.moss, sphere(-0.3, -0.7));
  // The flame, flickering, and its light round the cage.
  const fl = p.flame * (0.85 + 0.15 * [1, 0.6, 0.9, 0.5, 1, 0.7][p.tick % 6]);
  c.spark(lx, ly + 2 + (p.tick % 3 === 1 ? 1 : 0), core, 0.7 + 0.3 * fl);
  c.spark(lx, ly + 3, hot, 0.5 * fl);
  for (const [ox, oy] of [[-2, 2], [2, 3], [0, 5], [0, 0]] as const) c.spark(lx + ox, ly + oy, mid, 0.18 * fl);
}

/** Rust (verdigris) eating the plate, and lichen on Mossgrave, over (x0..x1, y0..y1). */
function weather(c: PixelCanvas, x0: number, x1: number, y0: number, y1: number, seed: number): void {
  c.part();
  const og = S.overgrowth;
  for (let y = Math.floor(y0); y <= y1; y++) {
    for (let x = Math.floor(x0); x <= x1; x++) {
      if (c.materialAt(x, y) !== S.plate) continue;
      const h = hash(x + seed, y * 3 + seed);
      if (h > 0.94) c.px(x, y, S.rust, sphere(0, -0.1), { bias: h > 0.985 ? 0 : -1 });
      else if (og && h < 0.025) c.px(x, y, og.lichen, sphere(0, -0.2));
    }
  }
}

/** Moss clumps on the shoulders and the cloak. */
function moss(c: PixelCanvas, clumps: [number, number][]): void {
  const og = S.overgrowth;
  if (!og) return;
  c.part();
  for (const [x, y] of clumps) {
    c.px(x, y, og.moss, sphere(-0.2, -0.6));
    c.px(x + 1, y, og.moss, sphere(0.3, -0.5));
    c.px(x, y + 1, og.moss, sphere(-0.3, 0.2), { bias: -1 });
  }
}

/** A ragged hem: how many rows are torn off the bottom of column x (0..2). */
const torn = (x: number, seed: number, deep = 0.5): number => {
  const h = hash(Math.round(x) * 7 + seed, seed);
  return h > 1 - deep * 0.4 ? 2 : h > 1 - deep ? 1 : 0;
};

/** One eye-light: a pinprick of corpse-light in the slit, dimming to nothing or flaring. */
function eye(c: PixelCanvas, x: number, y: number, p: Pose): void {
  const k = p.eyes ?? 1;
  if (k < 0.3) {
    c.px(x, y, S.slit);
    if (k > 0) c.spark(x, y, S.light[2], k * 1.6);
    return;
  }
  c.px(x, y, S.eyes, FLAT, { glow: Math.min(1, k) });
  c.spark(x, y, S.light[1], 0.3 * Math.min(1.4, k));
  if (k > 1.05) {
    const e = Math.min(1, (k - 1) * 1.6);
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) c.spark(x + ox, y + oy, S.light[1], 0.55 * e);
    for (const [ox, oy] of [[-2, 0], [2, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]] as const) c.spark(x + ox, y + oy, S.light[2], 0.3 * e);
  }
}

// ---------------------------------------------------------------------------
// The helm

/** The barrel of the great helm, rows top..bottom, a little narrower at the crown. */
function helmShape(c: PixelCanvas, hx: number, top: number, bottom: number): void {
  c.part();
  c.shape(Math.round(top), Math.round(bottom), (y) => {
    const r = y - Math.round(top);
    const hw = r < 1 ? 2.7 : 3.5;
    return [hx - hw, hx + hw];
  }, S.plate, (_x, _y, t, u) => sphere(t * 0.85, u < 0.12 ? -0.8 : u * 0.6 - 0.25, 1));
}

/** From the front: the barrel helm, its slit and eye-lights, the ridge down its face, breaths, a dent; the linen knotted round it. */
function helmDown(c: PixelCanvas, hx: number, hy: number, p: Pose): void {
  const top = 4 + hy;
  helmShape(c, hx, top, 12.4 + hy);
  const y = Math.round(top);
  // The ridge down the face, catching the light; the brow band.
  for (let r = 2; r <= 8; r++) c.shade(hx - 1, y + r, r === 4 ? 0 : 1);
  for (let x = hx - 3; x <= hx + 2; x++) c.shade(x, y + 2, -1);
  // The slit, either side of the ridge, the eyes burning in it.
  const lk = p.look ?? 0;
  c.part();
  for (const x of [hx - 3, hx - 2, hx + 1, hx + 2]) c.px(x, y + 4, S.slit);
  eye(c, hx - 2 + (lk < 0 ? -1 : 0), y + 4, p);
  eye(c, hx + 1 + (lk > 0 ? 1 : 0), y + 4, p);
  // Breaths punched in the right cheek; a dent in the left.
  for (const [x, r] of [[hx + 1, 6], [hx + 2, 6], [hx + 1, 7]] as const) c.shade(x, y + r, -2);
  c.shade(hx - 3, y + 6, -1);
  c.shade(hx - 2, y + 7, 1);
  weather(c, hx - 4, hx + 4, y, y + 9, 17);
  if (S.overgrowth) {
    const og = S.overgrowth;
    c.part();
    for (let x = hx - 3; x <= hx + 2; x++) if (hash(x, 5) > 0.3) c.px(x, y, og.moss, sphere((x - hx) * 0.2, -0.8));
    c.px(hx - 3, y + 1, og.moss, sphere(-0.6, -0.4));
    c.px(hx + 2, y + 1, og.lichen, sphere(0.4, -0.4));
  } else {
    // A strip of burial linen knotted round the crown, its end hanging.
    c.part();
    for (let x = hx - 3; x <= hx + 2; x++) c.px(x, y + 1, S.wrap, sphere((x - hx) * 0.25, -0.2), { bias: -2 + ((x + 1) & 1) });
    c.px(hx + 3, y + 2, S.wrap, sphere(0.5, 0), { bias: -1 });
    c.px(hx + 3, y + 3, S.wrap, sphere(0.6, 0.2), { bias: -2 });
  }
}

/** From behind: the back of the barrel, a seam down it, the linen's knot and tails hanging. */
function helmUp(c: PixelCanvas, hx: number, hy: number, p: Pose): void {
  const top = 4 + hy;
  helmShape(c, hx, top, 12.4 + hy);
  const y = Math.round(top);
  for (let r = 1; r <= 8; r++) c.shade(hx - 1, y + r, -1);
  for (let x = hx - 3; x <= hx + 2; x++) c.shade(x, y + 2, -1);
  weather(c, hx - 4, hx + 4, y, y + 9, 23);
  if (S.overgrowth) {
    const og = S.overgrowth;
    c.part();
    for (let x = hx - 3; x <= hx + 2; x++) if (hash(x, 9) > 0.25) c.px(x, y, og.moss, sphere((x - hx) * 0.2, -0.8));
    c.px(hx + 2, y + 1, og.moss, sphere(0.5, -0.4));
    c.px(hx - 2, y + 5, og.lichen, sphere(-0.2, 0));
  } else {
    c.part();
    for (let x = hx - 3; x <= hx + 2; x++) c.px(x, y + 1, S.wrap, sphere((x - hx) * 0.25, -0.2), { bias: -2 + ((x + 1) & 1) });
    // The knot at the back and two tails over the gorget.
    c.part();
    c.px(hx, y + 2, S.wrap, sphere(0.2, -0.3));
    c.capsule(hx, y + 3, hx + 0.6 + p.sway * 0.4, y + 8.5, 0.6, 0.5, S.wrap, { bias: -1 });
    c.capsule(hx + 1, y + 3, hx + 2.2 + p.sway * 0.5, y + 7.5, 0.55, 0.45, S.wrap, { bias: -1 });
  }
}

/** In profile, facing left: the barrel, the slit in its face and one eye-light, breaths, the linen's tails streaming back. */
function helmSide(c: PixelCanvas, hx: number, hy: number, p: Pose): void {
  const top = 4 + hy;
  helmShape(c, hx, top, 12.4 + hy);
  const y = Math.round(top);
  // The face plate juts a little at the front.
  c.part();
  c.px(hx - 4, y + 5, S.plate, sphere(-0.8, 0.1));
  c.px(hx - 4, y + 6, S.plate, sphere(-0.7, 0.3), { bias: -1 });
  for (let x = hx - 3; x <= hx + 2; x++) c.shade(x, y + 2, -1);
  c.part();
  for (const x of [hx - 4, hx - 3, hx - 2]) c.px(x, y + 4, S.slit);
  eye(c, hx - 3, y + 4, p);
  for (const [x, r] of [[hx - 3, 6], [hx - 2, 7]] as const) c.shade(x, y + r, -2);
  // A seam where the face plate meets the back.
  for (let r = 1; r <= 8; r++) c.shade(hx + 1, y + r, r & 1 ? -1 : 0);
  weather(c, hx - 4, hx + 4, y, y + 9, 31);
  if (S.overgrowth) {
    const og = S.overgrowth;
    c.part();
    for (let x = hx - 2; x <= hx + 3; x++) if (hash(x, 13) > 0.25) c.px(x, y, og.moss, sphere((x - hx) * 0.2, -0.8));
    c.px(hx + 3, y + 1, og.moss, sphere(0.6, -0.4));
    c.px(hx + 3, y + 2, og.moss, sphere(0.6, 0), { bias: -1 });
  } else {
    c.part();
    for (let x = hx - 3; x <= hx + 3; x++) c.px(x, y + 1, S.wrap, sphere((x - hx) * 0.25, -0.2), { bias: -2 + ((x + 1) & 1) });
    // Its tails streaming back from the knot.
    c.part();
    const s = p.sway * 0.6 + p.lean * 0.4;
    c.capsule(hx + 3.6, y + 1.6, hx + 5.4 + s, y + 5.2, 0.6, 0.5, S.wrap, { bias: -1 });
    c.capsule(hx + 3.6, y + 2.4, hx + 4.8 + s * 0.8, y + 7, 0.55, 0.45, S.wrap, { bias: -2 });
  }
}

// ---------------------------------------------------------------------------
// Directions

/** The breastplate's half width at row r below the gorget: square shoulders, then barrel-chested. */
const chestWidth = (r: number): number => (r < 1.5 ? 4.4 + r * 0.6 : 5.4 - Math.max(0, r - 4) * 0.12);

/** Greaves and sabatons, standing (or one knee down). */
function legs(c: PixelCanvas, L: number, cx: number, p: Pose): void {
  const k = p.kneel ?? 0;
  for (const [x, f, i] of [[cx - 3.2, p.footA, 0], [cx + 3.2, p.footB, 1]] as const) {
    const out = x < cx ? -1 : 1;
    if (k >= 0.5 && i === 0) {
      // The knee on the ground, the shin hidden behind it.
      c.part();
      c.capsule(x, 25.5 + L - 2, x + out * 0.2, 28.8, 1.7, 1.6, S.plate, { bias: -1 });
      c.part();
      c.ellipse(x + out * 0.2, 30, 2.0, 1.5, S.plate, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.6 - 0.3, 1) });
      continue;
    }
    c.part();
    c.capsule(x, 25 + L - (i === 1 ? k * 2 : 0), x + out * 0.1, 28.6 - f, 1.7, 1.6, S.plate, { bias: -1 });
    c.shade(x + out * 0.1, 27.6 - f, 1);
    c.part();
    c.ellipse(x + out * 0.3, 30.2 - f, 2.5, 1.5, S.plate, { flatten: 0.8, bias: -1 });
    c.shade(x + out * 0.3, 29.4 - f, 1);
  }
}

/**
 * The skirt of lames hanging from the belt over a fringe of mail, rows
 * waist..hem: each lame's lower edge lit, the one under it in shade.
 */
function faulds(c: PixelCanvas, cx: number, waist: number, hem: number, sway: (y: number) => number, w0: number, w1: number): void {
  c.part();
  c.shape(Math.round(hem), Math.round(hem + 1), (y) => {
    const hw = w1 - 0.6;
    return [cx - hw + sway(y), cx + hw + sway(y)];
  }, S.mail, (x, y) => sphere(((x + y) & 1) * 0.4 - 0.2, 0.3, 1));
  c.part();
  c.shape(Math.round(waist), Math.round(hem), (y) => {
    const u = (y - waist) / Math.max(1, hem - waist);
    const hw = w0 + (w1 - w0) * u;
    return [cx - hw + sway(y), cx + hw + sway(y)];
  }, S.plate, (_x, y, t) => sphere(t * 0.9, (y - Math.round(waist)) % 2 === 0 ? -0.35 : 0.35, 1));
}

function drawDown(c: PixelCanvas, p: Pose): void {
  const k = p.kneel ?? 0;
  const L = -p.lift + k * 4;
  const U = L + p.breath;
  const cx = 12;
  const [ax, ay] = handAt(p, 'a');
  const [bx, by] = handAt(p, 'b');
  const shA: [number, number] = [cx - 5.4, 15.4 + U];
  const shB: [number, number] = [cx + 5.4, 15.4 + U];
  // Hands raised over the head bend the elbows out to the sides, clear of the helm.
  const armA = () => arm(c, shA[0], shA[1], ax, ay, ay < 10 ? [-1, -0.2] : [-0.8, 0.6], p.ta !== null && !p.front && p.hands !== 'front' ? -1 : 0);
  const armB = () => arm(c, shB[0], shB[1], bx, by, by < 10 ? [1, -0.2] : [0.8, 0.6], p.tb !== null && !p.front && p.hands !== 'front' ? -1 : 0);
  const handsFront = p.hands ? p.hands === 'front' : p.front;
  let drewA = false;
  let drewB = false;
  if (!p.front) {
    drawMaul(c, p, -1);
    if (!handsFront) {
      if (p.ta !== null) (armA(), (drewA = true));
      if (p.tb !== null) (armB(), (drewB = true));
    }
  }

  const top = 13 + U;
  const waist = 20.5 + U;
  const hem = 25 + L;
  const sway = (y: number) => {
    const u = Math.max(0, (y - top) / (hem + 3 - top));
    return u * u * p.sway;
  };
  // The cloak behind him, showing either side, its hem in tatters.
  c.part();
  const cloakHem = 28.5 + L - k;
  for (let y = Math.round(top + 1); y <= Math.round(cloakHem); y++) {
    const u = (y - top) / (cloakHem - top);
    const hw = 6 + u * 1.6;
    for (let x = Math.round(cx - hw + sway(y)); x < Math.round(cx + hw + sway(y)); x++) {
      if (y > cloakHem - 2 && y > cloakHem - torn(x, 5)) continue;
      c.px(x, y, S.cloak, sphere(((x - cx) / hw) * 0.8, u * 0.5 - 0.1, 1), { bias: (x & 3) === 0 ? -1 : 0 });
    }
  }

  legs(c, L, cx, p);
  faulds(c, cx, waist, hem, sway, 5.6, 6.2);
  // The breastplate, rust at its edges.
  c.part();
  c.shape(Math.round(top), Math.round(waist), (y) => {
    const hw = chestWidth(y - top);
    return [cx - hw, cx + hw];
  }, S.plate, (_x, _y, t, u) => sphere(t * 0.9, u * 0.8 - 0.45, 1));
  weather(c, cx - 7, cx + 7, top, hem, 3);

  // The tabard: down the front from the chest, past the skirt, torn into two tails.
  const tTop = Math.round(15 + U);
  const tHem = Math.round(27.5 + L - k * 0.5);
  c.part();
  for (let y = tTop; y <= tHem; y++) {
    const hw = 2.4 + (y - tTop) * 0.05;
    const s = sway(y);
    for (let x = Math.round(cx - hw + s); x < Math.round(cx + hw + s); x++) {
      const mid = Math.abs(x + 0.5 - cx - s) < 0.7;
      if (mid && y >= tHem - 1) continue;
      if (y > tHem - torn(x, 9, 0.6)) continue;
      const t = (x + 0.5 - cx - s) / hw;
      c.px(x, y, S.tabard, sphere(t * 0.7, y < waist ? -0.2 : 0.15 + (mid ? 0.2 : 0), 1), { bias: Math.abs(t) > 0.75 ? -1 : 0 });
    }
  }
  // The barrow door stitched on its chest in faded linen.
  c.part();
  for (const [x, y] of [[cx - 1, 16], [cx, 16], [cx - 2, 17], [cx + 1, 17], [cx - 2, 18], [cx + 1, 18]] as const) c.px(x, Math.round(y + U), S.wrap, sphere(0, -0.1), { bias: -1 });
  // The belt and its iron buckle; burial strips hanging from it at his left hip.
  c.part();
  c.shape(Math.round(waist), Math.round(waist), () => [cx - 6, cx + 6], S.belt, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(cx - 1, Math.round(waist), S.band, sphere(-0.3, -0.3), { bias: 1 });
  c.px(cx, Math.round(waist), S.band, sphere(0.3, -0.3));
  c.part();
  c.capsule(cx - 4.3, waist + 0.8, cx - 4.6 + sway(waist + 5), waist + 5.4, 0.55, 0.5, S.wrap, { bias: -1 });
  c.capsule(cx - 3.2, waist + 0.8, cx - 3.0 + sway(waist + 4), waist + 3.8, 0.5, 0.45, S.wrap, { bias: -2 });

  // The gorget at his throat.
  c.part();
  c.shape(Math.round(12.4 + U), Math.round(14 + U), () => [cx - 3.6, cx + 3.6], S.plate, (_x, _y, t, u) => sphere(t * 0.8, u * 0.8 - 0.2, 1));

  const hx = cx + (p.head?.[0] ?? 0);
  const hy = U + (p.head?.[1] ?? 0);
  helmDown(c, hx, hy, p);
  pauldron(c, shA[0] - 0.4, shA[1] - 0.6, -1);
  pauldron(c, shB[0] + 0.4, shB[1] - 0.6, 1);
  moss(c, [[cx - 6, Math.round(22 + U)], [cx + 5, Math.round(24 + L)]]);
  // Hands gripping the haft above the helm still show over it.
  for (const [t, x, y] of [[p.ta, ax, ay], [p.tb, bx, by]] as const) {
    if (t === null || handsFront || y > 8) continue;
    c.part();
    c.ellipse(x, y, 1.45, 1.4, S.plate);
  }

  lamp(c, cx + 5.8 + p.lamp * 0.7, 21 + U, p);

  if (p.front) drawMaul(c, p, 0);
  if (!drewA) armA();
  if (!drewB) armB();
}

function drawUp(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const [ax, ay] = handAt(p, 'a');
  const [bx, by] = handAt(p, 'b');
  const armA = () => arm(c, cx - 5.4, 15.4 + U, ax, ay, [-0.8, 0.5], 0);
  const armB = () => arm(c, cx + 5.4, 15.4 + U, bx, by, [0.8, 0.5], 0);
  const handsFront = p.hands ? p.hands === 'front' : p.front;
  let drewA = false;
  let drewB = false;
  if (!p.front) drawMaul(c, p, -1);
  if (!handsFront) {
    if (p.ta !== null) (armA(), (drewA = true));
    if (p.tb !== null) (armB(), (drewB = true));
  }

  legs(c, L, cx, { ...p, footA: p.footB, footB: p.footA });

  const top = 13 + U;
  const waist = 20.5 + U;
  const hem = 25 + L;
  const sway = (y: number) => {
    const u = Math.max(0, (y - top) / (hem + 3 - top));
    return u * u * p.sway;
  };
  faulds(c, cx, waist, hem, sway, 5.6, 6.2);
  c.part();
  c.shape(Math.round(top), Math.round(waist), (y) => {
    const hw = chestWidth(y - top);
    return [cx - hw, cx + hw];
  }, S.plate, (_x, _y, t, u) => sphere(t * 0.9, u * 0.6 - 0.3, 1));
  // The cloak over his back from under the pauldrons to a torn hem, heavy folds down it.
  const cloakHem = 29 + L;
  c.part();
  for (let y = Math.round(top + 1); y <= Math.round(cloakHem); y++) {
    const u = (y - top) / (cloakHem - top);
    const hw = 4.6 + u * 2.4;
    for (let x = Math.round(cx - hw + sway(y)); x < Math.round(cx + hw + sway(y)); x++) {
      if (y > cloakHem - 3 && y > cloakHem - torn(x, 7, 0.7) * 1.5) continue;
      const t = (x + 0.5 - cx - sway(y)) / hw;
      c.px(x, y, S.cloak, sphere(t * 0.85, u * 0.5 - 0.35, 1));
    }
  }
  for (let y = Math.round(top + 4); y <= cloakHem; y++) {
    c.shade(Math.round(cx - 2.5 + sway(y)), y, -1);
    c.shade(Math.round(cx + 2 + sway(y)), y, -1);
    c.shade(Math.round(cx - 0.5 + sway(y)), y, 1);
  }
  // A rent in the cloak, plate showing through.
  c.part();
  for (const [x, y] of [[cx + 3, 22], [cx + 3, 23], [cx + 4, 24]] as const) c.px(x + Math.round(sway(y + U)), Math.round(y + U), S.plate, sphere(0.3, 0.2), { bias: -1 });
  c.part();
  c.shape(Math.round(waist), Math.round(waist), () => [cx - 6.2, cx - 4.4], S.belt, (_x, _y, t) => cyl(t, 0));
  c.shape(Math.round(waist), Math.round(waist), () => [cx + 4.4, cx + 6.2], S.belt, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.shape(Math.round(12.4 + U), Math.round(14 + U), () => [cx - 3.6, cx + 3.6], S.plate, (_x, _y, t, u) => sphere(t * 0.8, u * 0.8 - 0.3, 1));
  moss(c, [[cx - 4, Math.round(15 + U)], [cx + 2, Math.round(16 + U)], [cx - 1, Math.round(27 + L)]]);
  helmUp(c, cx + (p.head?.[0] ?? 0), U + (p.head?.[1] ?? 0), p);
  pauldron(c, cx - 5.8, 14.8 + U, -1);
  pauldron(c, cx + 5.8, 14.8 + U, 1);

  // His lamp on his left hip: screen left, from behind.
  lamp(c, cx - 6.8 + p.lamp * 0.7, 21 + U, p, -1);

  if (p.front) drawMaul(c, p, 0);
  if (!drewA) armA();
  if (!drewB) armB();
}

/** Facing left. Right-facing frames are mirrored from these. */
function drawSide(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const hx = cx - 0.4 - p.lean; // the upper body's centre
  const [ax, ay] = handAt(p, 'a');
  const [bx, by] = handAt(p, 'b');

  if (!p.front) drawMaul(c, p, -1);
  // The far arm, behind everything, its pauldron with it.
  pauldron(c, hx + 1.4, 14.4 + U, 1, -1);
  arm(c, hx + 1.4, 15.2 + U, ax, ay, [0.4, 1], -1);

  const top = 13.2 + U;
  const waist = 20.5 + U;
  const hem = 25 + L;
  // The cloak hanging off his back, swinging, its hem torn.
  const cloakHem = 28.5 + L;
  c.part();
  for (let y = Math.round(top + 1); y <= Math.round(cloakHem); y++) {
    const u = (y - top) / (cloakHem - top);
    const sx = hx + (cx - hx) * u;
    const x0 = Math.round(sx + 0.5);
    const x1 = Math.round(sx + 5 + u * (2.4 + p.sway * 1.2));
    for (let x = x0; x < x1; x++) {
      if (y > cloakHem - 2 && y > cloakHem - torn(x, 3, 0.7)) continue;
      c.px(x, y, S.cloak, sphere(((x - x0) / Math.max(1, x1 - x0)) * 0.9, u * 0.4 - 0.2, 1), { bias: x === x1 - 2 && y > top + 5 ? -1 : 0 });
    }
  }

  // Feet: the back one in shade first.
  const lift = (f: number) => Math.max(0, f) * 0.35;
  for (const [f, far] of [[p.footB, true], [p.footA, false]] as const) {
    const x = cx + (far ? 0.8 : -0.8) - f;
    c.part();
    c.capsule(cx + (far ? 0.9 : -0.6) - f * 0.4, 24.5 + L, x, 28.6 - lift(f), 1.7, 1.6, S.plate, { bias: far ? -2 : -1 });
    c.part();
    c.ellipse(x - 0.8, 30.3 - lift(f), 3.0, 1.4, S.plate, { flatten: 0.8, bias: far ? -2 : -1 });
    c.shade(x - 2, 29.3 - lift(f), 1);
  }

  // The body in profile: chest out before, back straight.
  const edges = (y: number): [number, number] => {
    const r = y - top;
    const u = Math.min(1, r / (hem - top));
    const sx = hx + (cx - hx) * u;
    const front = r < 1 ? 2.8 : r < 6 ? 4.2 : 3.8 + (r - 6) * 0.15;
    const back = r < 1 ? 2.8 : 3.8;
    return [sx - front, sx + back];
  };
  const sway = (y: number) => {
    const u = Math.max(0, (y - waist) / (hem + 3 - waist));
    return u * u * p.sway * 0.5;
  };
  c.part();
  c.shape(Math.round(hem + 1), Math.round(hem + 1), (y) => {
    const [a, b] = edges(hem);
    return [a + 0.2 + sway(y), b - 0.2 + sway(y)];
  }, S.mail, (x, y) => sphere(((x + y) & 1) * 0.4 - 0.2, 0.3, 1));
  c.part();
  c.shape(Math.round(waist), Math.round(hem), (y) => {
    const [a, b] = edges(y);
    return [a - 0.4 + sway(y), b + 0.2 + sway(y)];
  }, S.plate, (_x, y, t) => sphere(t * 0.9 - 0.1, (y - Math.round(waist)) % 2 === 0 ? -0.35 : 0.35, 1));
  c.part();
  c.shape(Math.round(top), Math.round(waist), edges, S.plate, (_x, _y, t, u) => sphere(t * 0.9 - 0.15, u * 0.8 - 0.45, 1));
  weather(c, cx - 8, cx + 8, top, hem + 1, 5);
  // The tabard down his front, hanging past the skirt and swinging.
  c.part();
  for (let y = Math.round(15 + U); y <= Math.round(27.5 + L); y++) {
    const x = Math.round(edges(Math.min(y, hem))[0] + (y > hem ? -0.6 : 0) + p.sway * (y > waist ? 0.4 : 0));
    if (y > 26 + L && torn(y, 4) > 0) continue;
    c.px(x, y, S.tabard, sphere(-0.6, 0.1));
    c.px(x + 1, y, S.tabard, sphere(-0.2, 0.1), { bias: -1 });
  }
  // The belt, the linen hanging from it at his back.
  c.part();
  c.shape(Math.round(waist), Math.round(waist), (y) => [edges(y)[0], edges(y)[1] - 0.2], S.belt, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.capsule(hx + 2.6, waist + 0.8, hx + 3.4 + p.sway * 0.6, waist + 5, 0.55, 0.5, S.wrap, { bias: -1 });
  // The gorget.
  c.part();
  c.shape(Math.round(12.4 + U), Math.round(14 + U), () => [hx - 3, hx + 2.8], S.plate, (_x, _y, t, u) => sphere(t * 0.8 - 0.1, u * 0.8 - 0.2, 1));

  // The head carried a little forward: he leans into his weight.
  helmSide(c, hx - 0.8, U, p);
  moss(c, [[Math.round(hx + 2), Math.round(17 + U)], [Math.round(hx + 3), Math.round(25 + L)]]);

  lamp(c, hx + 0.4 + p.lamp * 0.8, 21 + U, p);

  if (p.front) drawMaul(c, p, 0);
  arm(c, hx + 0.2, 15.6 + U, bx, by, [0.5, 1], 0);
  pauldron(c, hx + 0.2, 14.6 + U, -1);
}

// ---------------------------------------------------------------------------
// Animations

/** The maul planted foot-down at his side, a hand on its pommel, the other at his hip by the lamp. */
const base = (view: View): Pose => {
  const p: Pose = {
    lift: 0,
    breath: 0,
    footA: view === 'side' ? 1 : 0,
    footB: view === 'side' ? -1 : 0,
    lean: 0,
    sway: 0,
    g: [3.8, 13.6],
    d: 90,
    fore: 1,
    face: 0.85,
    front: true,
    ta: 0.6,
    tb: null,
    fa: [6.6, 21.6],
    fb: [17.6, 21.2],
    lamp: 0,
    flame: 0.7,
    tick: 0,
  };
  if (view === 'up') {
    p.g = [20.2, 13.6];
    p.ta = null;
    p.tb = 0.6;
    p.fa = [6.4, 21.2];
  } else if (view === 'side') {
    p.g = [4.6, 13.8];
    p.d = 96;
    p.face = 0.3;
    p.ta = null;
    p.tb = 0.6;
    p.fa = [13.6, 21.4];
  }
  return p;
};

/** One keyframe: what differs from the stand, per view (`all` for every view). */
type Key = { all?: Partial<Pose>; down?: Partial<Pose>; up?: Partial<Pose>; side?: Partial<Pose> };

function action(keys: Key[]) {
  return (view: View): Pose[] =>
    keys.map((k, i) => {
      const p: Pose = { ...base(view), ...k.all, ...k[view], tick: i };
      return p;
    });
}

/** Standing over his planted maul, the plate rising and falling, the eye-lights guttering, the lamp flickering. */
function idle(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = (f / N) * Math.PI * 2;
    const p = base(view);
    p.breath = Math.sin(ph) > 0.4 ? 1 : 0;
    p.lamp = Math.sin(ph) * 0.4;
    p.sway = Math.sin(ph - 1) * 0.5;
    const free = view === 'down' ? 'fb' : 'fa';
    p[free] = [p[free][0], p[free][1] + p.breath * 0.6];
    p.tick = f;
    p.eyes = f === 4 ? 0.65 : f === 5 ? 0.85 : 1;
    frames.push(p);
  }
  return frames;
}

/** A heavy, grinding march, the maul over his shoulder, the cloak dragging, the lamp swinging. */
function walk(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = ((f + 0.5) / N) * Math.PI * 2;
    const s = Math.sin(ph);
    const p = base(view);
    p.lift = Math.abs(s) < 0.6 ? 1 : 0;
    p.lamp = -s;
    p.tick = f;
    p.face = 0.55;
    if (view === 'side') {
      p.footA = Math.round(s * 2.4);
      p.footB = -p.footA;
      p.lean = 0.5;
      p.sway = 0.6 + Math.abs(s) * 0.8;
      p.g = [8, 19.2 - p.lift * 0.6];
      p.d = -38;
      p.face = 0.35;
      p.ta = null;
      p.tb = 0;
      p.fa = [11.6 + s * 2.2, 21 - p.lift * 0.6];
    } else if (view === 'down') {
      p.footA = s > 0.3 ? 1 : 0;
      p.footB = s < -0.3 ? 1 : 0;
      p.sway = s * 0.7;
      p.g = [8.2, 19.6 - p.lift * 0.6];
      p.d = -104;
      p.front = false;
      p.hands = 'front';
      p.ta = 0;
      p.tb = null;
      p.fb = [17.8, 20.6 + s * 1.2 - p.lift * 0.6];
    } else {
      p.footA = s > 0.3 ? 1 : 0;
      p.footB = s < -0.3 ? 1 : 0;
      p.sway = s * 0.7;
      p.g = [15.6, 19.6 - p.lift * 0.6];
      p.d = -76;
      p.fore = 0.8;
      p.front = true;
      p.hands = 'behind';
      p.ta = null;
      p.tb = 0;
      p.fa = [6.2, 20.6 - s * 1.2 - p.lift * 0.6];
    }
    frames.push(p);
  }
  return frames;
}

/** Two hands on the haft: the pommel end in one, the other lower down. */
const GRIP_A = { ta: 0, tb: 4.5 };
const GRIP_B = { ta: 4.5, tb: 0 };

/** The first blow: wound back to his right, then a flat, heavy sweep of the stone across in front of him. */
const swing1 = action([
  {
    down: { ...GRIP_B, g: [10, 19], d: 198, fore: 0.95, face: 0.6, breath: 1, head: [-1, 0] },
    up: { ...GRIP_A, g: [14, 19], d: -20, fore: 0.95, face: 0.6, breath: 1 },
    side: { ...GRIP_A, ta: 4.5, tb: 0, g: [13, 19], d: 15, face: 0.4, front: false, lean: -1, breath: 1 },
  },
  {
    down: { ...GRIP_B, g: [9.5, 17.5], d: 214, fore: 0.9, face: 0.7, head: [-1, 0], sway: -0.6 },
    up: { ...GRIP_A, g: [14.5, 17.5], d: -34, fore: 0.9, face: 0.7, sway: 0.6 },
    side: { ta: 4.5, tb: 0, g: [14, 17.5], d: -12, face: 0.5, front: false, lean: -1.5 },
  },
  {
    down: { ...GRIP_A, g: [10.5, 21], d: 78, fore: 0.75, face: 1, breath: 1, footA: 1, glint: 0.5 },
    up: { ...GRIP_A, g: [12, 17], d: -104, fore: 0.7, face: 1, front: false, breath: 1 },
    side: { ta: 4.5, tb: 0, g: [7.5, 20], d: 178, face: 0.5, lean: 1.5, footA: 2, glint: 0.6 },
  },
  {
    down: { ...GRIP_A, g: [14, 20.5], d: 14, fore: 0.95, face: 0.7, head: [1, 0], sway: 1 },
    up: { ...GRIP_B, g: [10, 20.5], d: 194, fore: 0.95, face: 0.7, sway: -1 },
    side: { ta: 4.5, tb: 0, g: [8.5, 21], d: 140, fore: 0.8, face: 0.8, lean: 1, footA: 2, sway: 1 },
  },
  {
    down: { ...GRIP_A, g: [12, 19], d: 60, fore: 0.85, face: 0.7, sway: 0.5 },
    up: { ...GRIP_B, g: [12, 19], d: 120, fore: 0.85, face: 0.7, sway: -0.5 },
    side: { ta: 4.5, tb: 0, g: [6.5, 16], d: 105, face: 0.35, lean: 0.5, sway: 0.5 },
  },
]);

/** The second: a low backhand that drags the stone through the earth and heaves it up, flinging clods. */
const swing2 = action([
  {
    down: { ...GRIP_A, g: [12.5, 19.5], d: 62, fore: 0.9, face: 1, breath: 1 },
    up: { ...GRIP_A, g: [11.5, 19], d: -62, fore: 0.7, face: 1, front: false, breath: 1 },
    side: { ta: 4.5, tb: 0, g: [10.5, 19.5], d: 150, face: 0.7, breath: 1, lean: 0.5 },
  },
  {
    down: { ...GRIP_A, g: [12.5, 20.5], d: 72, fore: 0.85, face: 1, breath: 1, dirt: 1 },
    up: { ...GRIP_A, g: [11.5, 20], d: -64, fore: 0.7, face: 1, front: false, breath: 1, dirt: 1 },
    side: { ta: 4.5, tb: 0, g: [11, 20.5], d: 160, face: 0.8, breath: 1, lean: 0.5, dirt: 1 },
  },
  {
    down: { ...GRIP_A, g: [10, 14.5], d: -128, fore: 0.95, face: 0.8, lift: 1, head: [-1, -1], glint: 0.7, dirt: 0.5, sway: -0.8 },
    up: { ...GRIP_A, g: [14, 14.5], d: -52, fore: 0.95, face: 0.8, front: false, lift: 1, sway: 0.8 },
    side: { ta: 4.5, tb: 0, g: [7.5, 14.5], d: -152, face: 0.6, lift: 1, lean: 1, glint: 0.6, dirt: 0.5 },
  },
  {
    down: { ...GRIP_A, g: [9.5, 13.5], d: -112, fore: 0.9, face: 0.7, lift: 1, sway: -0.4 },
    up: { ...GRIP_A, g: [14, 13], d: -70, fore: 0.9, face: 0.7, front: false, lift: 1, sway: 0.4 },
    side: { ta: 4.5, tb: 0, g: [8.5, 13], d: -118, face: 0.5, lift: 1, lean: 0.5 },
  },
  {
    down: { g: [5, 14.5], d: 96 },
    up: { g: [19.5, 14.5], d: 84 },
    side: { g: [5.2, 15], d: 100 },
  },
]);

/** The finisher: the gravestone hauled high overhead, then brought down on the ground with all his dead weight. */
const slam = action([
  {
    down: { ta: 0, tb: 2, g: [11.5, 9], d: -98, fore: 0.9, face: 0.5, front: false, hands: 'behind', breath: 1 },
    up: { ta: 0, tb: 2, g: [12.5, 12], d: -95, fore: 0.9, face: 0.5, hands: 'front', breath: 1 },
    side: { ta: 3, tb: 0, g: [12, 13], d: -70, face: 0.4, lean: -0.5, breath: 1 },
  },
  {
    down: { ta: 0, tb: 1.5, g: [12, 3], d: -90, fore: 0.85, face: 0.6, front: false, hands: 'behind', lift: 1 },
    up: { ta: 0, tb: 1.5, g: [12, 6.5], d: -90, fore: 0.85, face: 0.6, hands: 'front', lift: 1 },
    side: { ta: 3, tb: 0, g: [13, 7.5], d: -84, face: 0.4, lift: 1, lean: -1 },
  },
  {
    down: { ta: 0, tb: 1.5, g: [12, 2], d: -90, fore: 0.6, face: 0.8, front: false, hands: 'behind', lift: 1, head: [0, -1], eyes: 1.3 },
    up: { ta: 0, tb: 1.5, g: [12, 5.5], d: -88, fore: 0.95, face: 0.8, hands: 'front', lift: 1 },
    side: { ta: 3, tb: 0, g: [14, 7], d: -60, face: 0.5, lift: 1, lean: -1.5, eyes: 1.3 },
  },
  {
    down: { ta: 0, tb: 4, g: [12, 21.5], d: 90, fore: 0.6, face: 1, breath: 2, footA: 1, glint: 0.9, eyes: 1.6, sway: 0.6 },
    up: { ta: 0, tb: 4, g: [12, 16], d: -96, fore: 0.5, face: 1, front: false, hands: 'behind', breath: 2, sway: 0.6 },
    side: { ta: 3, tb: 0, g: [7, 20.5], d: 149, face: 0.5, lean: 2, breath: 2, footA: 2, glint: 0.9, eyes: 1.6, sway: 1 },
  },
  {
    down: { ta: 0, tb: 4, g: [12, 21.5], d: 90, fore: 0.6, face: 1, breath: 1, footA: 1, eyes: 1.2, sway: -0.3 },
    up: { ta: 0, tb: 4, g: [12, 16], d: -96, fore: 0.5, face: 1, front: false, hands: 'behind', breath: 1, sway: -0.3 },
    side: { ta: 3, tb: 0, g: [7, 20.5], d: 149, face: 0.5, lean: 2, breath: 1, footA: 2, eyes: 1.2, sway: -0.3 },
  },
  {
    down: { ta: 0, tb: 4, g: [11, 18.5], d: 96, fore: 0.75, face: 0.9 },
    up: { ta: 0, tb: 4, g: [12.5, 17], d: -100, fore: 0.6, face: 0.9, front: false, hands: 'behind' },
    side: { ta: 3, tb: 0, g: [8.5, 18], d: 122, face: 0.4, lean: 1 },
  },
  {
    down: { g: [5, 14], d: 92 },
    up: { g: [19.5, 14], d: 88 },
    side: { g: [5.2, 14], d: 98 },
  },
]);

/**
 * Open grave: he hauls the maul up by its haft, drives the gravestone foot-
 * first into the earth, sets his boot to it, and wrenches the haft back to
 * heave the ground open.
 */
const dig = action([
  {
    down: { ta: 0, tb: 3.5, g: [11.5, 13], d: 90, face: 0.9, lift: 1 },
    up: { ta: 0, tb: 3.5, g: [12, 13], d: -90, fore: 0.5, front: false, hands: 'behind', lift: 1 },
    side: { ta: 3.5, tb: 0, g: [7, 11], d: 98, lift: 1 },
  },
  {
    down: { ta: 0, tb: 3.5, g: [11.5, 10], d: 90, face: 0.9, lift: 2, head: [0, -1], eyes: 1.2 },
    up: { ta: 0, tb: 3.5, g: [12, 10], d: -90, fore: 0.6, front: false, hands: 'behind', lift: 2 },
    side: { ta: 3.5, tb: 0, g: [7, 8.5], d: 98, lift: 2, lean: 0.5, eyes: 1.2 },
  },
  {
    down: { ta: 0, tb: 3.5, g: [11.5, 16.5], d: 90, face: 0.9, sink: 31.5, breath: 1, eyes: 1.5 },
    up: { ta: 0, tb: 3.5, g: [12, 15], d: -90, fore: 0.3, front: false, hands: 'behind', breath: 1 },
    side: { ta: 3.5, tb: 0, g: [6.5, 16], d: 100, sink: 31, breath: 1, lean: 1, eyes: 1.5 },
  },
  {
    down: { ta: 0, tb: 3.5, g: [11.5, 16.5], d: 90, face: 0.9, sink: 31.5, breath: 1, footB: 2, eyes: 1.2 },
    up: { ta: 0, tb: 3.5, g: [12, 15], d: -90, fore: 0.3, front: false, hands: 'behind', breath: 1, footA: 2 },
    side: { ta: 3.5, tb: 0, g: [6.5, 16], d: 100, sink: 31, breath: 1, lean: 1, footA: 3, eyes: 1.2 },
  },
  {
    down: { ta: 0, tb: 3.5, g: [11.5, 19], d: 78, fore: 0.8, face: 0.9, sink: 31.5 },
    up: { ta: 0, tb: 3.5, g: [12, 14], d: -78, fore: 0.55, front: false, hands: 'behind' },
    side: { ta: 3.5, tb: 0, g: [9.5, 18], d: 118, sink: 31, lean: -0.5 },
  },
  {
    down: { ta: 0, tb: 3.5, g: [11.5, 21.5], d: 64, fore: 0.6, face: 1, dirt: 1, lift: 1, head: [0, -1], eyes: 1.6 },
    up: { ta: 0, tb: 3.5, g: [12, 12], d: -70, fore: 0.8, face: 1, front: false, hands: 'behind', dirt: 1, lift: 1 },
    side: { ta: 3.5, tb: 0, g: [11, 17], d: 140, face: 0.6, dirt: 1, lean: -1, lift: 1, eyes: 1.6 },
  },
  {
    down: { ta: 0, tb: 3.5, g: [10, 18], d: 80, fore: 0.85, face: 1, dirt: 0.5, eyes: 1.2 },
    up: { ta: 0, tb: 3.5, g: [13, 13], d: -80, fore: 0.6, front: false, hands: 'behind', dirt: 0.5 },
    side: { ta: 3.5, tb: 0, g: [9, 15], d: 120, face: 0.5, dirt: 0.5, eyes: 1.2 },
  },
  {
    down: { g: [4.4, 14], d: 90 },
    up: { g: [19.6, 14], d: 90 },
    side: { g: [5, 13.8], d: 98 },
  },
]);

/** One beat of the idle moment: what differs from the plain stand. */
type RestKey = Partial<Pose>;

/** The maul planted before him, foot down, both gauntlets stacked on its pommel. */
const PLANT: RestKey = { g: [12, 13.4], d: 90, fore: 1, face: 1, ta: 0.4, tb: 1.6, front: true };
/** The same, down on one knee: the shoulders lower, the haft tipped toward him. */
const KNEEL: RestKey = { ...PLANT, g: [12, 16.6], fore: 0.8, kneel: 1 };

/**
 * His idle moment: he lifts the maul across, plants it before him, sinks to
 * one knee with his gauntlets on its pommel and bows his head, the eye-
 * lights dimming to nothing; a moment's stillness, then they flare up
 * again, his head comes up, and he rises.
 */
const REST_KEYS: RestKey[] = [
  {},
  // The maul lifted across in front of him...
  { g: [8.5, 11.5], d: 90, ta: 0.6, tb: 3, face: 0.9, lift: 1 },
  // ...and set down with a thump.
  { ...PLANT, breath: 1 },
  // Down on one knee.
  { ...PLANT, g: [12, 14.6], fore: 0.93, kneel: 0.5, breath: 1 },
  { ...KNEEL, head: [0, 1] },
  // The head bowed, the lights going out.
  { ...KNEEL, head: [0, 2], eyes: 0.7 },
  { ...KNEEL, head: [0, 2], eyes: 0.4, breath: 1 },
  { ...KNEEL, head: [0, 2], eyes: 0.15, breath: 1 },
  { ...KNEEL, head: [0, 2], eyes: 0, breath: 1, flame: 0.4 },
  // They flare.
  { ...KNEEL, head: [0, 1], eyes: 1.8, flame: 1 },
  { ...KNEEL, head: [0, 0], eyes: 1.4, flame: 0.9 },
  // He rises.
  { ...PLANT, g: [12, 14.6], fore: 0.93, kneel: 0.5, eyes: 1.1 },
  { ...PLANT, lift: 1 },
  { g: [8.5, 11.5], d: 90, ta: 0.6, tb: 3, face: 0.9 },
  {},
];

/** Slots of the idle moment in playing order, holds and repeats included (8 fps). */
const REST_ORDER = [0, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 8, 8, 8, 9, 10, 10, 10, 11, 12, 13, 14];

/** The idle moment, facing the viewer only; it starts and ends on the idle's first frame. */
function rest(view: View): Pose[] {
  if (view !== 'down') return [];
  return REST_KEYS.map((k, i) => {
    const p = idle('down')[0];
    const edge = i === 0 || i === REST_KEYS.length - 1;
    Object.assign(p, k);
    p.tick = edge ? 0 : i;
    return p;
  });
}

// ---------------------------------------------------------------------------
// Frame generation

export type BarrowAnim = 'idle' | 'walk' | 'swing1' | 'swing2' | 'slam' | 'dig' | 'rest';

export interface BarrowAnimDef {
  name: BarrowAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => Pose[];
  order?: readonly number[];
}

export const BARROW_ANIMS: BarrowAnimDef[] = [
  { name: 'idle', fps: 6, loop: true, poses: idle },
  { name: 'walk', fps: 8, loop: true, poses: walk },
  { name: 'swing1', fps: 15, loop: false, poses: swing1 },
  { name: 'swing2', fps: 15, loop: false, poses: swing2 },
  { name: 'slam', fps: 14, loop: false, poses: slam },
  { name: 'dig', fps: 11, loop: false, poses: dig },
  { name: 'rest', fps: 8, loop: false, poses: rest, order: REST_ORDER },
];

/** Frame index at which each move lands. */
export const BARROW_HIT_FRAME = { swing1: 2, swing2: 2, slam: 3, dig: 5 } as const;

/** The soul-lamp's place on him, from his feet, per facing (for its light in the world). */
export const LAMP_AT: Record<Dir, { x: number; y: number }> = {
  down: { x: 5.8, y: -8 },
  up: { x: -6.8, y: -8 },
  left: { x: 0, y: -8 },
  right: { x: 0, y: -8 },
};

export interface BarrowFrame {
  key: string;
  anim: BarrowAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawBarrowFrame(dir: Dir, pose: Pose): PixelCanvas {
  const c = new PixelCanvas(BARROW_W, BARROW_H).offset(BODY_X, BODY_Y);
  if (dir === 'down') drawDown(c, pose);
  else if (dir === 'up') drawUp(c, pose);
  else drawSide(c, pose);
  return dir === 'right' ? c.mirrored() : c;
}

export function buildBarrowFrames(look: BarrowLook = BARROW_LOOK): BarrowFrame[] {
  S = look;
  const out: BarrowFrame[] = [];
  for (const a of BARROW_ANIMS) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, index) => {
        out.push({ key: `${a.name}_${dir}_${index}`, anim: a.name, dir, canvas: drawBarrowFrame(dir, pose) });
      });
    }
  }
  S = BARROW_LOOK;
  return out;
}

// ---------------------------------------------------------------------------
// Ability icons (16x16)

/** Colours an icon is painted in: the gravestone and its iron, the haft, the earth, the glow, and the outline. */
export interface BarrowIcon {
  stone: [string, string, string];
  iron: [string, string, string];
  haft: [string, string];
  earth: [string, string, string];
  glow: [string, string, string];
  /** Bone (or root) for the arm out of the grave. */
  bone: [string, string, string];
  outline: string;
  /** Mossgrave's: roots wound round the haft, moss on the stone and the earth. */
  moss?: string;
}

export const BARROW_ICON: BarrowIcon = {
  stone: ['#c4c8c2', '#848a88', '#4c5254'],
  iron: ['#b8c0c6', '#5c646c', '#2a2e34'],
  haft: ['#7a5a3a', '#4a3220'],
  earth: ['#7a5a3a', '#5a3e26', '#3a2818'],
  glow: ['#f4ffe0', '#c8ff8a', '#7ad040'],
  bone: ['#f8f2da', '#d4cbaa', '#9a9278'],
  outline: '#0c0c0e',
};

export const MOSSGRAVE_ICON: BarrowIcon = {
  stone: ['#a8b294', '#6c765c', '#3e4636'],
  iron: ['#8ab89a', '#4a7a5c', '#22382c'],
  haft: ['#6e5232', '#3e2a18'],
  earth: ['#4e6a2c', '#344c1c', '#1e2e10'],
  glow: ['#ecfffc', '#9ff8ee', '#3ad0c8'],
  bone: ['#7a5a36', '#5a4026', '#3a2814'],
  outline: '#0a0c06',
  moss: '#6a9a34',
};

/** The grave maul brought down: the gravestone on its haft, foot-first, the ground lighting up where it lands. */
export function maulIcon(k: BarrowIcon = BARROW_ICON): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  // The haft straight up from the stone's arch, an iron pommel on top.
  for (let y = 1; y <= 5; y++) {
    put(7, y, k.haft[0]);
    put(8, y, k.haft[1]);
  }
  put(7, 0, k.iron[0]);
  put(8, 0, k.iron[1]);
  if (k.moss) for (const [x, y] of [[7, 2], [8, 4]]) put(x, y, k.moss);
  // The stone: an arch at the top, square below, lit from the left.
  const rows = ['.ssssss.', 'ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'iiiiiiii', 'ssssssss'];
  rows.forEach((row, r) => {
    for (let c = 0; c < 8; c++) {
      if (row[c] === '.') continue;
      const x = 4 + c;
      const y = 6 + r;
      if (row[c] === 'i') put(x, y, c < 2 ? k.iron[0] : c < 6 ? k.iron[1] : k.iron[2]);
      else put(x, y, c === 0 || (r === 0 && c < 4) ? k.stone[0] : c >= 6 ? k.stone[2] : k.stone[1]);
    }
  });
  // The iron collar the haft is socketed in, and the cross cut in the face.
  put(7, 6, k.iron[0]);
  put(8, 6, k.iron[1]);
  for (let y = 8; y <= 11; y++) put(7, y, k.stone[2]);
  for (let y = 8; y <= 11; y++) put(8, y, k.stone[2]);
  for (const x of [6, 9]) put(x, 9, k.stone[2]);
  if (k.moss) for (const [x, y] of [[4, 7], [5, 6], [10, 14], [11, 13], [10, 6]]) put(x, y, k.moss);
  outline(k.outline);
  // The rush of the blow either side, and the corpse-light bursting from the ground under it.
  for (const [x, y] of [[2, 2], [2, 3], [2, 4], [13, 2], [13, 3], [13, 4]]) put(x, y, y === 2 ? k.glow[1] : k.glow[2]);
  for (const [x, y, c] of [[2, 15, 1], [3, 15, 0], [12, 15, 0], [13, 15, 1], [1, 14, 2], [14, 14, 2], [0, 12, 2], [15, 12, 2]] as const) put(x, y, k.glow[c]);
  for (const [x, y, c] of [[0, 15, 1], [15, 15, 2]] as const) put(x, y, k.earth[c]);
  return px;
}

/** Open grave: the ground split, an arm clawing out of it, the corpse-light rising from the crack. */
export function graveIcon(k: BarrowIcon = BARROW_ICON): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  // The turned earth, and the crack across it glowing.
  for (let y = 10; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const q = Math.hypot((x + 0.5 - 8) / 7.8, (y + 0.5 - 14.5) / 4.6);
      if (q > 1) continue;
      put(x, y, y < 12 ? k.earth[0] : q < 0.55 ? k.earth[1] : k.earth[2]);
    }
  }
  for (const [x, y] of [[2, 13], [3, 13], [4, 12], [5, 12], [6, 13], [10, 13], [11, 12], [12, 12], [13, 13]]) put(x, y, k.glow[2]);
  for (const [x, y] of [[7, 12], [8, 12], [9, 12]]) put(x, y, k.glow[1]);
  if (k.moss) for (const [x, y] of [[1, 12], [14, 12], [3, 11], [12, 11]]) put(x, y, k.moss);
  // The arm: a forearm up out of the crack, the hand clawed open.
  for (let y = 6; y <= 11; y++) {
    put(7, y, k.bone[1]);
    put(8, y, k.bone[0]);
  }
  put(9, 9, k.bone[2]);
  for (const [x0, len, lean] of [[5, 2, -1], [6, 3, 0], [8, 3, 0], [10, 2, 1]] as const) {
    for (let i = 1; i <= len; i++) put(x0 + (i === len ? lean : 0), 6 - i, i === len ? k.bone[1] : k.bone[0]);
  }
  for (const [x, y] of [[6, 6], [7, 6], [8, 6], [9, 6], [10, 6]]) put(x, y, k.bone[0]);
  put(5, 7, k.bone[1]);
  outline(k.outline);
  // The light rising round it.
  for (const [x, y, c] of [[2, 8, 2], [3, 6, 1], [13, 8, 2], [12, 5, 1], [13, 3, 2], [4, 3, 2]] as const) put(x, y, k.glow[c]);
  return px;
}
