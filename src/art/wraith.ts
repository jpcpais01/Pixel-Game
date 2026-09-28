// The Lantern Wraith: a tall hooded wraith drifting over the ground, an empty
// hood with two eye-lights in its dark, tattered robes streaming into ragged
// strips, wide sleeves, and an old iron lantern on a chain, burning with a
// green soul-flame. Its Calavera skin is a Día de Muertos spirit on the same
// drift: a painted sugar-skull face (flowers round the eyes, a heart for a
// nose, a stitched smile), a crown of marigolds, a black lace veil, a
// crimson gown embroidered with flowers and ruffled in black lace, fading to
// mist, and a paper lantern glowing gold through its cut-outs.
//
// Also here: the wisps it leaves (green soul-flames; marigold petals for the
// Calavera) and the icons.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB } from './pixel';
import { DIRS, type Dir } from './wizard';
import { icon16, seg, type Tones } from './druid';

const ramp = (...c: string[]): RGB[] => c.map(hex);

export const WRAITH_W = 40;
export const WRAITH_H = 50;
const CX = 20;
const GROUND = 47;
export const WRAITH_ORIGIN_X = CX;
export const WRAITH_ORIGIN_Y = GROUND;
/** The lantern's height above the ground at rest, where wisps are left. */
export const WRAITH_LANTERN_Y = 10;
export const WRAITH_CHEST_Y = 24;

// ---------------------------------------------------------------------------
// Materials

const ROBE: Material = { ramp: ramp('#07090e', '#10161e', '#1c2632', '#2c3a48', '#445668'), outline: hex('#020306'), outlineLit: hex('#0a0e14') };
const ROBE_EDGE: Material = { ramp: ramp('#0e1a1e', '#1e3a3c', '#2e5a58'), outline: hex('#020306'), emissive: 0.2 };
const HOOD_DARK: Material = { ramp: ramp('#000000', '#030406', '#07090c'), outline: hex('#000000'), noAO: true, noOutline: true };
const SOUL: Material = { ramp: ramp('#1a8a6a', '#4af0b0', '#c8fff0'), outline: hex('#063a2a'), emissive: 1, noAO: true, noOutline: true };
const BONE: Material = { ramp: ramp('#6a6450', '#a8a088', '#dcd6c0', '#fffbec'), outline: hex('#1e1a10'), shine: true };
const IRON: Material = { ramp: ramp('#0e0f14', '#1e2028', '#34384a', '#545a70'), outline: hex('#030305'), shine: true };
const GREEN_FLAME: Material = { ramp: ramp('#1a8a5a', '#4af0a0', '#d0ffe8', '#ffffff'), outline: hex('#063a22'), emissive: 1, noAO: true, noOutline: true };
const MIST: Material = { ramp: ramp('#1e3a3c', '#3a6a66', '#6aa8a0'), outline: hex('#0a1a1c'), emissive: 0.4, noAO: true, noOutline: true };

// The Calavera.
const SKULL: Material = { ramp: ramp('#9a948a', '#d4d0c8', '#f4f2ee', '#ffffff'), outline: hex('#2a2420'), shine: true, emissive: 0.1 };
const INK: Material = { ramp: ramp('#07050a', '#140e1c', '#221a2e'), outline: hex('#020104'), noAO: true };
const PETAL_PINK: Material = { ramp: ramp('#b02a6a', '#ff5aa8', '#ffb0d8'), outline: hex('#3a0a20'), noOutline: true, noAO: true, emissive: 0.3 };
const PETAL_TEAL: Material = { ramp: ramp('#0a8a8a', '#3ae0d8', '#b0fff8'), outline: hex('#063a3a'), noOutline: true, noAO: true, emissive: 0.3 };
const MARIGOLD: Material = { ramp: ramp('#a0400a', '#f07a14', '#ffb030', '#ffe070'), outline: hex('#3a1402'), shine: true, emissive: 0.15 };
const LACE_BLACK: Material = { ramp: ramp('#07060a', '#141220', '#221e30'), outline: hex('#020104'), noAO: true };
const GOWN: Material = { ramp: ramp('#2a040e', '#5a0a1e', '#8e1a32', '#c02e4a', '#e85a6e'), outline: hex('#100206'), outlineLit: hex('#1e040c') };
const GOWN_MIST: Material = { ramp: ramp('#5a1a2a', '#a04a5a', '#e0909a'), outline: hex('#2a0a10'), emissive: 0.5, noAO: true, noOutline: true };
const EMBROIDERY: Material[] = [
  { ramp: ramp('#c06a0a', '#ffc040'), outline: hex('#3a1a02'), noOutline: true, noAO: true },
  { ramp: ramp('#0a8a8a', '#40e0d0'), outline: hex('#063a3a'), noOutline: true, noAO: true },
  { ramp: ramp('#b02a8a', '#ff7ad0'), outline: hex('#3a0a2a'), noOutline: true, noAO: true },
];
const PAPER: Material = { ramp: ramp('#8a0e4a', '#d0287a', '#ff62a8', '#ffa0cc'), outline: hex('#2a0418'), emissive: 0.25 };
const GOLD_LIGHT: Material = { ramp: ramp('#ff9a2a', '#ffd860', '#fffbd0'), outline: hex('#5a2a06'), emissive: 1, noAO: true, noOutline: true };

export interface WraithLook {
  key: string;
  calavera: boolean;
}

export const WRAITH_LOOK: WraithLook = { key: 'wraith', calavera: false };
export const CALAVERA_LOOK: WraithLook = { key: 'wraith_cala', calavera: true };
export const WRAITH_LOOKS = [WRAITH_LOOK, CALAVERA_LOOK];

let L: WraithLook = WRAITH_LOOK;

type View = 'down' | 'up' | 'side';

export interface WraithPose {
  bob: number;
  /** The ragged hem's stream (side view: how far behind), and its flutter phase. */
  trail: number;
  flutter: number;
  /** The lantern: where it hangs from the hand (offset), and how bright it burns 0..1. */
  swing: number;
  lift: number;
  blaze: number;
  /** Upper body pitched forward (a dive), in px. */
  lean: number;
  /** 0..1: stretched thin (possessing). */
  stretch: number;
}

const base = (): WraithPose => ({ bob: 0, trail: 0, flutter: 0, swing: 0, lift: 0, blaze: 0.4, lean: 0, stretch: 0 });

// ---------------------------------------------------------------------------
// The body

/** The robe (or gown): from the shoulders down to a hem of ragged strips (or ruffles fading to mist). */
function robe(c: PixelCanvas, cx: number, top: number, hem: number, p: WraithPose, view: View): void {
  const side = view === 'side';
  const cala = L.calavera;
  const m = cala ? GOWN : ROBE;
  const edge = (y: number) => {
    const k = (y - top) / (hem - top);
    const hw = (side ? 4.5 : 5) + k * (side ? 3.5 : 3.5);
    // The side view streams back (to +x) the lower it goes.
    const back = side ? k * k * (2 + p.trail) : 0;
    return [cx - hw + back * 0.4, cx + hw + back] as [number, number];
  };
  c.shape(Math.round(top), Math.round(hem), (y) => edge(y), m, (_x, _y, t, u) => cyl(t, 0.25 - u * 0.45));
  // The hem: ragged strips, or mist.
  c.part();
  const [l, r] = edge(hem);
  for (let x = Math.round(l); x < r; x++) {
    const n = cala ? 4 : 2 + (((x * 7 + 3) % 5) + ((x + Math.round(p.flutter)) % 3));
    for (let i = 1; i <= n; i++) {
      const y = Math.round(hem + i);
      const drift = side ? Math.round((i / n) * (1 + p.trail * 0.5)) : Math.round(Math.sin(x * 0.7 + p.flutter) * (i / n));
      if (cala) {
        if ((x + y + Math.round(p.flutter)) % (i < 2 ? 2 : 3) === 0) c.px(x + drift, y, GOWN_MIST, { x: 0, y: 0, z: 1 });
      } else if (i < n || x % 2 === 0) c.px(x + drift, y, i > n - 2 ? MIST : ROBE, cyl(0, -0.3));
    }
  }
  c.part();
  if (cala) {
    // Embroidered flowers down the gown, and black lace ruffles.
    for (let y = Math.round(top + 3); y < hem; y += 3) {
      const [a, b] = edge(y);
      for (let x = Math.round(a + 1); x < b - 1; x += 3) {
        const k = (x * 5 + y * 3) % 7;
        if (k > 2) continue;
        c.px(x + ((y / 3) % 2), y, EMBROIDERY[k], { x: 0, y: 0, z: 1 });
      }
    }
    for (const fy of [Math.round(top + (hem - top) * 0.55), Math.round(hem - 1)]) {
      const [a, b] = edge(fy);
      for (let x = Math.round(a); x < b; x++) c.px(x, fy, LACE_BLACK, { x: 0, y: 0.3, z: 0.9 }, { bias: x % 2 });
    }
  } else if (!side) {
    // A frayed, faintly glowing hem-line and a seam down the front.
    for (let y = Math.round(top + 4); y < hem; y++) c.shade(Math.round(cx), y, -1);
    for (let x = Math.round(l); x < r; x++) if (x % 3 === 0) c.px(x, Math.round(hem), ROBE_EDGE, { x: 0, y: 0.3, z: 0.9 });
  }
}

/** A wide sleeve from the shoulder to the hand, a bony hand at its end. */
function sleeve(c: PixelCanvas, sx: number, sy: number, hx: number, hy: number): void {
  const m = L.calavera ? GOWN : ROBE;
  c.capsule(sx, sy, hx, hy - 1, 1.8, L.calavera ? 1.6 : 2.8, m);
  if (L.calavera) for (let a = -1; a <= 1; a++) c.px(Math.round(hx + a), Math.round(hy - 0.5), LACE_BLACK, { x: 0, y: -0.3, z: 0.9 });
  c.ellipse(hx, hy + 0.5, 1.1, 1.2, BONE);
}

/** The lantern hanging from the hand: an iron one with a soul-flame, or a paper one glowing gold. */
function lantern(c: PixelCanvas, hx: number, hy: number, p: WraithPose): { x: number; y: number } {
  const lx = hx + p.swing;
  const ly = hy + 4 - p.lift;
  c.part();
  // The chain (or string), link by link.
  const n = Math.max(1, Math.round(Math.hypot(lx - hx, ly - hy)));
  for (let i = 0; i <= n; i++) c.px(Math.round(hx + ((lx - hx) * i) / n), Math.round(hy + ((ly - hy) * i) / n), L.calavera ? INK : IRON, { x: 0, y: 0, z: 1 }, { bias: i % 2 });
  c.part();
  const glow = 0.5 + p.blaze * 0.5;
  if (L.calavera) {
    // A round paper lantern, ribbed, the light showing through its cut-outs.
    c.ellipse(lx, ly + 4, 3.4, 3.6, PAPER);
    c.part();
    for (const dy of [-2, 0, 2]) for (let x = Math.round(lx - 3); x <= lx + 2; x++) if ((x + dy) % 2 === 0) c.px(x, Math.round(ly + 4 + dy), GOLD_LIGHT, { x: 0, y: 0, z: 1 }, { glow });
    c.ellipse(lx, ly + 0.5, 1.6, 0.8, INK, { flatten: 0.5 });
    c.ellipse(lx, ly + 7.8, 1.4, 0.7, INK, { flatten: 0.5 });
    c.line(lx, ly + 8, lx, ly + 10, PETAL_PINK);
  } else {
    // An iron frame with a cap and a ring, a soul-flame in its panes.
    c.shape(Math.round(ly + 1), Math.round(ly + 7), () => [lx - 2.5, lx + 2.5], IRON, (_x, _y, t) => cyl(t, 0.2));
    c.part();
    for (let y = Math.round(ly + 2); y <= ly + 6; y++) for (let x = Math.round(lx - 1.5); x <= lx + 1; x++) c.px(x, y, GREEN_FLAME, sphere((x + 0.5 - lx) / 2, (y - ly - 4) / 3), { glow, bias: y < ly + 3.5 ? 1 : 0 });
    c.px(Math.round(lx - 0.5), Math.round(ly + 4), IRON);
    c.ellipse(lx, ly + 0.5, 3, 1, IRON, { flatten: 0.5 });
    c.ellipse(lx, ly + 7.5, 3, 0.9, IRON, { flatten: 0.5 });
  }
  // The flame's light on the air around it.
  const col: RGB = L.calavera ? [255, 210, 110] : [110, 255, 190];
  for (let a = 0; a < 12; a++) {
    const q = (a / 12) * Math.PI * 2;
    c.spark(lx + Math.cos(q) * 4.5, ly + 4 + Math.sin(q) * 4.5, col, 0.12 + p.blaze * 0.2);
  }
  return { x: lx, y: ly + 4 };
}

/** The hood: a pointed peak falling back, and inside, dark, two eye-lights. */
function hood(c: PixelCanvas, cx: number, cy: number, view: View, p: WraithPose): void {
  c.part();
  const side = view === 'side';
  c.ellipse(cx + (side ? 1 : 0), cy, side ? 4.8 : 5.4, 5.6, ROBE);
  // The peak, drooping back.
  c.capsule(cx + (side ? 2 : 0.5), cy - 4, cx + (side ? 5 : 1.5), cy - 8, 2.2, 0.6, ROBE);
  if (view === 'up') return;
  c.part();
  const ox = side ? cx - 2.5 : cx;
  c.ellipse(ox, cy + 0.5, side ? 2 : 3.4, 3.8, HOOD_DARK);
  const eyes = side ? [ox - 0.5] : [ox - 1.5, ox + 1.5];
  for (const ex of eyes) c.px(Math.round(ex), Math.round(cy), SOUL, { x: 0, y: 0, z: 1 }, { glow: 0.7 + p.blaze * 0.3 });
  // The hood's edge catching the light.
  for (let i = 0; i < 10; i++) {
    const a = Math.PI * 0.15 + (i / 9) * Math.PI * 0.7;
    if (side && Math.cos(a) > 0) continue;
    c.px(Math.round(ox + Math.cos(a + Math.PI) * (side ? 2.4 : 3.8)), Math.round(cy + 0.5 - Math.sin(a) * 4.2), ROBE_EDGE, { x: 0, y: 0.5, z: 0.8 });
  }
}

/** The Calavera's head: the painted skull, the marigold crown and the veil (behind, drawn first). */
function skull(c: PixelCanvas, cx: number, cy: number, view: View, p: WraithPose): void {
  const side = view === 'side';
  c.part();
  c.ellipse(cx + (side ? 0.5 : 0), cy + 0.2, side ? 3.8 : 4.3, 4.6, view === 'up' ? LACE_BLACK : SKULL);
  if (view !== 'up') {
    c.part();
    const eyes = side ? [cx - 1.8] : [cx - 1.8, cx + 1.8];
    for (const ex of eyes) {
      c.ellipse(ex, cy, 1.2, 1.4, INK);
      // Petals painted round the socket, pink and teal by turns.
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        c.px(Math.round(ex + Math.cos(a) * 2.2), Math.round(cy + Math.sin(a) * 2.2), i % 2 ? PETAL_TEAL : PETAL_PINK, { x: 0, y: 0, z: 1 });
      }
      c.px(Math.round(ex), Math.round(cy), GOLD_LIGHT, { x: 0, y: 0, z: 1 }, { glow: 0.5 + p.blaze * 0.5 });
    }
    // A heart for a nose, and a stitched smile.
    const nx = side ? cx - 3 : cx;
    c.px(Math.round(nx - 0.5), Math.round(cy + 2), INK);
    c.px(Math.round(nx + 0.5), Math.round(cy + 2), INK);
    c.px(Math.round(nx), Math.round(cy + 3), INK);
    const m0 = side ? cx - 3.5 : cx - 2.5;
    const m1 = side ? cx - 0.5 : cx + 2.5;
    for (let x = Math.round(m0); x <= m1; x++) {
      c.px(x, Math.round(cy + 4), INK);
      if (x % 2 === 0) c.px(x, Math.round(cy + 3.5), INK, { x: 0, y: 0, z: 1 }, { bias: 1 });
    }
  }
  // The marigold crown: blooms across the brow.
  c.part();
  const n = side ? 4 : 6;
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    const a = Math.PI * (1.05 + k * 0.9);
    const fx = cx + (side ? 0.8 : 0) + Math.cos(a) * (side ? 4.2 : 4.8);
    const fy = cy - 1 + Math.sin(a) * 4.8;
    c.ellipse(fx, fy, 1.4, 1.3, MARIGOLD);
    c.px(Math.round(fx), Math.round(fy), MARIGOLD, { x: 0, y: 0, z: 1 }, { bias: -2 });
  }
}

/** The black lace veil hanging from the crown behind her, down her back. */
function veil(c: PixelCanvas, cx: number, cy: number, view: View): void {
  c.part();
  const side = view === 'side';
  const bottom = cy + (view === 'up' ? 16 : 11);
  for (let y = Math.round(cy - 3); y <= bottom; y++) {
    const k = (y - cy + 3) / (bottom - cy + 3);
    const hw = 5 + k * 3;
    const x0 = side ? cx - 1 + k * 3 : cx - hw;
    const x1 = side ? cx + 5 + k * 4 : cx + hw;
    for (let x = Math.round(x0); x < x1; x++) {
      // Lace: a pattern of holes, and a scalloped edge.
      const hole = (x + y) % 3 === 0 && (x - y) % 2 === 0;
      if (hole || (y === Math.round(bottom) && x % 2)) continue;
      c.px(x, y, LACE_BLACK, { x: 0, y: 0.1, z: 1 });
    }
  }
}

function drawFigure(c: PixelCanvas, p: WraithPose, view: View): void {
  const side = view === 'side';
  const cala = L.calavera;
  const stretch = Math.round(p.stretch * 4);
  const top = 20 - p.bob - stretch;
  const hem = 38 - p.bob;
  const headY = top - 7 + stretch * 0.3;
  const cx = CX - (side ? p.lean : 0);
  const hx = side ? cx - 6 - p.lean : cx + 7;
  const hy = top + 10;

  // Behind: the veil; the lantern too when seen from behind (it's carried in front).
  if (cala && view !== 'down') veil(c, cx, headY, view);
  if (view === 'up') lantern(c, cx + 7, hy, p);
  if (side) {
    // The far sleeve.
    c.part();
    sleeve(c, cx + 1, top + 2, cx + 3, top + 9);
  }
  c.part();
  robe(c, cx + (side ? p.lean * 0.5 : 0), top, hem, p, view);
  if (cala && view === 'down') {
    // The veil's edges framing her face, falling to her shoulders.
    c.part();
    for (const s of [-1, 1]) c.capsule(cx + s * 4.5, headY + 1, cx + s * 5.5, top + 3, 1.2, 1.6, LACE_BLACK);
  }
  // Sleeves: the lantern hand out front and the other hanging.
  c.part();
  if (side) sleeve(c, cx - 1, top + 2, hx, hy);
  else {
    sleeve(c, cx - 5, top + 2, cx - 6.5, top + 9);
    sleeve(c, cx + 5, top + 2, hx, hy);
  }
  if (cala) skull(c, cx, headY, view, p);
  else hood(c, cx, headY, view, p);
  if (view !== 'up') lantern(c, hx, hy, p);
}

// ---------------------------------------------------------------------------
// Animations

export type WraithAnim = 'idle' | 'move' | 'swing' | 'possess' | 'cast';

interface AnimDef {
  name: WraithAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => WraithPose[];
}

const idle = (): WraithPose[] =>
  [0, 1, 2, 3].map((i) => {
    const p = base();
    p.bob = [0, 1, 1, 0][i];
    p.flutter = i;
    p.swing = [0, 1, 0, -1][i];
    return p;
  });

const move = (view: View): WraithPose[] =>
  [0, 1, 2, 3].map((i) => {
    const p = base();
    p.bob = [1, 2, 2, 1][i];
    p.flutter = i + 0.5;
    p.trail = view === 'side' ? 2 + (i % 2) : 0;
    p.lean = view === 'side' ? 1 : 0;
    p.swing = view === 'side' ? 2 : [1, 0, -1, 0][i];
    return p;
  });

/** The lantern swung: back, up and through in an arc, flaring as it comes round. */
const swing = (view: View): WraithPose[] =>
  [
    [4, 0, 0.4],
    [2, 4, 0.8],
    [-3, 3, 1],
    [-5, 0, 0.7],
  ].map(([s, l, b], i) => {
    const p = base();
    p.swing = view === 'side' ? -s : s;
    p.lift = l;
    p.blaze = b;
    p.bob = 1;
    p.flutter = i;
    p.lean = view === 'side' && i >= 2 ? 1 : 0;
    return p;
  });

/** Diving into a foe: pitched forward and stretched thin. */
const possess = (view: View): WraithPose[] =>
  [0.3, 0.7, 1, 1].map((k, i) => {
    const p = base();
    p.stretch = k;
    p.lean = view === 'side' ? Math.round(k * 3) : 0;
    p.trail = 4 * k;
    p.blaze = 1;
    p.lift = Math.round(k * 3);
    p.flutter = i;
    return p;
  });

/** Its Special's pose: rising, the lantern lifted high and blazing. */
const cast = (): WraithPose[] =>
  [0.3, 0.6, 1, 1, 1].map((k, i) => {
    const p = base();
    p.bob = Math.round(k * 3);
    p.lift = Math.round(k * 9);
    p.blaze = k;
    p.flutter = i;
    return p;
  });

export const WRAITH_ANIMS: AnimDef[] = [
  { name: 'idle', fps: 5, loop: true, poses: idle },
  { name: 'move', fps: 8, loop: true, poses: move },
  { name: 'swing', fps: 16, loop: false, poses: swing },
  { name: 'possess', fps: 14, loop: false, poses: possess },
  { name: 'cast', fps: 10, loop: false, poses: cast },
];

export interface WraithFrame {
  key: string;
  anim: WraithAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawFrame(dir: Dir, p: WraithPose): PixelCanvas {
  const c = new PixelCanvas(WRAITH_W, WRAITH_H);
  drawFigure(c, p, dir === 'left' || dir === 'right' ? 'side' : dir);
  return dir === 'right' ? c.mirrored() : c;
}

export function buildWraithFrames(look: WraithLook = WRAITH_LOOK): WraithFrame[] {
  L = look;
  const out: WraithFrame[] = [];
  for (const a of WRAITH_ANIMS) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, i) => out.push({ key: `${a.name}_${dir}_${i}`, anim: a.name, dir, canvas: drawFrame(dir, pose) }));
    }
  }
  L = WRAITH_LOOK;
  return out;
}

// ---------------------------------------------------------------------------
// The wisps: a soul-flame flickering (frames 0-3), or a marigold petal turning.

export const WISP_SIZE = 10;
export const WISP_FRAMES = 4;

export function wispFrame(f: number, petal: boolean): PixelCanvas {
  const c = new PixelCanvas(WISP_SIZE, WISP_SIZE);
  if (petal) {
    // A petal turning over: wide, edge-on, and back.
    const w = [2.6, 1.6, 0.8, 1.6][f];
    c.ellipse(5, 5, w, 2.4, MARIGOLD);
    c.part();
    c.px(5, 5, MARIGOLD, { x: 0, y: 0, z: 1 }, { bias: -1 });
    c.spark(5, 2, [255, 220, 120], 0.6);
    return c;
  }
  const lick = [0, 1, 0, -1][f];
  c.ellipse(5, 6.5, 2.4, 2.2, GREEN_FLAME);
  c.capsule(5, 6, 5 + lick, 2, 1.6, 0.4, GREEN_FLAME);
  c.part();
  c.ellipse(5, 6.5, 1, 1, GREEN_FLAME, { bias: 2 });
  return c;
}

// ---------------------------------------------------------------------------
// Icons

const WRAITH_TONES: Tones = [hex('#e0fff4'), hex('#7af0c0'), hex('#2ab888'), hex('#0e4a3a')];
const CALA_TONES: Tones = [hex('#fffbd0'), hex('#ffd860'), hex('#ff9a2a'), hex('#a0400a')];

/** The lantern's swing: a lantern at the end of its arc, wisps left behind it. */
export function lanternIcon(cala = false): Uint8ClampedArray {
  const t = cala ? CALA_TONES : WRAITH_TONES;
  const frame: RGB = cala ? hex('#ff62a8') : hex('#545a70');
  return icon16((put) => {
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * (0.1 + (i / 10) * 0.7);
      put(8 + Math.cos(a) * 7, 2 + Math.sin(a) * 7, t[3]);
    }
    seg(put, 8, 1, 11, 6, hex('#34384a'));
    for (let y = 7; y <= 12; y++) for (let x = 9; x <= 13; x++) put(x, y, x === 9 || x === 13 || y === 7 || y === 12 ? frame : y < 9 ? t[0] : t[1]);
    for (const [x, y] of [[3, 7], [2, 11], [5, 13]]) {
      put(x, y, t[1]);
      put(x, y - 1, t[2]);
    }
  });
}

/** Possess: a ghostly figure diving head-first into a dark shape. */
export function possessIcon(cala = false): Uint8ClampedArray {
  const t = cala ? CALA_TONES : WRAITH_TONES;
  return icon16((put) => {
    // The foe: a dark mound, its eyes lit by the ghost inside.
    for (let y = 8; y <= 15; y++) for (let x = 6; x <= 15; x++) if ((x - 10.5) ** 2 / 20 + (y - 13) ** 2 / 25 <= 1) put(x, y, hex('#2a2e3a'));
    put(9, 11, t[0]);
    put(12, 11, t[0]);
    // The ghost diving in, its trail streaming back.
    seg(put, 1, 1, 8, 8, t[2]);
    seg(put, 2, 1, 9, 8, t[1]);
    seg(put, 1, 2, 8, 9, t[1]);
    put(8, 8, t[0]);
    put(0, 3, t[3]);
    put(3, 0, t[3]);
  });
}

// ---------------------------------------------------------------------------
// A possessed foe wears a mark over its face: two soul-lights burning in it,
// or (for the Calavera) a little painted sugar skull. Frames 'w' and 'c'.

export const MARK_SIZE = 9;

export function possessMark(cala: boolean): PixelCanvas {
  const c = new PixelCanvas(MARK_SIZE, MARK_SIZE);
  if (cala) {
    c.ellipse(4.5, 4.5, 3.6, 3.8, SKULL);
    c.part();
    for (const ex of [3, 6]) {
      c.px(ex, 4, INK);
      c.px(ex - 1, 3, PETAL_PINK);
      c.px(ex + 1, 3, PETAL_TEAL);
    }
    c.px(4, 6, INK);
    c.px(5, 6, INK);
    c.px(4, 7, INK, { x: 0, y: 0, z: 1 }, { bias: 1 });
    return c;
  }
  for (const ex of [3, 6]) {
    c.px(ex, 4, SOUL);
    c.px(ex, 5, SOUL, { x: 0, y: -0.5, z: 0.8 });
    c.spark(ex, 3, [110, 255, 190], 0.6);
  }
  return c;
}

/**
 * The dark of the Dead of Night: black, with a soft round hole of light in
 * the middle (where the lantern is), `size` square. Alpha only.
 */
export function nightHole(size = 128): Uint8ClampedArray {
  const px = new Uint8ClampedArray(size * size * 4);
  const m = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - m, y + 0.5 - m) / m;
      const a = Math.min(1, Math.max(0, (d - 0.16) / 0.3));
      px.set([0, 0, 0, Math.round(a * a * (3 - 2 * a) * 255)], (y * size + x) * 4);
    }
  }
  return px;
}
