// The BarrowKnight: the necromancers' sexton, drawn from his own rig.
//
// A burly old man, hunched from a life bent over a spade: a battered,
// wide-brimmed felt hat pulled low (a dent in the crown, a notch in the
// brim, its left side drooping), grey whiskers and a bulbous nose under it,
// two eyes that catch the lantern's light from the brim's shadow. A long
// grave-mud wool coat, patched at the shoulder and the hem, hangs open over
// a leather apron; an oxblood muffler is knotted at his throat, work gloves
// on his hands, heavy boots on his feet. From his belt hangs a small brass
// lantern burning a sickly green, and in his hands is a big iron spade, its
// worn edge bright, earth still on its face.
//
// Mossgrave is his skin: a bog-barrow the marsh has half taken back. Moss
// grows thick on his shoulders and hat brim, lichen spots his coat, two
// tiny mushrooms sprout from the brim, roots wind round the spade's haft
// up to a verdigris blade, and the lantern is a cage of twisted root with
// a will-o'-wisp burning blue-green inside it.
//
// The body keeps to the 24x32 box; frames are larger so the spade can be
// raised overhead and swung out to either side. Like the necromancer's rig,
// the left-facing frames are drawn and the right-facing ones mirrored.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB } from './pixel';
import { iconPainter } from './effects';
import { DIRS, type Dir } from './wizard';

export const BARROW_W = 60;
export const BARROW_H = 56;
const BODY_X = 18;
const BODY_Y = 16;
/** Sprite origin in the frame: body centre, just under the feet. */
export const BARROW_ORIGIN_X = BODY_X + 12;
export const BARROW_ORIGIN_Y = BODY_Y + 31;

const ramp = (...c: string[]): RGB[] => c.map(hex);

/** The moss on Mossgrave: clumps, lichen, the mushrooms on his brim and the roots round his spade. */
export interface Overgrowth {
  moss: Material;
  lichen: Material;
  cap: Material;
  stem: Material;
  root: Material;
}

/** One look for the gravebarrow: his cloth, his face, his spade and his lantern. */
export interface BarrowLook {
  key: string;
  coat: Material;
  /** Two patches sewn on the coat. */
  patch: Material;
  patch2: Material;
  apron: Material;
  scarf: Material;
  hat: Material;
  band: Material;
  belt: Material;
  skin: Material;
  beard: Material;
  eyes: Material;
  trousers: Material;
  boots: Material;
  glove: Material;
  /** The spade's blade, its haft and the earth on it. */
  iron: Material;
  haft: Material;
  dirt: Material;
  /** The lantern's frame and its glass. */
  brass: Material;
  glass: Material;
  flask: Material;
  /** The lantern's light, brightest first. */
  light: [RGB, RGB, RGB, RGB];
  overgrowth?: Overgrowth;
}

// ---------------------------------------------------------------------------
// Looks

/** The lantern's sickly green, brightest first. */
export const LANTERN_CORE = hex('#f4ffe0');
export const LANTERN_HOT = hex('#d0ff8a');
export const LANTERN_MID = hex('#8ad84a');
export const LANTERN_DEEP = hex('#2e6a2a');
/** The will-o'-wisp's blue-green. */
export const WISP_CORE = hex('#ecfffc');
export const WISP_HOT = hex('#9ff8ee');
export const WISP_MID = hex('#3ad0c8');
export const WISP_DEEP = hex('#0e5a68');

export const BARROW_LOOK: BarrowLook = {
  key: 'necro_barrow',
  coat: { ramp: ramp('#1a1c16', '#2b2f24', '#40452f', '#575e40', '#6f7652'), outline: hex('#0a0b08'), outlineLit: hex('#14160f') },
  patch: { ramp: ramp('#2a1c1e', '#44302e', '#5e4440', '#785a50'), outline: hex('#0e0808') },
  patch2: { ramp: ramp('#30280f', '#4c401c', '#6a5a2c', '#86743e'), outline: hex('#100c04') },
  apron: { ramp: ramp('#22140c', '#3e2616', '#5e3c22', '#7c5432', '#986a40'), outline: hex('#100804') },
  scarf: { ramp: ramp('#240c0c', '#421814', '#64261e', '#80382a'), outline: hex('#0e0404') },
  hat: { ramp: ramp('#100c0c', '#1e1816', '#2e2522', '#41342e', '#55443a'), outline: hex('#060404'), outlineLit: hex('#0e0a08') },
  band: { ramp: ramp('#2a1c12', '#46301e', '#62452c'), outline: hex('#0e0804') },
  belt: { ramp: ramp('#1a100a', '#2e1e14', '#46301e'), outline: hex('#0a0604') },
  skin: { ramp: ramp('#3a2420', '#6a4232', '#966450', '#bc8868', '#d8a886'), outline: hex('#1a0e0a'), outlineLit: hex('#2a1810') },
  beard: { ramp: ramp('#3a3834', '#5e5a52', '#868076', '#aca598', '#cec8ba'), outline: hex('#141210') },
  eyes: { ramp: ramp('#0c0806', '#1a1210'), outline: hex('#0c0806'), noAO: true },
  trousers: { ramp: ramp('#18181c', '#26262c', '#36363e', '#46464f'), outline: hex('#08080a') },
  boots: { ramp: ramp('#120c0a', '#22170f', '#352418', '#4a3422', '#5e4430'), outline: hex('#060403') },
  glove: { ramp: ramp('#32200f', '#52361c', '#76522c', '#96703e'), outline: hex('#120a04') },
  iron: { ramp: ramp('#1c1e22', '#363a40', '#585d64', '#80868c', '#aeb4b8'), outline: hex('#08090b'), outlineLit: hex('#14161a'), shine: true },
  haft: { ramp: ramp('#2a1a10', '#46301e', '#644830', '#82643e'), outline: hex('#100804') },
  dirt: { ramp: ramp('#22160e', '#3a281a', '#563c26', '#6e5034'), outline: hex('#0e0805') },
  brass: { ramp: ramp('#2a1e0a', '#4e3a16', '#7a5e26', '#a8863a', '#d4b25a'), outline: hex('#100a02'), shine: true },
  glass: { ramp: ramp('#4a8a22', '#86c840', '#c0f07a', '#ecffc0'), outline: hex('#14200a'), emissive: 0.85, noAO: true },
  flask: { ramp: ramp('#26282c', '#43474c', '#666b72', '#90969c', '#c0c6cc'), outline: hex('#0a0b0c'), shine: true },
  light: [LANTERN_CORE, LANTERN_HOT, LANTERN_MID, LANTERN_DEEP],
};

/** Mossgrave: moss, lichen and root over peat-dark cloth, a verdigris blade and a wisp in a cage of root. */
export const MOSSGRAVE_LOOK: BarrowLook = {
  key: 'necro_mossgrave',
  coat: { ramp: ramp('#121a0e', '#1e2c16', '#2e4220', '#405a2a', '#527034'), outline: hex('#060a04'), outlineLit: hex('#0c1208') },
  patch: { ramp: ramp('#1e2a14', '#2e4220', '#46622c', '#5e823a'), outline: hex('#080c04') },
  patch2: { ramp: ramp('#1e2a14', '#2e4220', '#46622c', '#5e823a'), outline: hex('#080c04') },
  apron: { ramp: ramp('#1a120a', '#2e2012', '#46301c', '#5e4226', '#745232'), outline: hex('#0a0604') },
  scarf: { ramp: ramp('#1e2410', '#34401a', '#4e5c26', '#687834'), outline: hex('#080a04') },
  hat: { ramp: ramp('#0e0c08', '#1a1610', '#28221a', '#3a3024', '#4c3e2e'), outline: hex('#050403'), outlineLit: hex('#0c0a06') },
  band: { ramp: ramp('#1e2a14', '#33461f', '#4e6630'), outline: hex('#080c04') },
  belt: { ramp: ramp('#160e08', '#281a10', '#3e2a18'), outline: hex('#080503') },
  skin: { ramp: ramp('#33221e', '#5e3e30', '#8a604c', '#b08466', '#cca282'), outline: hex('#160c08'), outlineLit: hex('#26160e') },
  beard: { ramp: ramp('#2c3226', '#4a5442', '#6e7a64', '#94a088', '#b8c4aa'), outline: hex('#0e120c') },
  eyes: { ramp: ramp('#06100e', '#0e1c1a'), outline: hex('#06100e'), noAO: true },
  trousers: { ramp: ramp('#14140e', '#222218', '#323224', '#424230'), outline: hex('#070705') },
  boots: { ramp: ramp('#100c08', '#1e160e', '#302216', '#443020', '#56402c'), outline: hex('#050302') },
  glove: { ramp: ramp('#281a0e', '#442e18', '#644826', '#806036'), outline: hex('#0e0804') },
  iron: { ramp: ramp('#14201c', '#24382e', '#3a5a48', '#5a8468', '#88b494'), outline: hex('#050a08'), outlineLit: hex('#0c1410'), shine: true },
  haft: { ramp: ramp('#20140c', '#382618', '#523a24', '#6e5232'), outline: hex('#0c0603') },
  dirt: { ramp: ramp('#141e0e', '#243418', '#365022', '#4a6a2c'), outline: hex('#060a04') },
  brass: { ramp: ramp('#1e140a', '#36261a', '#523a26', '#6e5232', '#8a6a42'), outline: hex('#0a0604') },
  glass: { ramp: ramp('#147a7a', '#3ab8b4', '#86ece4', '#dcfffa'), outline: hex('#041a1c'), emissive: 0.9, noAO: true },
  flask: { ramp: ramp('#1a2018', '#2e3a2a', '#465a40', '#62805a', '#86a87c'), outline: hex('#060a06'), shine: true },
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
  /** The coat's hem swinging, px. */
  sway: number;
  /**
   * The spade: its grip end in body coordinates, the way from there to the
   * blade in screen degrees (0 right, 90 down), how much of its length shows
   * (pointing at or away from the viewer shortens it) and how much of the
   * blade's face (0 edge on, 1 full face).
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
  /** The hands on the haft drawn over the body or behind it, whichever layer the spade is on. */
  hands?: 'front' | 'behind';
  /** The lantern's swing, -1..1, and its flame, 0..1. */
  lantern: number;
  flame: number;
  /** Frame counter, for the flame's flicker. */
  tick: number;
  blink?: boolean;
  /** The head shifted (x, y), px: a nod, a peer, a swig (front view). */
  head?: [number, number];
  /** Where the eyes look: -1 left, 0 ahead, 1 right (front view). */
  look?: number;
  /** Earth heaped on the blade, 0..1. */
  dirt?: number;
  /** Below this row (body coordinates) the blade is in the ground. */
  sink?: number;
  /** A glint running down the blade, 0..1 along it. */
  glint?: number;
  /** The idle moment: the lantern off the belt and held up in hand b; a hip flask in hand b, tipped 0..1. */
  carry?: boolean;
  flask?: number;
}

/** The haft and the blade, in px at full length. */
const HAFT = 12.5;
const BLADE = 6.6;

const rad = (deg: number): number => (deg * Math.PI) / 180;

/** Where a hand is: on the haft, or free. */
function handAt(p: Pose, arm: 'a' | 'b'): [number, number] {
  const t = arm === 'a' ? p.ta : p.tb;
  if (t === null) return arm === 'a' ? p.fa : p.fb;
  const a = rad(p.d);
  return [p.g[0] + Math.cos(a) * t * p.fore, p.g[1] + Math.sin(a) * t * p.fore];
}

// ---------------------------------------------------------------------------
// The spade

/**
 * The spade: a T-grip and a long ash haft (roots wound round it on
 * Mossgrave), an iron socket and the blade, its worn edge bright, earth
 * caked on its face. Below `sink` the blade is in the ground.
 */
function drawSpade(c: PixelCanvas, p: Pose, bias: number): void {
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
  // The T of the grip, then the haft from it down to the socket.
  c.part();
  c.capsule(gx - nx * 1.7, gy - ny * 1.7, gx + nx * 1.7, gy + ny * 1.7, 0.6, 0.6, S.haft, { bias });
  c.part();
  c.capsule(gx, gy, sx, sy, 0.7, 0.75, S.haft, { bias });
  const og = S.overgrowth;
  if (og) {
    // Roots wound round the haft, a leaf or two by the grip.
    c.part();
    const n = Math.max(2, Math.round(HAFT * f));
    for (let i = 2; i <= n; i++) {
      const s = ((i & 1) * 2 - 1) * 0.9;
      c.px(gx + ux * i + nx * s, gy + uy * i + ny * s, og.root, sphere(s * 0.6, -0.2), { bias });
    }
    c.part();
    c.px(gx + ux * 2.4 - nx * 1.6, gy + uy * 2.4 - ny * 1.6, og.moss, sphere(-0.4, -0.5), { bias });
    c.px(gx + ux * 3.2 - nx * 2.2, gy + uy * 3.2 - ny * 2.2, og.moss, sphere(-0.6, -0.3), { bias });
  }
  // The blade: shoulders out from the socket, straight sides, a rounded point.
  const L = BLADE * Math.max(0.45, f);
  const W = 2.3 * (0.3 + 0.7 * p.face);
  const width = (u: number): number => {
    if (u < 0.9) return W * (0.55 + 0.45 * (u / 0.9));
    if (u < L * 0.62) return W;
    const k = (u - L * 0.62) / (L * 0.38);
    return W * Math.sqrt(Math.max(0, 1 - k * k)) + 0.25;
  };
  c.part();
  const R = L + W + 1;
  for (let y = Math.floor(sy - R); y <= Math.ceil(sy + R); y++) {
    if (y + 0.5 > sink) continue;
    for (let x = Math.floor(sx - R); x <= Math.ceil(sx + R); x++) {
      const dx = x + 0.5 - sx;
      const dy = y + 0.5 - sy;
      const u = dx * ux + dy * uy;
      const v = dx * nx + dy * ny;
      if (u < 0 || u > L) continue;
      const w = width(u);
      if (Math.abs(v) > w) continue;
      const t = v / Math.max(0.5, w);
      // The face dishes a little; the last pixel of the point is worn bright.
      const edge = u > L - 1.3 ? 1 : 0;
      const rust = edge === 0 && hash(Math.round(u * 3), Math.round(v * 3) + 7) > 0.86 ? -1 : 0;
      c.px(x, y, S.iron, sphere(t * (0.35 + 0.4 * (1 - p.face)), u / L * 0.35 - 0.35, 1), { bias: bias + edge + rust });
    }
  }
  // The socket's collar.
  c.part();
  c.ellipse(sx, sy, 0.9, 0.9, S.iron, { bias: bias - 1 });
  if (p.dirt && p.dirt > 0) {
    // Earth heaped on the face, a clod or two over the rim.
    const k = p.dirt;
    const mx = sx + ux * L * 0.58;
    const my = sy + uy * L * 0.58 - 0.4;
    c.part();
    c.ellipse(mx, my, W * 0.9 * k + 0.5, 1.1 + k * 0.6, S.dirt, { bias });
    if (k > 0.6) {
      c.px(mx - nx * W, my - ny * W - 1, S.dirt, sphere(-0.3, -0.6), { bias });
      c.px(mx + nx * (W - 0.5), my + ny * (W - 0.5) - 1.2, S.dirt, sphere(0.3, -0.6), { bias });
    }
    if (og) c.px(mx, my - 1, og.moss, sphere(0, -0.7), { bias });
  }
  if (p.glint !== undefined) {
    const u = L * p.glint;
    c.spark(sx + ux * u, sy + uy * u, LANTERN_CORE, 0.8);
    c.spark(sx + ux * u + nx, sy + uy * u + ny, S.light[1], 0.35);
  }
  if (sink < Infinity) {
    // Turned earth where it bites into the ground.
    const t = (sink - sy) / (Math.abs(uy) > 0.2 ? uy : 1);
    const ex = sx + ux * Math.max(0, Math.min(L, t));
    c.part();
    c.ellipse(ex, sink - 0.2, 2.6, 0.9, S.dirt, { bias: bias - 1 });
  }
}

// ---------------------------------------------------------------------------
// Parts

const REACH = 5.6;

/**
 * A heavy coat sleeve from the shoulder to a gloved hand, bent at the elbow
 * towards `hint`, a darker cuff at the wrist.
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
  const wx = ex + (fx - ex) * 0.72;
  const wy = ey + (fy - ey) * 0.72;
  c.part();
  c.capsule(sx, sy, ex, ey, 1.9, 1.7, S.coat, { bias });
  c.part();
  c.capsule(ex, ey, wx, wy, 1.7, 1.55, S.coat, { bias });
  c.part();
  c.ellipse(wx, wy, 1.45, 1.45, S.coat, { bias: bias - 1 });
  c.part();
  c.ellipse(fx, fy, 1.35, 1.3, S.glove, { bias });
}

/**
 * The lantern hung from its ring at (x, y): a brass cap, the glass with the
 * flame in it between two bars, a brass foot. Mossgrave's is a cage of
 * root, a wisp of blue-green light inside, moss on its cap.
 */
function lantern(c: PixelCanvas, x: number, y: number, p: Pose, bias = 0): void {
  const lx = Math.round(x);
  const ly = Math.round(y);
  const [core, hot, mid] = S.light;
  c.part();
  c.px(lx, ly, S.brass, sphere(0, -0.6), { bias });
  c.part();
  for (let i = -1; i <= 2; i++) c.px(lx + i, ly + 1, S.brass, sphere(i * 0.4 - 0.2, -0.6), { bias });
  c.part();
  for (let r = 2; r <= 4; r++) {
    c.px(lx - 1, ly + r, S.brass, sphere(-0.7, 0), { bias });
    c.px(lx + 2, ly + r, S.brass, sphere(0.7, 0), { bias });
  }
  c.part();
  for (let r = 2; r <= 4; r++) for (const i of [0, 1]) c.px(lx + i, ly + r, S.glass, sphere(i ? 0.3 : -0.3, (r - 3) * 0.4));
  c.part();
  for (let i = -1; i <= 2; i++) c.px(lx + i, ly + 5, S.brass, sphere(i * 0.4 - 0.2, 0.4), { bias });
  const og = S.overgrowth;
  if (og) {
    c.part();
    c.px(lx, ly + 1, og.moss, sphere(-0.2, -0.7), { bias });
    c.px(lx + 2, ly + 5, og.moss, sphere(0.4, 0.2), { bias });
  }
  // The flame, flickering, and its light spilling round the lantern.
  const fl = p.flame * (0.85 + 0.15 * [1, 0.6, 0.9, 0.5, 1, 0.7][p.tick % 6]);
  const fx = lx + (p.tick % 3 === 1 ? 1 : 0);
  c.spark(fx, ly + 3, core, 0.7 + 0.3 * fl);
  c.spark(fx, ly + 2, hot, 0.6 * fl);
  c.spark(lx + 1 - (fx - lx), ly + 4, hot, 0.45 * fl);
  for (const [ox, oy] of [[-2, 3], [3, 3], [0, 6], [1, 6], [0, 0]] as const) c.spark(lx + ox, ly + oy, mid, 0.22 * fl);
}

/** Moss clumps over cloth at these spots, lichen flecks on the coat between rows y0..y1. */
function overgrow(c: PixelCanvas, clumps: [number, number][], x0: number, x1: number, y0: number, y1: number, seed: number): void {
  const og = S.overgrowth;
  if (!og) return;
  c.part();
  for (const [x, y] of clumps) {
    c.px(x, y, og.moss, sphere(-0.2, -0.6));
    c.px(x + 1, y, og.moss, sphere(0.3, -0.5));
    c.px(x, y + 1, og.moss, sphere(-0.3, 0.2), { bias: -1 });
  }
  for (let y = Math.floor(y0); y <= y1; y++) {
    for (let x = Math.floor(x0); x <= x1; x++) {
      if (!c.filled(x, y) || c.materialAt(x, y) !== S.coat) continue;
      if (hash(x + seed, y * 3) > 0.9) c.px(x, y, og.lichen, sphere(0, -0.2));
    }
  }
}

/** A patch sewn on the coat over (x0..x1, y0..y1), where the coat is, its edge stitched. */
function patchOn(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, m: Material): void {
  if (S.overgrowth) return;
  c.part();
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (c.materialAt(x, y) !== S.coat) continue;
      const rim = x === x0 || x === x1 || y === y0 || y === y1;
      c.px(x, y, m, sphere((x - (x0 + x1) / 2) * 0.3, -0.1), { bias: rim && ((x + y) & 1) === 0 ? -1 : 0 });
    }
  }
}

/** Two little mushrooms on the brim, faintly aglow. */
function mushrooms(c: PixelCanvas, spots: [number, number][]): void {
  const og = S.overgrowth;
  if (!og) return;
  for (const [x, y] of spots) {
    c.part();
    c.px(x, y, og.stem, sphere(0, 0));
    c.part();
    c.px(x - 1, y - 1, og.cap, sphere(-0.6, -0.4));
    c.px(x, y - 1, og.cap, sphere(0, -0.8));
    c.px(x + 1, y - 1, og.cap, sphere(0.6, -0.4), { bias: -1 });
    c.spark(x, y - 1, S.light[2], 0.25);
  }
}

// ---------------------------------------------------------------------------
// The head

/** From the front: the hat pulled low, eyes in its shadow, a bulbous nose, grey whiskers. */
function headDown(c: PixelCanvas, hx: number, hy: number, p: Pose): void {
  const lk = p.look ?? 0;
  // Grey hair poking out at the temples, then the face.
  c.part();
  c.ellipse(hx, 10.6 + hy, 3.5, 2.3, S.beard);
  c.part();
  c.ellipse(hx, 11.1 + hy, 2.85, 2.5, S.skin);
  // Whiskers over the jaw and chin, a moustache across, the mouth a dark gap in them.
  c.part();
  c.shape(Math.round(12 + hy), Math.round(14.4 + hy), (y) => {
    const k = y - Math.round(12 + hy);
    const hw = 3.1 - k * 0.75;
    return hw < 0.4 ? null : [hx - hw, hx + hw];
  }, S.beard, (_x, _y, t, u) => sphere(t * 0.8, u * 0.6 - 0.1, 1));
  c.shade(hx - 1, 13 + hy, -2);
  c.shade(hx, 13 + hy, -2);
  // The nose, red and round.
  c.part();
  c.px(hx - 1, 11 + hy, S.skin, sphere(-0.3, -0.3), { bias: 1 });
  c.px(hx, 11 + hy, S.skin, sphere(0.3, -0.1), { bias: 1 });
  c.px(hx - 1, 12 + hy, S.skin, sphere(-0.2, 0.5));
  c.px(hx, 12 + hy, S.skin, sphere(0.2, 0.6), { bias: -1 });
  // The eyes, under the brim; the lantern catching in them.
  c.part();
  for (const ex of [hx - 2, hx + 1]) {
    if (p.blink) c.px(ex, 10 + hy, S.skin, sphere(0, -0.4), { bias: -1 });
    else {
      c.px(ex + (lk > 0 ? 1 : lk < 0 ? -1 : 0) * (ex < hx ? 0 : 0), 10 + hy, S.eyes);
      c.spark(ex + (lk > 0 ? 0.6 : lk < 0 ? -0.4 : 0.2), 10 + hy, S.light[1], 0.28);
    }
  }
  hatDown(c, hx, hy);
}

/** The battered hat from the front: brim, crown with its dent, the band, then the brim's front edge over the brow. */
function hatDown(c: PixelCanvas, hx: number, hy: number): void {
  const brim = (front: boolean) =>
    c.ellipse(hx, 8.6 + hy, 6.7, 1.6, S.hat, {
      normal: (x, _y, dx, dy) => (front && dy < 0.15 ? sphere(0, 0) : sphere(dx * 0.45, dy * 0.6 - 0.55 + (x < hx - 4 ? 0.25 : 0), 1)),
    });
  c.part();
  brim(false);
  // The drooping left side.
  c.px(hx - 7, 9 + hy, S.hat, sphere(-0.6, 0.3));
  c.px(hx - 6, 10 + hy, S.hat, sphere(-0.4, 0.5), { bias: -1 });
  c.part();
  c.shape(Math.round(3.6 + hy), Math.round(7.4 + hy), (y) => {
    const r = y - Math.round(3.6 + hy);
    const hw = r < 1 ? 2.6 : 3.3 + r * 0.06;
    return [hx - hw - 0.2, hx + hw - 0.2];
  }, S.hat, (_x, _y, t, u) => sphere(t * 0.85, u * 0.5 - 0.45, 1));
  c.shade(hx - 1, 4 + hy, -1);
  c.shade(hx, 4 + hy, -1);
  c.shade(hx - 1, 5 + hy, 1);
  c.part();
  c.shape(Math.round(7 + hy), Math.round(7 + hy), () => [hx - 3.5, hx + 3.1], S.band, (_x, _y, t) => cyl(t, 0.1));
  // The brim's front edge comes down over the brow; a notch bitten out of its right side.
  c.part();
  c.shape(Math.round(9 + hy), Math.round(9 + hy), (y) => {
    const dy = (y + 0.5 - 8.6 - hy) / 1.6;
    const hw = 6.7 * Math.sqrt(Math.max(0, 1 - dy * dy));
    return [hx - hw, hx + hw];
  }, S.hat, (_x, _y, t) => sphere(t * 0.5, 0.35, 1), { bias: -1 });
  c.erase(hx + 5, 10 + hy);
  if (S.overgrowth) {
    // Moss along the brim, two mushrooms sprouting on it.
    const og = S.overgrowth;
    c.part();
    for (const x of [-6, -5, -4, 3, 4, 5]) c.px(hx + x, 8 + hy - (Math.abs(x) > 5 ? 0 : 0), og.moss, sphere(x * 0.08, -0.6));
    c.px(hx - 5, 7 + hy, og.moss, sphere(-0.4, -0.8));
    c.px(hx + 2, 4 + hy, og.moss, sphere(0.2, -0.8));
    c.px(hx + 1, 4 + hy, og.lichen, sphere(0, -0.8));
    mushrooms(c, [[hx - 4, 7 + hy], [hx + 5, 8 + hy]]);
  } else {
    // A patch sewn over a hole in the crown.
    c.part();
    c.px(hx + 1, 5 + hy, S.patch, sphere(0.3, -0.2));
    c.px(hx + 2, 5 + hy, S.patch, sphere(0.5, -0.2), { bias: -1 });
    c.px(hx + 1, 6 + hy, S.patch, sphere(0.3, 0.1), { bias: -1 });
  }
}

/** From behind: grey hair at the nape under the hat. */
function headUp(c: PixelCanvas, hx: number, hy: number): void {
  c.part();
  c.ellipse(hx, 11.4 + hy, 2.8, 2.2, S.beard, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.7 + 0.3, 1), bias: -1 });
  for (let y = 11; y <= 13; y++) c.shade(hx - 1 + ((y & 1) === 0 ? 0 : 1), y + hy, -1);
  c.part();
  c.ellipse(hx, 8.4 + hy, 6.7, 1.7, S.hat, { normal: (_x, _y, dx, dy) => sphere(dx * 0.45, dy * 0.6 - 0.5, 1) });
  c.px(hx + 6, 9 + hy, S.hat, sphere(0.6, 0.3));
  c.part();
  c.shape(Math.round(3.6 + hy), Math.round(7.6 + hy), (y) => {
    const r = y - Math.round(3.6 + hy);
    const hw = r < 1 ? 2.6 : 3.3 + r * 0.06;
    return [hx - hw + 0.2, hx + hw + 0.2];
  }, S.hat, (_x, _y, t, u) => sphere(t * 0.85, u * 0.5 - 0.4, 1));
  c.shade(hx, 4 + hy, -1);
  c.part();
  c.shape(Math.round(7 + hy), Math.round(7 + hy), () => [hx - 3.1, hx + 3.5], S.band, (_x, _y, t) => cyl(t, 0.1));
  if (S.overgrowth) {
    const og = S.overgrowth;
    c.part();
    for (const x of [-5, -4, 4, 5, 6]) c.px(hx + x, 8 + hy, og.moss, sphere(x * 0.08, -0.6));
    c.px(hx - 1, 4 + hy, og.moss, sphere(-0.2, -0.8));
    mushrooms(c, [[hx + 4, 8 + hy]]);
  }
}

/** In profile, facing left: the long brim, the nose jutting under it, whiskers along the jaw, hair at the nape. */
function headSide(c: PixelCanvas, hx: number, hy: number, p: Pose): void {
  c.part();
  c.ellipse(hx + 1.3, 11.2 + hy, 2.1, 2.1, S.beard);
  c.part();
  c.ellipse(hx - 0.7, 11.1 + hy, 2.4, 2.4, S.skin);
  // The ear.
  c.shade(hx + 0.6, 11 + hy, -1);
  c.shade(hx + 0.6, 12 + hy, -1);
  // Whiskers along the jaw and the chin, jutting.
  c.part();
  c.shape(Math.round(12 + hy), Math.round(14.4 + hy), (y) => {
    const k = y - Math.round(12 + hy);
    return [hx - 3.4 + k * 0.35, hx + 0.9 - k * 0.7];
  }, S.beard, (_x, _y, t, u) => sphere(t * 0.7 - 0.2, u * 0.6 - 0.1, 1));
  c.shade(hx - 2, 13 + hy, -2);
  // The nose.
  c.part();
  c.px(hx - 4, 11 + hy, S.skin, sphere(-0.7, -0.1), { bias: 1 });
  c.px(hx - 4, 12 + hy, S.skin, sphere(-0.6, 0.5));
  c.px(hx - 3, 11 + hy, S.skin, sphere(-0.3, -0.2), { bias: 1 });
  c.part();
  if (p.blink) c.px(hx - 2, 10 + hy, S.skin, sphere(-0.2, -0.4), { bias: -1 });
  else {
    c.px(hx - 2, 10 + hy, S.eyes);
    c.spark(hx - 2, 10 + hy, S.light[1], 0.28);
  }
  // The hat: crown and band, then the long flat brim.
  c.part();
  c.shape(Math.round(3.8 + hy), Math.round(7.6 + hy), (y) => {
    const r = y - Math.round(3.8 + hy);
    return r < 1 ? [hx - 2.4, hx + 2.0] : [hx - 3.1, hx + 2.7];
  }, S.hat, (_x, _y, t, u) => sphere(t * 0.85 - 0.1, u * 0.5 - 0.45, 1));
  c.shade(hx, 4 + hy, -1);
  c.part();
  c.shape(Math.round(7 + hy), Math.round(7 + hy), () => [hx - 3.1, hx + 2.7], S.band, (_x, _y, t) => cyl(t, 0.1));
  c.part();
  c.ellipse(hx - 0.6, 8.5 + hy, 6.2, 1.15, S.hat, { normal: (x, _y, dx, dy) => sphere(dx * 0.4, dy * 0.6 - 0.5 + (x < hx - 4 ? 0.3 : 0), 1) });
  // The brim droops at the front.
  c.px(hx - 7, 9 + hy, S.hat, sphere(-0.6, 0.4), { bias: -1 });
  if (S.overgrowth) {
    const og = S.overgrowth;
    c.part();
    for (const x of [-5, -4, 3, 4]) c.px(hx + x, 7 + hy, og.moss, sphere(x * 0.08, -0.6));
    c.px(hx, 3 + hy, og.moss, sphere(0, -0.8));
    mushrooms(c, [[hx - 3, 7 + hy]]);
  }
}

// ---------------------------------------------------------------------------
// Directions

/** The coat's half width at row y of top..hem: round, heavy shoulders, then hanging straight and flaring a touch. */
function coatWidth(y: number, top: number, hem: number): number {
  const r = y - top;
  const u = r / (hem - top);
  return r < 2.5 ? 4.4 + r * 0.9 : 6.6 - u * 0.5 + u * u * 0.6;
}

function boots(c: PixelCanvas, L: number, cx: number, p: Pose): void {
  for (const [x, f] of [[cx - 3.2, p.footA], [cx + 3.2, p.footB]] as const) {
    const out = x < cx ? -1 : 1;
    c.part();
    c.capsule(x, 25.5 + L, x + out * 0.1, 28.6 - f, 1.6, 1.5, S.trousers);
    c.part();
    c.ellipse(x + out * 0.3, 30.2 - f, 2.4, 1.5, S.boots, { flatten: 0.8 });
    c.shade(x + out * 0.3, 29 - f, 1);
  }
}

function drawDown(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const [ax, ay] = handAt(p, 'a');
  const [bx, by] = handAt(p, 'b');
  const shA: [number, number] = [cx - 5.4, 15.4 + U];
  const shB: [number, number] = [cx + 5.4, 15.4 + U];
  // Hands raised over the head bend the elbows out to the sides, clear of the hat.
  const armA = () => arm(c, shA[0], shA[1], ax, ay, ay < 10 ? [-1, -0.2] : [-0.8, 0.6], p.ta !== null && !p.front && p.hands !== 'front' ? -1 : 0);
  const armB = () => arm(c, shB[0], shB[1], bx, by, by < 10 ? [1, -0.2] : [0.8, 0.6], p.tb !== null && !p.front && p.hands !== 'front' ? -1 : 0);
  const handsFront = p.hands ? p.hands === 'front' : p.front;
  let drewA = false;
  let drewB = false;
  if (!p.front) {
    drawSpade(c, p, -1);
    if (!handsFront) {
      if (p.ta !== null) (armA(), (drewA = true));
      if (p.tb !== null) (armB(), (drewB = true));
    }
  }

  boots(c, L, cx, p);

  // The coat, open over the apron.
  const top = 13 + U;
  const hem = 27 + L;
  const waist = 20.5 + U;
  const sway = (y: number) => {
    const u = (y - top) / (hem - top);
    return u * u * p.sway;
  };
  c.part();
  c.shape(Math.round(top), Math.round(hem), (y) => {
    const hw = coatWidth(y, top, hem);
    return [cx - hw + sway(y), cx + hw + sway(y)];
  }, S.coat, (_x, y, t) => sphere(t * 0.9, y <= waist ? ((y - top) / (waist - top)) * 0.7 - 0.45 : 0.22, 1));
  // Heavy folds falling from the belt.
  for (let y = Math.round(waist) + 2; y <= hem; y++) {
    c.shade(Math.round(cx - 4.6 + sway(y)), y, -1);
    c.shade(Math.round(cx + 4.4 + sway(y)), y, -1);
  }
  patchOn(c, Math.round(cx - 6), Math.round(23 + L), Math.round(cx - 4), Math.round(25 + L), S.patch2);
  patchOn(c, Math.round(cx + 3), Math.round(15 + U), Math.round(cx + 5), Math.round(16 + U), S.patch);
  // The apron: a bib up to the chest, the skirt down to the hem, the coat's edges dark either side.
  c.part();
  c.shape(Math.round(15.5 + U), Math.round(hem - 0.5), (y) => {
    const hw = y < waist ? 2.2 : 2.6 + (y - waist) * 0.12;
    return [cx - hw + sway(y), cx + hw + sway(y)];
  }, S.apron, (_x, _y, t, u) => sphere(t * 0.7, u * 0.5 - 0.25, 1));
  for (let y = Math.round(15.5 + U); y <= hem - 1; y++) {
    const hw = y < waist ? 2.2 : 2.6 + (y - waist) * 0.12;
    c.shade(Math.round(cx - hw + sway(y)) - 1, y, -1);
    c.shade(Math.round(cx + hw + sway(y)), y, -1);
  }
  // A pocket on the apron, stitched.
  for (let x = cx - 2; x <= cx + 1; x++) c.shade(x + Math.round(sway(23 + L)), Math.round(22.6 + L), -1);
  c.shade(cx - 2, Math.round(23.6 + L), -1);
  c.shade(cx + 1, Math.round(23.6 + L), -1);
  // The belt and its buckle.
  c.part();
  c.shape(Math.round(waist), Math.round(waist), () => [cx - 6.4, cx + 6.4], S.belt, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(cx - 1, Math.round(waist), S.brass, sphere(-0.3, -0.3));
  c.px(cx, Math.round(waist), S.brass, sphere(0.3, -0.3), { bias: -1 });
  overgrow(c, [[cx - 6, Math.round(14 + U)], [cx + 4, Math.round(14 + U)], [cx - 5, Math.round(25 + L)]], cx - 7, cx + 7, top + 2, hem, 3);

  // The muffler at his throat, its knot hanging over the bib.
  c.part();
  c.shape(Math.round(13.4 + U), Math.round(14.5 + U), () => [cx - 3.6, cx + 3.6], S.scarf, (_x, _y, t, u) => sphere(t * 0.8, u - 0.3, 1));
  c.part();
  c.capsule(cx + 2.2, 15 + U, cx + 2.5 + p.sway * 0.25, 17.4 + U, 0.9, 0.75, S.scarf);
  if (S.overgrowth) {
    c.part();
    c.px(cx + 2, 17 + U, S.overgrowth.moss, sphere(0, 0.3));
  }

  const hx = cx + (p.head?.[0] ?? 0);
  const hy = U + (p.head?.[1] ?? 0);
  headDown(c, hx, hy, p);
  // Hands gripping the haft above the hat still show over it.
  for (const [t, x, y] of [[p.ta, ax, ay], [p.tb, bx, by]] as const) {
    if (t === null || handsFront || y > 8) continue;
    c.part();
    c.ellipse(x, y, 1.35, 1.3, S.glove);
  }

  if (!p.carry) lantern(c, cx + 5.6 + p.lantern * 0.7, 21 + U, p);

  if (p.front) drawSpade(c, p, 0);
  if (!drewA) armA();
  if (!drewB) armB();
  if (p.carry) lantern(c, bx - 0.5, by + 1, p);
  if (p.flask !== undefined) flask(c, bx, by, p.flask);
}

/** The pewter hip flask in the hand, tipped as he drinks. */
function flask(c: PixelCanvas, x: number, y: number, tip: number): void {
  const t = Math.round(tip * 2);
  c.part();
  if (t < 2) {
    // Upright (or a little tipped): a flat bottle, its cap on top.
    for (let r = -3; r <= 0; r++) for (const i of [-1, 0]) c.px(x + i + (r < -1 ? t : 0), y + r, S.flask, sphere(i ? -0.4 : 0.3, r * 0.2));
    c.part();
    c.px(x - 1 + t, y - 4, S.brass, sphere(0, -0.6));
  } else {
    // Tipped up to the lips, the base raised.
    for (let i = 0; i <= 3; i++) for (const r of [-1, 0]) c.px(x - i, y + r - Math.round(i * 0.4), S.flask, sphere(-0.2, r ? -0.4 : 0.3));
    c.part();
    c.px(x - 4, y - 2, S.brass, sphere(-0.5, -0.3));
  }
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
  if (!p.front) drawSpade(c, p, -1);
  if (!handsFront) {
    if (p.ta !== null) (armA(), (drewA = true));
    if (p.tb !== null) (armB(), (drewB = true));
  }

  boots(c, L, cx, { ...p, footA: p.footB, footB: p.footA });

  const top = 13 + U;
  const hem = 27 + L;
  const waist = 20.5 + U;
  const sway = (y: number) => {
    const u = (y - top) / (hem - top);
    return u * u * p.sway;
  };
  c.part();
  c.shape(Math.round(top), Math.round(hem), (y) => {
    const hw = coatWidth(y, top, hem);
    return [cx - hw + sway(y), cx + hw + sway(y)];
  }, S.coat, (_x, _y, t, u) => sphere(t * 0.9, u * 0.6 - 0.3, 1));
  // The seam down the back and the vent at the bottom; folds either side.
  for (let y = Math.round(top + 2); y <= hem; y++) c.shade(Math.round(cx + sway(y)), y, y > waist + 2 ? -2 : -1);
  for (let y = Math.round(waist) + 2; y <= hem; y++) {
    c.shade(Math.round(cx - 4 + sway(y)), y, -1);
    c.shade(Math.round(cx + 4 + sway(y)), y, -1);
  }
  patchOn(c, Math.round(cx + 2), Math.round(17 + U), Math.round(cx + 4), Math.round(19 + U), S.patch);
  patchOn(c, Math.round(cx - 5), Math.round(24 + L), Math.round(cx - 3), Math.round(25 + L), S.patch2);
  c.part();
  c.shape(Math.round(waist), Math.round(waist), () => [cx - 6.4, cx + 6.4], S.belt, (_x, _y, t) => cyl(t, 0));
  overgrow(c, [[cx - 5, Math.round(14 + U)], [cx + 3, Math.round(14 + U)], [cx + 1, Math.round(22 + U)]], cx - 7, cx + 7, top + 2, hem, 11);
  // The collar turned up, the muffler round the back of the neck.
  c.part();
  c.shape(Math.round(13 + U), Math.round(14 + U), () => [cx - 3.6, cx + 3.6], S.scarf, (_x, _y, t, u) => sphere(t * 0.8, u - 0.4, 1));
  headUp(c, cx + (p.head?.[0] ?? 0), U + (p.head?.[1] ?? 0));

  // His lantern on his left hip: screen left, from behind.
  if (!p.carry) lantern(c, cx - 7.6 + p.lantern * 0.7, 21 + U, p, -1);

  if (p.front) drawSpade(c, p, 0);
  if (!drewA) armA();
  if (!drewB) armB();
}

/** Facing left. Right-facing frames are mirrored from these. */
function drawSide(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const hx = cx - 0.6 - p.lean; // the upper body's centre
  const [ax, ay] = handAt(p, 'a');
  const [bx, by] = handAt(p, 'b');

  if (!p.front) drawSpade(c, p, -1);
  // The far arm, behind everything.
  arm(c, hx + 1.6, 15.2 + U, ax, ay, [0.4, 1], -1);

  // Feet: the back one in shade first.
  const lift = (f: number) => Math.max(0, f) * 0.35;
  for (const [f, far] of [[p.footB, true], [p.footA, false]] as const) {
    const x = cx + (far ? 0.8 : -0.8) - f;
    c.part();
    c.capsule(cx + (far ? 0.9 : -0.6) - f * 0.4, 25.5 + L, x, 28.6 - lift(f), 1.6, 1.5, S.trousers, { bias: far ? -1 : 0 });
    c.part();
    c.ellipse(x - 0.8, 30.3 - lift(f), 3.0, 1.4, S.boots, { flatten: 0.8, bias: far ? -1 : 0 });
    c.shade(x - 2, 29.3 - lift(f), 1);
  }

  // The coat in profile: a hump of a back, the tails hanging behind.
  const top = 13.4 + U;
  const hem = 27 + L;
  const waist = 20.5 + U;
  const edges = (y: number): [number, number] => {
    const r = y - top;
    const u = r / (hem - top);
    const sx = hx + (cx - hx) * u;
    const hump = r < 5 ? Math.sin((r / 5) * Math.PI) * 1.3 : 0;
    const front = r < 1 ? 2.6 : 3.4 + u * 0.6;
    const back = (r < 1 ? 2.8 : 3.8) + hump + u * u * (1.0 + p.sway);
    return [sx - front, sx + back];
  };
  c.part();
  c.shape(Math.round(top), Math.round(hem), edges, S.coat, (_x, y, t) => sphere(t * 0.9 - 0.1, y <= waist ? ((y - top) / (waist - top)) * 0.7 - 0.45 : 0.22, 1));
  // The apron down his front, the coat's open edge dark beside it.
  c.part();
  for (let y = Math.round(16 + U); y <= hem - 1; y++) {
    const x = Math.round(edges(y)[0]);
    if (c.filled(x, y)) c.px(x, y, S.apron, sphere(-0.6, 0.1));
    if (c.filled(x + 1, y)) c.px(x + 1, y, S.apron, sphere(-0.2, 0.1), { bias: -1 });
    c.shade(x + 2, y, -1);
  }
  // A vent up the back of the coat, and a fold.
  for (let y = Math.round(waist) + 2; y <= hem; y++) c.shade(Math.round(edges(y)[1]) - 2, y, -1);
  c.part();
  c.shape(Math.round(waist), Math.round(waist), (y) => [edges(y)[0], edges(y)[1] - 0.5], S.belt, (_x, _y, t) => cyl(t, 0));
  patchOn(c, Math.round(hx + 1), Math.round(23 + L), Math.round(hx + 3), Math.round(25 + L), S.patch2);
  overgrow(c, [[Math.round(hx + 1), Math.round(13 + U)], [Math.round(hx + 3), Math.round(15 + U)], [Math.round(hx + 3), Math.round(24 + L)]], cx - 8, cx + 8, top + 2, hem, 5);
  // The muffler's knot under the chin.
  c.part();
  c.shape(Math.round(13.4 + U), Math.round(14.5 + U), () => [hx - 2.6, hx + 2.2], S.scarf, (_x, _y, t, u) => sphere(t * 0.8, u - 0.3, 1));
  c.part();
  c.capsule(hx - 2.2, 14.6 + U, hx - 2.4 - p.lean * 0.2, 16.8 + U, 0.8, 0.7, S.scarf);

  // The head pushed forward of the shoulders: he stoops.
  headSide(c, hx - 2.0, U + 0.4, p);

  lantern(c, hx + 0.6 + p.lantern * 0.8, 21 + U, p);

  if (p.front) drawSpade(c, p, 0);
  arm(c, hx + 0.4, 15.6 + U, bx, by, [0.5, 1], 0);
}

// ---------------------------------------------------------------------------
// Animations

/** The spade planted at his side, a hand on its grip, the other at his hip by the lantern. */
const base = (view: View): Pose => {
  const p: Pose = {
    lift: 0,
    breath: 0,
    footA: view === 'side' ? 1 : 0,
    footB: view === 'side' ? -1 : 0,
    lean: 0,
    sway: 0,
    g: [4.5, 13.2],
    d: 90,
    fore: 1,
    face: 0.8,
    front: true,
    ta: 0.8,
    tb: null,
    fa: [6.6, 21.6],
    fb: [17.6, 21.2],
    lantern: 0,
    flame: 0.7,
    tick: 0,
  };
  if (view === 'up') {
    p.g = [19.5, 13.2];
    p.ta = null;
    p.tb = 0.8;
    p.fa = [6.4, 21.2];
  } else if (view === 'side') {
    p.g = [4.8, 13.4];
    p.d = 100;
    p.face = 0.3;
    p.ta = null;
    p.tb = 0.8;
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

/** Standing, the spade planted, his breath heavy, the lantern's flame flickering. */
function idle(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = (f / N) * Math.PI * 2;
    const p = base(view);
    p.breath = Math.sin(ph) > 0.4 ? 1 : 0;
    p.lantern = Math.sin(ph) * 0.4;
    p.sway = Math.sin(ph - 1) * 0.4;
    const free = view === 'down' ? 'fb' : 'fa';
    p[free] = [p[free][0], p[free][1] + p.breath * 0.6];
    p.tick = f;
    p.blink = f === 4;
    frames.push(p);
  }
  return frames;
}

/** A heavy, plodding walk, the spade over his shoulder, the lantern swinging. */
function walk(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = ((f + 0.5) / N) * Math.PI * 2;
    const s = Math.sin(ph);
    const p = base(view);
    p.lift = Math.abs(s) < 0.6 ? 1 : 0;
    p.lantern = -s;
    p.tick = f;
    p.face = 0.5;
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
      p.sway = s * 0.6;
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
      p.sway = s * 0.6;
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

/** Two hands on the haft: the grip end in one, the other lower down. */
const GRIP_A = { ta: 0, tb: 4.5 };
const GRIP_B = { ta: 4.5, tb: 0 };

/** The first blow: wound back to his right, then a flat, heavy sweep across in front of him. */
const swing1 = action([
  {
    down: { ...GRIP_B, g: [10, 19], d: 198, fore: 0.95, face: 0.6, breath: 1, head: [-1, 0] },
    up: { ...GRIP_A, g: [14, 19], d: -20, fore: 0.95, face: 0.6, breath: 1 },
    side: { ...GRIP_A, ta: 4.5, tb: 0, g: [13, 19], d: 15, face: 0.4, front: false, lean: -1, breath: 1 },
  },
  {
    down: { ...GRIP_B, g: [9.5, 17.5], d: 214, fore: 0.9, face: 0.7, head: [-1, 0] },
    up: { ...GRIP_A, g: [14.5, 17.5], d: -34, fore: 0.9, face: 0.7 },
    side: { ta: 4.5, tb: 0, g: [14, 17.5], d: -12, face: 0.5, front: false, lean: -1.5 },
  },
  {
    down: { ...GRIP_A, g: [10.5, 21], d: 78, fore: 0.75, face: 1, breath: 1, footA: 1, glint: 0.5 },
    up: { ...GRIP_A, g: [12, 17], d: -104, fore: 0.7, face: 1, front: false, breath: 1 },
    side: { ta: 4.5, tb: 0, g: [7.5, 20], d: 178, face: 0.5, lean: 1.5, footA: 2, glint: 0.6 },
  },
  {
    down: { ...GRIP_A, g: [14, 20.5], d: 14, fore: 0.95, face: 0.7, head: [1, 0], sway: 0.8 },
    up: { ...GRIP_B, g: [10, 20.5], d: 194, fore: 0.95, face: 0.7, sway: -0.8 },
    side: { ta: 4.5, tb: 0, g: [8.5, 21], d: 140, fore: 0.8, face: 0.8, lean: 1, footA: 2 },
  },
  {
    down: { ...GRIP_A, g: [12, 19], d: 60, fore: 0.85, face: 0.7 },
    up: { ...GRIP_B, g: [12, 19], d: 120, fore: 0.85, face: 0.7 },
    side: { ta: 4.5, tb: 0, g: [6.5, 16], d: 105, face: 0.35, lean: 0.5 },
  },
]);

/** The second: a low backhand that digs in and heaves up, flinging earth. */
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
    down: { ...GRIP_A, g: [10, 14.5], d: -128, fore: 0.95, face: 0.8, lift: 1, head: [-1, -1], glint: 0.7 },
    up: { ...GRIP_A, g: [14, 14.5], d: -52, fore: 0.95, face: 0.8, front: false, lift: 1 },
    side: { ta: 4.5, tb: 0, g: [7.5, 14.5], d: -152, face: 0.6, lift: 1, lean: 1, glint: 0.6 },
  },
  {
    down: { ...GRIP_A, g: [9.5, 13.5], d: -112, fore: 0.9, face: 0.7, lift: 1 },
    up: { ...GRIP_A, g: [14, 13], d: -70, fore: 0.9, face: 0.7, front: false, lift: 1 },
    side: { ta: 4.5, tb: 0, g: [8.5, 13], d: -118, face: 0.5, lift: 1, lean: 0.5 },
  },
  {
    down: { g: [5.5, 14.5], d: 98 },
    up: { g: [19, 14.5], d: 82 },
    side: { g: [5.6, 15], d: 104 },
  },
]);

/** The finisher: the spade raised high overhead, then brought down flat on the ground with all his weight. */
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
    down: { ta: 0, tb: 1.5, g: [12, 2], d: -90, fore: 0.6, face: 0.8, front: false, hands: 'behind', lift: 1, head: [0, -1] },
    up: { ta: 0, tb: 1.5, g: [12, 5.5], d: -88, fore: 0.95, face: 0.8, hands: 'front', lift: 1 },
    side: { ta: 3, tb: 0, g: [14, 7], d: -60, face: 0.5, lift: 1, lean: -1.5 },
  },
  {
    down: { ta: 0, tb: 4, g: [12, 21.5], d: 90, fore: 0.72, face: 1, breath: 2, footA: 1, glint: 0.9 },
    up: { ta: 0, tb: 4, g: [12, 16], d: -96, fore: 0.5, face: 1, front: false, hands: 'behind', breath: 2 },
    side: { ta: 3, tb: 0, g: [7, 20.5], d: 149, face: 0.5, lean: 2, breath: 2, footA: 2, glint: 0.9 },
  },
  {
    down: { ta: 0, tb: 4, g: [12, 21.5], d: 90, fore: 0.72, face: 1, breath: 1, footA: 1 },
    up: { ta: 0, tb: 4, g: [12, 16], d: -96, fore: 0.5, face: 1, front: false, hands: 'behind', breath: 1 },
    side: { ta: 3, tb: 0, g: [7, 20.5], d: 149, face: 0.5, lean: 2, breath: 1, footA: 2 },
  },
  {
    down: { ta: 0, tb: 4, g: [11, 18.5], d: 96, fore: 0.85, face: 0.9 },
    up: { ta: 0, tb: 4, g: [12.5, 17], d: -100, fore: 0.6, face: 0.9, front: false, hands: 'behind' },
    side: { ta: 3, tb: 0, g: [8.5, 18], d: 122, face: 0.4, lean: 1 },
  },
  {
    down: { g: [5.5, 14], d: 92 },
    up: { g: [19, 14], d: 88 },
    side: { g: [5.4, 14], d: 102 },
  },
]);

/**
 * Open grave: he lifts the spade, drives it into the earth, stamps it in,
 * leans on the haft and heaves the ground open.
 */
const dig = action([
  {
    down: { ta: 0, tb: 3.5, g: [11.5, 13], d: 90, face: 0.9, lift: 1 },
    up: { ta: 0, tb: 3.5, g: [12, 13], d: -90, fore: 0.5, front: false, hands: 'behind', lift: 1 },
    side: { ta: 3.5, tb: 0, g: [7, 11], d: 98, lift: 1 },
  },
  {
    down: { ta: 0, tb: 3.5, g: [11.5, 10], d: 90, face: 0.9, lift: 2, head: [0, -1] },
    up: { ta: 0, tb: 3.5, g: [12, 10], d: -90, fore: 0.6, front: false, hands: 'behind', lift: 2 },
    side: { ta: 3.5, tb: 0, g: [7, 8.5], d: 98, lift: 2, lean: 0.5 },
  },
  {
    down: { ta: 0, tb: 3.5, g: [11.5, 15.5], d: 90, face: 0.9, sink: 31.5, breath: 1 },
    up: { ta: 0, tb: 3.5, g: [12, 15], d: -90, fore: 0.3, front: false, hands: 'behind', breath: 1 },
    side: { ta: 3.5, tb: 0, g: [6.5, 15], d: 100, sink: 31, breath: 1, lean: 1 },
  },
  {
    down: { ta: 0, tb: 3.5, g: [11.5, 15.5], d: 90, face: 0.9, sink: 31.5, breath: 1, footB: 2 },
    up: { ta: 0, tb: 3.5, g: [12, 15], d: -90, fore: 0.3, front: false, hands: 'behind', breath: 1, footA: 2 },
    side: { ta: 3.5, tb: 0, g: [6.5, 15], d: 100, sink: 31, breath: 1, lean: 1, footA: 3 },
  },
  {
    down: { ta: 0, tb: 3.5, g: [11.5, 18.5], d: 78, fore: 0.8, face: 0.9, sink: 31.5 },
    up: { ta: 0, tb: 3.5, g: [12, 14], d: -78, fore: 0.55, front: false, hands: 'behind' },
    side: { ta: 3.5, tb: 0, g: [9.5, 17.5], d: 122, sink: 31, lean: -0.5 },
  },
  {
    down: { ta: 0, tb: 3.5, g: [11.5, 21.5], d: 64, fore: 0.6, face: 1, dirt: 1, lift: 1, head: [0, -1] },
    up: { ta: 0, tb: 3.5, g: [12, 12], d: -70, fore: 0.8, face: 1, front: false, hands: 'behind', dirt: 1, lift: 1 },
    side: { ta: 3.5, tb: 0, g: [11, 17], d: 140, face: 0.6, dirt: 1, lean: -1, lift: 1 },
  },
  {
    down: { ta: 0, tb: 3.5, g: [10, 18], d: 80, fore: 0.85, face: 1, dirt: 0.5 },
    up: { ta: 0, tb: 3.5, g: [13, 13], d: -80, fore: 0.6, front: false, hands: 'behind', dirt: 0.5 },
    side: { ta: 3.5, tb: 0, g: [9, 15], d: 120, face: 0.5, dirt: 0.5 },
  },
  {
    down: { g: [5, 14], d: 90 },
    up: { g: [19, 14], d: 90 },
    side: { g: [5.4, 13.8], d: 100 },
  },
]);

/** One beat of the idle moment: what differs from the plain stand. */
type RestKey = Partial<Pose>;

/** Both hands stacked on the grip, the spade planted before him. */
const LEAN: RestKey = { g: [8.5, 16], d: 92, face: 0.9, ta: 0.6, tb: 0.2 };
/** The lantern held up at arm's length. */
const UP_HIGH: RestKey = { tb: null, carry: true, flame: 1 };

/**
 * His idle moment: he leans on his spade and dozes off, jerks awake, unhooks
 * his lantern and holds it up to peer about him, first one way and then the
 * other, hangs it back on his belt, then takes a swig from his hip flask and
 * wipes his whiskers.
 */
const REST_KEYS: RestKey[] = [
  {},
  // Leaning on the spade, chin on his hands.
  { ...LEAN, breath: 1, head: [-1, 1] },
  { ...LEAN, breath: 1, head: [-1, 1], blink: true },
  { ...LEAN, breath: 2, head: [-1, 2], blink: true },
  // Awake with a start.
  { ...LEAN, head: [-1, -1], lift: 1 },
  // The lantern off the belt...
  { tb: null, fb: [17.6, 20.6], carry: true, flame: 0.8, head: [0, 0], look: 1 },
  // ...held high, and he peers out to the right...
  { ...UP_HIGH, fb: [21, 9.5], head: [1, 0], look: 1 },
  { ...UP_HIGH, fb: [21.4, 9], head: [1, 0], look: 1, lantern: 0.6 },
  // ...then the left.
  { ...UP_HIGH, fb: [20, 9.5], head: [-1, 0], look: -1, lantern: -0.6 },
  { ...UP_HIGH, fb: [20, 10], head: [-1, 0], look: -1, blink: true },
  // Nothing there. Back on the belt.
  { tb: null, fb: [18.6, 17], carry: true, flame: 0.8, head: [0, 0] },
  // A hand into the coat...
  { tb: null, fb: [15.4, 18.6] },
  // ...the flask out...
  { tb: null, fb: [16.4, 15.4], flask: 0 },
  // ...and up to his lips, head back.
  { tb: null, fb: [13.2, 12.2], flask: 1, head: [0, -1], blink: true },
  { tb: null, fb: [13.4, 12], flask: 1, head: [0, -1], blink: true, breath: 1 },
  // Ahh. He wipes his whiskers on his sleeve...
  { tb: null, fb: [15.4, 13.2], flask: 0.2, head: [0, 0] },
  // ...and tucks it away.
  { tb: null, fb: [15.4, 18.6] },
  {},
];

/** Slots of the idle moment in playing order, holds and repeats included (8 fps). */
const REST_ORDER = [0, 1, 1, 2, 2, 3, 3, 3, 2, 4, 4, 5, 6, 7, 7, 7, 8, 8, 9, 9, 10, 11, 12, 13, 14, 13, 14, 14, 15, 15, 16, 17];

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

/** The lantern's place on him, from his feet, per facing (for its light in the world). */
export const LANTERN_AT: Record<Dir, { x: number; y: number }> = {
  down: { x: 6.6, y: -7 },
  up: { x: -6.6, y: -7 },
  left: { x: -0.2, y: -7 },
  right: { x: 0.2, y: -7 },
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

/** Colours an icon is painted in: the spade, the earth, the glow, and the outline. */
export interface BarrowIcon {
  iron: [string, string, string];
  haft: [string, string];
  earth: [string, string, string];
  glow: [string, string, string];
  /** Bone (or root) for the arm out of the grave. */
  bone: [string, string, string];
  outline: string;
  /** Mossgrave's: roots wound round the haft, moss on the earth. */
  moss?: string;
}

export const BARROW_ICON: BarrowIcon = {
  iron: ['#d8dde0', '#8a9096', '#4a4e54'],
  haft: ['#8a6a42', '#5a3e24'],
  earth: ['#7a5a3a', '#5a3e26', '#3a2818'],
  glow: ['#f4ffe0', '#c8ff8a', '#7ad040'],
  bone: ['#f8f2da', '#d4cbaa', '#9a9278'],
  outline: '#120c08',
};

export const MOSSGRAVE_ICON: BarrowIcon = {
  iron: ['#b8e0c4', '#5a8a6a', '#2e4a3a'],
  haft: ['#6e5232', '#3e2a18'],
  earth: ['#4e6a2c', '#344c1c', '#1e2e10'],
  glow: ['#ecfffc', '#9ff8ee', '#3ad0c8'],
  bone: ['#7a5a36', '#5a4026', '#3a2814'],
  outline: '#0a0c06',
  moss: '#6a9a34',
};

/** The spade: swung on a slant, earth flying off its blade. */
export function spadeIcon(k: BarrowIcon = BARROW_ICON): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  // The haft from the T-grip at the top left down to the blade.
  for (let i = 0; i < 8; i++) {
    put(2 + i, 2 + i, k.haft[0]);
    put(3 + i, 2 + i, k.haft[1]);
  }
  put(1, 3, k.haft[0]);
  put(3, 1, k.haft[0]);
  put(2, 2, k.haft[1]);
  if (k.moss) for (const [x, y] of [[4, 5], [6, 6], [8, 9]]) put(x, y, k.moss);
  // The blade: a broad rounded head angled down to the right.
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const u = (x + 0.5 - 10) * 0.707 + (y + 0.5 - 10) * 0.707;
      const v = -(x + 0.5 - 10) * 0.707 + (y + 0.5 - 10) * 0.707;
      if (u < -0.5 || u > 5.2) continue;
      const w = u < 3.4 ? 2.6 : 2.6 * Math.sqrt(Math.max(0, 1 - ((u - 3.4) / 1.9) ** 2)) + 0.3;
      if (Math.abs(v) > w) continue;
      put(x, y, u > 4.3 ? k.iron[0] : v < -0.8 ? k.iron[0] : v > 1.2 ? k.iron[2] : k.iron[1]);
    }
  }
  // Earth on the face.
  put(11, 11, k.earth[1]);
  put(12, 11, k.earth[0]);
  put(11, 12, k.earth[2]);
  outline(k.outline);
  // Clods flung off it.
  for (const [x, y, c] of [[14, 6, 0], [15, 4, 1], [12, 4, 2], [6, 14, 1], [4, 15, 0]] as const) put(x, y, k.earth[c]);
  return px;
}

/** Open grave: the ground split, an arm clawing out of it, the lantern's light rising from the crack. */
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
