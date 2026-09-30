// Materials, the head and the buttons for the Headless Knight, the Knight's
// Hallow's Eve skin. The figure itself is drawn by the warrior's rig
// (warrior.ts), switched by its `headless` flag: blackened, battered plate
// trimmed in rust, a tattered cloak, a notched sword whose edge smoulders, and
// where his head should be, a ragged collar and a carved jack-o'-lantern
// burning from within, embers drifting up off it.

import { cyl, hex, sphere, type Material, type PixelCanvas, type RGB } from './pixel';
import { icon16, seg } from './druid';
import { whirlIcon } from './effects';

const ramp = (...c: string[]): RGB[] => c.map(hex);

const GRAVE_INK = hex('#040306');

// ---------------------------------------------------------------------------
// Materials

/** Plate blackened by fire: near black, a cold grey sheen where it faces the light. */
export const HOLLOW_IRON: Material = {
  ramp: ramp('#0c0a10', '#1a1720', '#2c2834', '#46404f', '#766e80'),
  outline: GRAVE_INK,
  outlineLit: hex('#15121a'),
  shine: true,
};

/** The mail and gauntlets under it, darker still. */
export const HOLLOW_MAIL: Material = {
  ramp: ramp('#09080c', '#15131a', '#221f28', '#342f3c'),
  outline: GRAVE_INK,
};

/** The cloak and tabard: a mouldering violet-black. */
export const HOLLOW_CLOAK: Material = {
  ramp: ramp('#0a0610', '#160c1e', '#241430', '#361e46', '#4a2a5c'),
  outline: hex('#030106'),
  outlineLit: hex('#120a1a'),
};

/** Rust-orange trim, the edges of the plate eaten through. */
export const RUST: Material = {
  ramp: ramp('#2a0e06', '#541f0c', '#8a3a14', '#bf5e1e', '#e68c46'),
  outline: hex('#100404'),
  outlineLit: hex('#1e0a06'),
};

/** The notched blade: dark, pitted steel. */
export const HOLLOW_BLADE: Material = {
  ramp: ramp('#131117', '#24212a', '#3a3642', '#595362', '#8a8494'),
  outline: hex('#060508'),
  outlineLit: hex('#14121a'),
  shine: true,
  noAO: true,
};

/** The pumpkin's rind. Its thin shell glows a little with the fire inside. */
export const PUMPKIN: Material = {
  ramp: ramp('#360e04', '#662206', '#9a3a0c', '#c85c16', '#ea8028'),
  outline: hex('#1a0602'),
  outlineLit: hex('#2e0e04'),
  emissive: 0.08,
};

/** The stem: dry, withered green-brown. */
const STEM: Material = {
  ramp: ramp('#1e1a0a', '#3c3618', '#5e5828', '#86803e'),
  outline: hex('#0a0804'),
};

/** The carved holes, the fire inside seen through them. */
const LANTERN: Material = {
  ramp: ramp('#ff9a2a', '#ffc040', '#ffdc66', '#ffec94'),
  outline: hex('#3a1004'),
  emissive: 1,
  noAO: true,
};

/** The hottest of it, deep in the middle of the eyes and the grin. */
const LANTERN_CORE: Material = {
  ramp: ramp('#ffe070', '#fff0a0', '#fff8c8', '#fffce4'),
  outline: hex('#3a1004'),
  emissive: 1,
  noAO: true,
};

/** Light of the lantern and the smouldering edge (light-only colours). */
export const HOLLOW_GLOW = { core: hex('#fff4d0'), hot: hex('#ffb040'), mid: hex('#ff6a14') };
/** Ghost-light, the green of will-o'-the-wisps, for an ember here and there. */
const WISP = hex('#a8ff8a');

// ---------------------------------------------------------------------------
// The head: a ragged collar, then the jack-o'-lantern sitting in it

/** The pumpkin's radii, and the row its middle sits on (before breathing). */
const PK_RX = 4.8;
const PK_RY = 4;
const PK_Y = 10;
/** Where its grooves run, across each row from -1 (left edge) to 1 (right edge). */
const GROOVES_FRONT = [-0.52, 0.52];
/** In profile (facing left) the face is turned toward the left edge. */
const GROOVES_SIDE = [-0.62, -0.05, 0.55];
/** Which pixels of the face are carved, by row offset from the pumpkin's middle: [dx, dy, hot]. */
const FACE_FRONT: [number, number, boolean][] = [
  // Triangle eyes, points up.
  [-3, -2, false], [2, -2, false],
  [-4, -1, false], [-3, -1, true], [-2, -1, false], [1, -1, false], [2, -1, true], [3, -1, false],
  // The grin, a row of rind under the eyes: wide at the top, two teeth hanging from the upper lip.
  [-3, 1, false], [-1, 1, true], [0, 1, true], [2, 1, false],
  [-2, 2, false], [-1, 2, true], [0, 2, true], [1, 2, false],
];
/** The face in profile (facing left): one eye, and half the grin curling back. */
const FACE_SIDE: [number, number, boolean][] = [
  [-3, -2, false],
  [-4, -1, false], [-3, -1, true], [-2, -1, false],
  [-4, 1, false], [-3, 1, true], [-1, 1, false],
  [-3, 2, false], [-2, 2, true], [-1, 2, false],
];

/**
 * The pumpkin's rind centred at (cx, cy): a squat ball whose lobes bulge
 * between the grooves, each lobe lit as its own curve, the grooves darker.
 */
function gourd(c: PixelCanvas, cx: number, cy: number, rx: number, grooves: number[]): void {
  const y0 = Math.floor(cy - PK_RY);
  const y1 = Math.ceil(cy + PK_RY);
  const row = (y: number): [number, number] | null => {
    const dy = (y + 0.5 - cy) / PK_RY;
    if (Math.abs(dy) >= 1) return null;
    const hw = rx * Math.sqrt(1 - dy * dy);
    return [cx - hw, cx + hw];
  };
  c.part();
  c.shape(y0, y1, row, PUMPKIN, (_x, y, t) => {
    const dy = (y + 0.5 - cy) / PK_RY;
    let lo = -1;
    let hi = 1;
    for (const g of grooves) {
      if (t < g) hi = Math.min(hi, g);
      else lo = Math.max(lo, g);
    }
    const local = ((t - lo) / (hi - lo || 1)) * 2 - 1;
    return sphere((t * 0.65 + local * 0.35) * Math.sqrt(1 - dy * dy), dy * 0.95, 1);
  });
  // The grooves, drawn in toward the stem and the base like lines of longitude.
  for (let y = y0; y <= y1; y++) {
    const e = row(y);
    if (!e) continue;
    const hw = (e[1] - e[0]) / 2;
    if (hw < 1.6) continue;
    for (const g of grooves) {
      const x = Math.floor(cx + g * hw);
      if (c.materialAt(x, y) === PUMPKIN) c.shade(x, y, -1);
    }
  }
}

/** Carve the face: the fire shows through, hottest in the middle. */
function carve(c: PixelCanvas, cx: number, cy: number, face: [number, number, boolean][]): void {
  c.part();
  const ox = Math.floor(cx);
  const oy = Math.floor(cy);
  for (const [dx, dy, hot] of face) c.px(ox + dx, oy + dy, hot ? LANTERN_CORE : LANTERN, { x: 0, y: -0.2, z: 0.98 });
}

/** The stem, curling back; `lean` is which way its tip bends. */
function stem(c: PixelCanvas, x: number, top: number, lean: number): void {
  c.part();
  c.px(x, top, STEM, sphere(-0.4, 0.2), { bias: 1 });
  c.px(x + 1, top, STEM, sphere(0.4, 0.2));
  c.px(x + (lean > 0 ? 1 : 0), top - 1, STEM, sphere(lean * 0.3, 0.4));
  c.px(x + (lean > 0 ? 2 : -1), top - 2, STEM, sphere(lean * 0.5, 0.6), { bias: 1 });
}

/**
 * Embers and wisps rising off the lantern. `phase` steps them upward from
 * frame to frame; one in three is ghost-green.
 */
function embers(c: PixelCanvas, cx: number, top: number, phase: number): void {
  const f = ((Math.round(phase) % 3) + 3) % 3;
  const rise: [number, number, number][] = [
    [-2, 0, 0.8],
    [2, -1, 0.6],
    [-1, -3, 0.45],
  ];
  rise.forEach(([dx, dy, a], i) => {
    const y = top + dy - f;
    const x = cx + dx + ((f + i) % 2 === 0 ? 0 : i === 1 ? 1 : -1);
    c.spark(x, y, i === 2 ? WISP : a > 0.7 ? HOLLOW_GLOW.hot : HOLLOW_GLOW.mid, a);
  });
  // A steady glow of heat just over the lid.
  c.spark(cx - 1, top + 1, HOLLOW_GLOW.mid, 0.35);
  c.spark(cx, top + 1, HOLLOW_GLOW.mid, 0.35);
}

/**
 * The ragged high collar standing up round where the neck should be: rows
 * 12..15, points flaring up past the pumpkin's jaw. `l` and `r` are its edges.
 */
function collar(c: PixelCanvas, l: number, r: number, U: number, points: number[]): void {
  c.part();
  c.shape(13 + U, 15 + U, (y) => {
    const f = (15 + U - y) * 0.35;
    return [l - f, r + f];
  }, HOLLOW_CLOAK, (_x, _y, t, u) => cyl(t, 0.35 - u * 0.4));
  for (const x of points) {
    c.px(x, 12 + U, HOLLOW_CLOAK, { x: x < (l + r) / 2 ? -0.5 : 0.5, y: 0.5, z: 0.7 }, { bias: 1 });
    c.px(x + (x < (l + r) / 2 ? -1 : 1), 11 + U, HOLLOW_CLOAK, { x: x < (l + r) / 2 ? -0.6 : 0.6, y: 0.6, z: 0.5 });
  }
}

/** The head seen from the front: collar, lantern, face, stem and embers. */
export function lanternFront(c: PixelCanvas, cx: number, U: number, phase: number): void {
  collar(c, cx - 4.4, cx + 4.4, U, [cx - 5, cx + 4]);
  const cy = PK_Y + U;
  gourd(c, cx, cy, PK_RX, GROOVES_FRONT);
  carve(c, cx, cy, FACE_FRONT);
  stem(c, cx - 1, 5 + U, 1);
  embers(c, cx, 4 + U, phase);
}

/** From behind: the lid's cut glowing where the fire leaks through it. */
export function lanternBack(c: PixelCanvas, cx: number, U: number, phase: number): void {
  collar(c, cx - 4.4, cx + 4.4, U, [cx - 5, cx + 4]);
  const cy = PK_Y + U;
  gourd(c, cx, cy, PK_RX, [-0.6, 0, 0.6]);
  // The lid was cut round the stem; a thread of light leaks through the cut.
  for (const [dx, dy] of [[-3, -2], [-2, -3], [-1, -3], [0, -3], [1, -3], [2, -2]] as const) {
    c.shade(Math.floor(cx) + dx, Math.floor(cy) + dy, -1);
    c.spark(Math.floor(cx) + dx, Math.floor(cy) + dy, HOLLOW_GLOW.mid, 0.45);
  }
  stem(c, cx - 1, 5 + U, -1);
  embers(c, cx, 4 + U, phase);
}

/** In profile, facing left: the grin running round toward the back. */
export function lanternSide(c: PixelCanvas, hx: number, U: number, phase: number): void {
  collar(c, hx - 3.4, hx + 2.8, U, [hx - 4, hx + 3]);
  const cx = hx - 0.4;
  const cy = PK_Y + U;
  gourd(c, cx, cy, 4.4, GROOVES_SIDE);
  carve(c, hx, cy, FACE_SIDE);
  stem(c, hx - 1, 5 + U, 1);
  embers(c, hx + 0.5, 4 + U, phase);
}

// ---------------------------------------------------------------------------
// Buttons (drawn additively: black is empty)

/** The attack button: the notched, smouldering blade on a rusted hilt. */
export function hollowSwordIcon(): Uint8ClampedArray {
  const steel = hex('#b4acc0');
  const steelDark = hex('#6a6478');
  const edge = hex('#ff7a1a');
  const hot = hex('#ffb040');
  return icon16((put) => {
    // Blade from the lower left to the upper right: a pale bevel, and an edge
    // that smoulders, hotter toward the point. Two nicks bitten out of it.
    for (let i = 0; i < 9; i++) {
      const nick = i === 3 || i === 6;
      if (!nick) put(5 + i, 10 - i, i > 6 ? hex('#ece4f2') : steel);
      put(6 + i, 10 - i, nick ? steelDark : i > 4 ? hot : edge);
    }
    put(14, 1, hex('#fff0c0'));
    // An ember flaking off the edge.
    put(13, 6, hex('#c24a12'));
    // A rusted crossguard, a dark grip and a pommel.
    for (const [x, y] of [[2, 9], [3, 10], [4, 11], [5, 12], [6, 13]]) put(x, y, hex('#c8642a'));
    put(3, 9, hex('#f0a060'));
    put(2, 9, hex('#e08040'));
    seg(put, 3, 12, 2, 13, hex('#6e6076'));
    put(1, 14, hex('#d8783a'));
  });
}

/** Colours of the whirlwind button's spiral: pumpkin fire fading to violet. */
const LANTERN_WHIRL: RGB[] = [hex('#fff4d0'), hex('#ffb040'), hex('#ff6a14'), hex('#6a2a9a')];

/** The special button: a whirl of pumpkin fire round a tiny grinning jack-o'-lantern. */
export function lanternWhirlIcon(): Uint8ClampedArray {
  const px = whirlIcon(LANTERN_WHIRL);
  const set = (x: number, y: number, c: RGB | null) => {
    const i = (y * 16 + x) * 4;
    px[i] = c ? c[0] : 0;
    px[i + 1] = c ? c[1] : 0;
    px[i + 2] = c ? c[2] : 0;
    px[i + 3] = 255;
  };
  const rind = hex('#c8561a');
  const rindLit = hex('#f08a2a');
  const rindDark = hex('#7a2a0a');
  const face = hex('#fff0a0');
  // Rows 6..10 of the pumpkin, their left and right pixels, a dark ring round it first.
  const rows: [number, number, number][] = [[5, 6, 9], [6, 5, 10], [7, 5, 10], [8, 5, 10], [9, 6, 9]];
  for (const [y, l, r] of rows) for (let x = l - 1; x <= r + 1; x++) set(x, y, null);
  for (let x = 6; x <= 9; x++) {
    set(x, 4, null);
    set(x, 10, null);
  }
  for (const [y, l, r] of rows) for (let x = l; x <= r; x++) set(x, y, x === l || y === 9 ? rindDark : x <= 7 && y <= 6 ? rindLit : rind);
  // The stem.
  set(8, 4, hex('#6c6634'));
  set(8, 3, null);
  // Eyes and grin.
  set(6, 6, face);
  set(9, 6, face);
  for (let x = 6; x <= 9; x++) set(x, 8, face);
  set(5, 7, face);
  set(10, 7, face);
  set(7, 8, rind);
  return px;
}
