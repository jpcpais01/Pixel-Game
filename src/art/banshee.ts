// The Banshee (the Phantom's third type): a gaunt keening spirit woman
// floating over the ground. Very long white hair streams up and back from her
// head as if she drifted under water; a tattered grey-blue shroud hangs from
// her thin shoulders and comes apart into strips and wisps at its hem; her
// face is long and hollow-cheeked, her eyes two dark hollows with a pin of
// cold light in each, and her mouth opens into a black wail. Her hands are
// thin and pale, the fingers long.
//
// Her Ghost Bride skin is a jilted bride on the same drift: a long ivory
// gown, torn and ragged at the hem and trailing a train, lace sleeves, a
// pearl necklace, a sheer veil streaming from a pearl circlet, silver-lilac
// hair, and a wilted bouquet of blue roses that sheds its petals.
//
// Also here: the button icons.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB } from './pixel';
import { DIRS, type Dir } from './wizard';
import { icon16, seg, type Tones } from './druid';

const ramp = (...c: string[]): RGB[] => c.map(hex);

export const BANSHEE_W = 48;
export const BANSHEE_H = 54;
/** Drawn in the 24x32 body box every hero uses, placed in a larger frame (room above for the hair). */
const BODY_X = 12;
const BODY_Y = 16;
export const BANSHEE_ORIGIN_X = BODY_X + 12;
export const BANSHEE_ORIGIN_Y = BODY_Y + 31;
/** The body's middle above the ground. */
export const BANSHEE_CHEST_Y = 15;
/** Her mouth above the ground, where the keen comes from. */
export const BANSHEE_MOUTH_Y = 21;

// ---------------------------------------------------------------------------
// Materials

const SKIN: Material = { ramp: ramp('#323c56', '#505e80', '#7484a8', '#96a6c8', '#b4c2de'), outline: hex('#0a0e18'), outlineLit: hex('#141a28'), emissive: 0.16 };
const HAIR: Material = { ramp: ramp('#5e6a86', '#8a98b4', '#b6c2da', '#dce4f4', '#f8fbff'), outline: hex('#161c2a'), outlineLit: hex('#222a3c'), emissive: 0.18 };
const SHROUD: Material = { ramp: ramp('#161c28', '#262f40', '#384558', '#4e5e76', '#687a94'), outline: hex('#06080d'), outlineLit: hex('#0e121b') };
const SHROUD_MIST: Material = { ramp: ramp('#34445e', '#61789a', '#98aed0'), outline: hex('#141c2a'), emissive: 0.4, noAO: true, noOutline: true };
const SLEEVE: Material = { ramp: ramp('#2c3646', '#465468', '#64768e', '#8a9cb4', '#b0c0d4'), outline: hex('#06080d'), outlineLit: hex('#10141e') };
const VOID: Material = { ramp: ramp('#020308', '#070912', '#10141f'), outline: hex('#010104'), noAO: true };
const SILVER: Material = { ramp: ramp('#4a5062', '#868ea4', '#c4cad8', '#f4f6ff'), outline: hex('#141822'), shine: true };

// The Ghost Bride.
const BRIDE_SKIN: Material = { ramp: ramp('#4a4262', '#786e96', '#aca2c8', '#d8d0ee', '#f6f2ff'), outline: hex('#16121f'), outlineLit: hex('#221c30'), emissive: 0.14 };
const BRIDE_HAIR: Material = { ramp: ramp('#110c10', '#1f171c', '#33282e', '#4a3c42', '#64545a'), outline: hex('#060406'), outlineLit: hex('#0e0a0c'), emissive: 0.04 };
const GOWN: Material = { ramp: ramp('#4a4664', '#77749a', '#a8a6c8', '#d6d6ec', '#f6f6ff'), outline: hex('#15142a'), outlineLit: hex('#211f38'), emissive: 0.08 };
const GOWN_MIST: Material = { ramp: ramp('#4e4a78', '#8480b4', '#c0bce6'), outline: hex('#1e1c34'), emissive: 0.45, noAO: true, noOutline: true };
const LACE: Material = { ramp: ramp('#686888', '#9c9cc0', '#d0d0ec', '#f4f4ff'), outline: hex('#1c1c34'), emissive: 0.12 };
const VEIL: Material = { ramp: ramp('#6a6e9a', '#a2a8d0', '#d4d8f4', '#f4f6ff'), outline: hex('#24284a'), emissive: 0.35, noAO: true, noOutline: true };
const PEARL: Material = { ramp: ramp('#8a8698', '#cfccdc', '#ffffff'), outline: hex('#28263a'), shine: true, noAO: true };
const ROSE: Material = { ramp: ramp('#141a46', '#25307a', '#3c52b4', '#6a86e0', '#a4bcff'), outline: hex('#070a1e'), emissive: 0.12 };
const ROSE_WILT: Material = { ramp: ramp('#1c1a3a', '#34325e', '#545286'), outline: hex('#08081a'), noAO: true };
const STEM: Material = { ramp: ramp('#14281e', '#264434', '#3e6248'), outline: hex('#060e0a') };

const EYE_GLINT: RGB = [170, 200, 255];
const BRIDE_GLINT: RGB = [200, 180, 255];
const PETAL_GLOW: RGB = [120, 150, 255];

export interface BansheeLook {
  key: string;
  bride: boolean;
}

export const BANSHEE_LOOK: BansheeLook = { key: 'weeper', bride: false };
export const BRIDE_LOOK: BansheeLook = { key: 'weeper_bride', bride: true };
export const BANSHEE_LOOKS = [BANSHEE_LOOK, BRIDE_LOOK];

let L: BansheeLook = BANSHEE_LOOK;

type View = 'down' | 'up' | 'side';

interface Pt {
  x: number;
  y: number;
}

export interface BansheePose {
  /** Floated up (+) or sunk. */
  bob: number;
  /** The phase of the hair's and the tatters' slow underwater drift. */
  wave: number;
  /** 0..1: how hard the hair is blown up and back (1: wild, the wail). */
  flow: number;
  /** 0..1: streaming straight back behind her as she drifts along. */
  stream: number;
  /** 0 shut, 0.5 parted, 1 thrown wide in a wail. */
  mouth: number;
  /** A soft little hum: a small round mouth. */
  hum: boolean;
  /** Hands, relative to where they hang. */
  handA: Pt;
  handB: Pt;
  /** Leaning into her drift (side view), px. */
  lean: number;
  /** The head tipped this many px to one side (combing her hair). */
  tilt: number;
  /** The head thrown back (the shriek): drawn a px up, the face foreshortened. */
  back: boolean;
  /** Shaking: the whole figure jitters this many px. */
  shake: number;
  /** 0..1: the cold light in her eye-hollows. */
  glare: number;
  /** The idle moment: the silver comb in her hand; both hands over her face. */
  comb: boolean;
  cover: boolean;
  /** The Bride's petals falling from the bouquet, 0 none. */
  shed: number;
}

const base = (): BansheePose => ({
  bob: 0,
  wave: 0,
  flow: 0.25,
  stream: 0,
  mouth: 0,
  hum: false,
  handA: { x: 0, y: 0 },
  handB: { x: 0, y: 0 },
  lean: 0,
  tilt: 0,
  back: false,
  shake: 0,
  glare: 0.4,
  comb: false,
  cover: false,
  shed: 0,
});

/** A steady 0..1 per pixel. */
const hash = (x: number, y: number): number => {
  const h = Math.imul(Math.round(x) * 374761393 + Math.round(y) * 668265263, 1274126177) >>> 0;
  return (((h ^ (h >>> 13)) >>> 0) % 1000) / 1000;
};

const skin = (): Material => (L.bride ? BRIDE_SKIN : SKIN);
const hairM = (): Material => (L.bride ? BRIDE_HAIR : HAIR);

// ---------------------------------------------------------------------------
// The hair (body-box coordinates: 24 wide, the ground at y 31; she floats).
// It hangs long, past her shoulders and down her back, but its ends lift and
// drift sideways as if she were under water, more the wilder she is.

/**
 * A lock hanging from (x, y), `len` long: it falls, its end drifting out to
 * `side` by `drift` and lifting by `lift`, waving gently along the way, and
 * thins to a point. A lighter strand runs down it.
 */
function hangLock(c: PixelCanvas, x: number, y: number, len: number, r0: number, side: number, drift: number, lift: number, phase: number, m: Material, bias = 0): void {
  const n = Math.max(3, Math.ceil(len / 1.2));
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({ x: x + side * drift * t * t + Math.sin(t * 3 + phase) * 0.6 * t, y: y + len * t - lift * t * t * t });
  }
  for (let i = 1; i <= n; i++) {
    const r1 = r0 * (1 - Math.pow((i - 1) / n, 1.2) * 0.8);
    const r2 = r0 * (1 - Math.pow(i / n, 1.2) * 0.8);
    c.capsule(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, r1, r2, m, { bias });
  }
  if (r0 < 1.2) return;
  for (let i = 1; i < n - 1; i++) c.px(pts[i].x - 0.4, pts[i].y, m, sphere(-0.3, 0.3), { bias: bias + 1 });
}

/**
 * The hair from the front or behind: a long fall from the crown down past her
 * shoulders, swaying as one, its strands grooved in shadow, its ends parting
 * into locks that lift and drift out to the sides.
 */
function hairFall(c: PixelCanvas, hx: number, headY: number, bot: number, p: BansheePose, back: boolean): void {
  const m = hairM();
  const sway = Math.sin(p.wave * 1.1) * 0.7;
  const top = headY - 3.6;
  const at = (y: number) => {
    const k = Math.max(0, (y - headY) / (bot - headY));
    return sway * k * k;
  };
  const half = (y: number) => {
    const d = y + 0.5 - headY;
    if (d < 0) return Math.sqrt(Math.max(0, 3.6 * 3.6 - d * d * 1.05));
    // Close round her head and neck, then spreading out as it falls, its edges rippling.
    const k = Math.max(0, d - 3);
    return 3.6 + Math.min(back ? 1.8 : 2.8, k * k * 0.03 + k * 0.12) + Math.sin(d * 0.7 + p.wave * 1.1) * 0.35 * Math.min(1, k / 4);
  };
  c.part();
  c.shape(Math.round(top), Math.round(bot), (y) => [hx - half(y) + at(y), hx + half(y) + at(y)], m, (_x, y, t) => sphere(t * 0.85, y < headY ? -0.45 : 0.05, 1), { bias: -1 });
  // Grooves of shadow parting the strands, and a sheen near the crown.
  for (let y = Math.round(headY - 1); y <= bot; y++) {
    const s = 1 + (y - headY) * 0.045;
    for (const g of [-2.7, -0.9, 0.9, 2.7]) c.shade(hx + g * s + at(y) + Math.sin(y * 0.5 + g) * 0.3, y, -1);
  }
  for (let y = Math.round(top + 1); y <= headY + (back ? 6 : 1); y++) for (const g of [-1.8, 1.8]) c.shade(hx + g + at(y), y, 1);
  // The ends: locks parting off the bottom, the outer ones drifting and lifting furthest.
  c.part();
  const xs = [-4.4, -2.6, -0.9, 0.9, 2.6, 4.4];
  xs.forEach((dx, i) => {
    const side = dx < 0 ? -1 : 1;
    const out = Math.abs(dx) / 4.4;
    const len = 4 + hash(i, 3) * 2.5 + (1 - out) * 1.5;
    hangLock(c, hx + dx * 0.9 + at(bot), bot - 1.5, len, 1.4, side, 0.6 + out * (1.2 + p.flow * 3.4) + side * sway * 0.4, p.flow * (1 + out * 3), p.wave * 1.1 + i, m, back ? 0 : -1);
  });
}

/** The crown over her brow, parted in the middle, and a long lock either side of her face, falling over her shoulders. */
function hairFront(c: PixelCanvas, hx: number, headY: number, sh: number, p: BansheePose): void {
  const m = hairM();
  c.part();
  // The crown, parted, swept down either side of her brow to the temples.
  const top = Math.round(headY - 3.6);
  for (let y = top; y <= headY; y++) {
    const d = y + 0.5 - headY;
    const hw = Math.sqrt(Math.max(0, 3.6 * 3.6 - d * d * 1.05)) + (d > -1.5 ? 0.4 : 0);
    for (let x = Math.floor(hx - hw); x < hx + hw; x++) {
      const t = (x + 0.5 - hx) / hw;
      // Below the crown the brow shows between the two sweeps.
      if (y + 0.5 > headY - 2.3 && Math.abs(x + 0.5 - hx) < 2.6 - (y + 0.5 - headY + 2.3) * 0.5) continue;
      c.px(x, y, m, sphere(t * 0.8, -0.55, 1));
    }
  }
  c.shade(hx - 0.5, top, -1);
  c.shade(hx - 0.5, top + 1, -1);
  c.part();
  for (const s of [-1, 1]) {
    hangLock(c, hx + s * 3, headY - 0.5, sh + 4.5 - headY, 1.35, s, 1.6 + p.flow * 3, p.flow * 4, p.wave * 1.1 + (s < 0 ? 0 : 1.4), m);
  }
}

/** In profile (facing left): the hair falls from the back of her head down her back, its length streaming out behind her. */
function hairSide(c: PixelCanvas, hx: number, headY: number, sh: number, p: BansheePose): void {
  const m = hairM();
  const back = 2 + p.stream * 3.5 + p.flow * 2;
  c.part();
  c.capsule(hx + 1.6, headY - 0.6, hx + 2.6 + back * 0.35, sh + 3, 2.6, 1.9, m, { bias: -1 });
  for (let i = 0; i < 4; i++) {
    hangLock(c, hx + 1.8 + i * 0.5, headY - 2.2 + i * 1.3, 16 - i * 1.5, 2.1 - i * 0.15, 1, back + i * 0.6, p.flow * 2.5 + p.stream * 1.5 + i * 0.3, p.wave * 1.1 + i * 0.8, m, i % 2 ? -1 : 0);
  }
}

/** The hair over the top and back of her head in profile, leaving her face clear. */
function capSide(c: PixelCanvas, hx: number, headY: number): void {
  const m = hairM();
  c.part();
  const cx = hx + 0.9;
  const cy = headY - 1;
  for (let y = Math.floor(cy - 3); y <= cy + 3; y++) {
    for (let x = Math.floor(cx - 3); x <= cx + 3; x++) {
      const dx = (x + 0.5 - cx) / 2.8;
      const dy = (y + 0.5 - cy) / 2.8;
      if (dx * dx + dy * dy > 1) continue;
      // The face stays clear: forward of the ear only the crown is hair.
      if (x + 0.5 < hx + 0.7 && y + 0.5 > headY - 2) continue;
      c.px(x, y, m, sphere(dx * 0.8, dy * 0.8, 1));
    }
  }
  // A lock falling behind her ear.
  c.shade(hx + 0.5, headY + 0.5, -1);
}

// ---------------------------------------------------------------------------
// The face

function face(c: PixelCanvas, hx: number, headY: number, p: BansheePose, view: View): void {
  const sk = skin();
  const glint = L.bride ? BRIDE_GLINT : EYE_GLINT;
  const jaw = p.mouth > 0.5 ? 1 : 0;
  c.part();
  if (view === 'side') {
    // The skull, a sharp brow, nose and chin in profile.
    c.ellipse(hx, headY, 2.6, 3 + jaw * 0.4, sk, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.75, 1) });
    c.part();
    c.px(Math.round(hx - 3.1), Math.round(headY - 1.2), sk, sphere(-0.6, 0.5));
    c.px(Math.round(hx - 3.4), Math.round(headY + 0.3), sk, sphere(-0.8, 0.1));
    c.px(Math.round(hx - 3.4), Math.round(headY - 0.5), sk, sphere(-0.8, 0.3));
    c.px(Math.round(hx - 2.4), Math.round(headY + 3 + jaw), sk, sphere(-0.4, -0.6));
    c.part();
    const ex = Math.round(hx - 1.8);
    const ey = Math.round(headY - 0.7);
    c.px(ex, ey, VOID);
    c.px(ex, ey + 1, VOID);
    c.shade(ex + 1, ey - 1, -1);
    c.spark(ex, ey + 1, glint, 0.35 + p.glare * 0.55);
    c.shade(Math.round(hx - 0.8), Math.round(headY + 1.4), -1);
    const my = Math.round(headY + 1.6);
    if (p.hum) c.px(Math.round(hx - 2.6), my, VOID);
    else if (p.mouth < 0.2) c.px(Math.round(hx - 2.6), my, VOID, { x: 0, y: 0.3, z: 1 });
    else {
      const h = Math.round(1 + p.mouth * 1.6);
      for (let y = my; y < my + h; y++) {
        c.erase(Math.round(hx - 3.2), y);
        c.px(Math.round(hx - 2.6), y, VOID);
      }
    }
    return;
  }
  // Facing the viewer: a long gaunt face.
  const fy = headY + 0.3 + (p.back ? -0.4 : 0);
  c.ellipse(hx, fy, 2.6, 3.1 + jaw * 0.4, sk, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.7, 1) });
  c.part();
  // Hollow eyes: dark pits under a shadowed brow, a faint glowing pupil in each.
  const ey = Math.round(fy - 1.1);
  for (const ex of [Math.round(hx - 1.6), Math.round(hx + 1.1)]) {
    c.px(ex, ey, VOID);
    c.px(ex, ey + 1, VOID);
    c.shade(ex, ey - 1, -1);
    if (!p.cover) c.spark(ex, ey + 1, glint, 0.35 + p.glare * 0.6);
  }
  // Cheek hollows under the bones.
  for (const x of [Math.round(hx - 2.2), Math.round(hx + 1.6)]) {
    c.shade(x, Math.round(fy + 1), -1);
    c.shade(x, Math.round(fy + 2), -1);
  }
  // The mouth: a thin line, a soft hum, or a dark O.
  const my = Math.round(fy + 1.6);
  if (p.hum) c.px(Math.round(hx - 0.5), my + 0.5, VOID);
  else if (p.mouth < 0.2) {
    c.px(Math.round(hx - 1), my + 1, VOID, { x: 0, y: 0.3, z: 1 });
    c.px(Math.round(hx), my + 1, VOID, { x: 0, y: 0.3, z: 1 });
  } else {
    const h = p.mouth > 0.6 ? 3 : 2;
    for (let y = my; y < my + h; y++) {
      c.px(Math.round(hx - 1), y, VOID);
      c.px(Math.round(hx), y, VOID);
    }
    // The O's rim, a shade round it.
    c.shade(Math.round(hx - 2), my + 1, -1);
    c.shade(Math.round(hx + 1), my + 1, -1);
  }
}

// ---------------------------------------------------------------------------
// The body

/** The shroud: thin shoulders, draped cloth narrowing a little at the waist, then falling to a hem torn into ragged points. */
function shroud(c: PixelCanvas, cx: number, sh: number, hem: number, p: BansheePose, view: View): void {
  const side = view === 'side';
  const edge = (y: number): [number, number] => {
    const u = (y - sh) / (hem - sh);
    let hw = u < 0.4 ? 3 - u * 0.6 : 2.76 + Math.pow((u - 0.4) / 0.6, 1.3) * 2.3;
    if (y < sh + 0.6) hw -= 0.7;
    if (side) hw *= 0.82;
    const back = side ? u * u * (1 + p.stream * 2.5) : 0;
    return [cx - hw + back * 0.2, cx + hw + back];
  };
  c.part();
  c.shape(Math.round(sh), Math.round(hem), edge, SHROUD, (_x, y, t) => sphere(t * 0.9, 0.35 - ((y - sh) / (hem - sh)) * 0.7, 1));
  // The neckline's fold, and folds falling from the waist.
  if (!side) {
    c.shade(cx - 1.5, sh, -1);
    c.shade(cx - 0.5, sh + 1, -1);
    c.shade(cx + 0.5, sh, -1);
  }
  for (let y = Math.round(sh + 5); y <= hem; y++) {
    const u = (y - sh) / (hem - sh);
    const sway = Math.sin(p.wave * 1.1 + y * 0.4) * 0.4;
    c.shade(cx - 1.4 - u * 1.4 + sway, y, -1);
    if (!side) {
      c.shade(cx + 1.2 + u * 1.4 + sway, y, -1);
      c.shade(cx - 0.2 + sway, y, 1);
    } else c.shade(cx + 0.6 + u * 1.4, y, -1);
  }
  // A cord at the waist.
  c.part();
  const wy = Math.round(sh + 4.5);
  const [wl, wr] = edge(wy);
  for (let x = Math.round(wl); x < wr; x++) c.px(x, wy, SLEEVE, sphere((x + 0.5 - cx) / 4, 0.3), { bias: -1 });
  // The hem: ragged points in a broken rhythm, their tips gone to mist.
  c.part();
  const [l, r] = edge(hem);
  const shift = Math.round(p.wave * 0.7);
  for (let x = Math.round(l); x < r; x++) {
    const k = (((x + shift) % 3) + 3) % 3;
    const n = [1, 3, 2][k] + (hash(x, 5) > 0.6 ? 1 : 0);
    for (let i = 1; i <= n; i++) {
      const drift = side ? Math.round((i / n) * (0.4 + p.stream * 1.5)) : Math.round(Math.sin(x * 0.9 + p.wave * 1.2) * (i / 3) * 0.7);
      c.px(x + drift, Math.round(hem + i), i === n && n > 1 ? SHROUD_MIST : SHROUD, sphere(0, -0.3));
    }
    if (n >= 3 && (x + shift) % 2 === 0) c.px(x + (side ? 1 : 0), Math.round(hem + n + 1), SHROUD_MIST, { x: 0, y: 0, z: 1 });
  }
}

/** The Bride's gown: bare shoulders over a fitted bodice and a waist, then a full ivory skirt in soft folds, its hem scalloped and torn in places, a train behind. */
function gown(c: PixelCanvas, cx: number, sh: number, hem: number, p: BansheePose, view: View): void {
  const side = view === 'side';
  const waist = sh + 4.6;
  const sk = skin();
  c.part();
  c.shape(Math.round(sh), Math.round(sh + 1), (y) => (y < sh + 0.6 ? [cx - (side ? 1.6 : 2.4), cx + (side ? 1.6 : 2.4)] : [cx - (side ? 2 : 3), cx + (side ? 2 : 3)]), sk, (_x, _y, t) => cyl(t, 0.4));
  c.part();
  c.shape(Math.round(sh + 1.5), Math.round(waist), (y) => {
    const k = (y - sh - 1.5) / (waist - sh - 1.5);
    const hw = (side ? 2.1 : 2.9) - k * (side ? 0.3 : 0.9);
    return [cx - hw, cx + hw];
  }, GOWN, (_x, _y, t) => cyl(t, 0.3));
  if (!side) {
    // The sweetheart neckline's dip, and the bodice's seams.
    c.px(Math.round(cx - 0.5), Math.round(sh + 1.5), sk, { x: 0, y: 0.2, z: 1 });
    c.shade(cx - 1.5, sh + 3, -1);
    c.shade(cx + 0.5, sh + 3, -1);
  }
  // The skirt, flaring from the waist, its train sweeping back in profile.
  c.part();
  const train = side ? 3.5 + p.stream * 3 : 0;
  const edge = (y: number): [number, number] => {
    const u = (y - waist) / (hem + 1 - waist);
    const hw = (side ? 1.9 : 2.1) + Math.pow(u, 1.1) * (side ? 3.2 : 4.4);
    return [cx - hw, cx + hw + u * u * train];
  };
  c.shape(Math.round(waist + 1), Math.round(hem + 1), edge, GOWN, (_x, y, t) => sphere(t * 0.9, 0.3 - ((y - waist) / (hem - waist)) * 0.6, 1));
  // Soft folds: shadowed valleys and lit ridges falling from the waist.
  for (let y = Math.round(waist + 2); y <= hem + 1; y++) {
    const u = (y - waist) / (hem + 1 - waist);
    const sway = Math.sin(p.wave * 1.1 + y * 0.35) * 0.4;
    for (const f of side ? [-0.6, 0.8] : [-2.4, -0.8, 0.8, 2.4]) {
      const x = cx + f * (0.8 + u * 1.1) + sway;
      c.shade(x, y, -1);
      if (u > 0.2) c.shade(x + (f < 0 ? -1 : 1), y, 1);
    }
  }
  // A lace sash at the waist.
  c.part();
  const [wl, wr] = edge(waist + 1);
  for (let x = Math.round(wl); x < wr; x++) c.px(x, Math.round(waist + 1), LACE, sphere((x + 0.5 - cx) / 4, 0.3), { bias: x % 2 ? 0 : 1 });
  // The hem: a lace band, scalloped, torn through at two places.
  c.part();
  const [l, r] = edge(hem + 1);
  const tears = side ? [Math.round(cx + 2)] : [Math.round(cx - 3), Math.round(cx + 2)];
  for (let x = Math.round(l); x < r; x++) {
    if (tears.includes(x)) {
      c.erase(x, Math.round(hem + 1));
      c.px(x, Math.round(hem + 2), GOWN_MIST, { x: 0, y: 0, z: 1 });
      continue;
    }
    c.px(x, Math.round(hem + 1), LACE, sphere(0, -0.2));
    if ((x + Math.round(p.wave * 0.5)) % 3 === 0) c.px(x, Math.round(hem + 2), LACE, sphere(0, -0.5), { bias: -1 });
  }
}

/** The pearl necklace at the base of her throat. */
function pearls(c: PixelCanvas, cx: number, sh: number, view: View): void {
  c.part();
  if (view === 'side') {
    for (const [dx, dy] of [[-1.6, 0], [-0.6, 0.6], [0.4, 0.6]] as const) c.px(Math.round(cx + dx), Math.round(sh + dy), PEARL, sphere(-0.3, 0.5));
    return;
  }
  for (let i = -2; i <= 2; i++) c.px(Math.round(cx - 0.5 + i), Math.round(sh + 0.2 + (2 - Math.abs(i)) * 0.35), PEARL, sphere(i * 0.2, 0.5), { bias: i === -1 ? 1 : 0 });
  c.px(Math.round(cx - 0.5), Math.round(sh + 1.6), PEARL, sphere(0, 0.4), { bias: 1 });
}

/**
 * The veil: sheer, from the pearl circlet down behind her shoulders (out
 * behind her in profile). It is drawn dim and solid behind her dark hair;
 * from behind it lies over the hair, which shows through it darker.
 */
function veil(c: PixelCanvas, hx: number, headY: number, hem: number, p: BansheePose, view: View): void {
  c.part();
  const sway = Math.sin(p.wave * 1.1) * 0.6;
  if (view === 'side') {
    const top = Math.round(headY - 3.2);
    const bot = Math.round(hem - 2);
    for (let y = top; y <= bot; y++) {
      const u = (y - top) / (bot - top);
      const x0 = hx + 1.2 + u * 2.2;
      const len = 3 + u * (6 + p.stream * 5 + p.flow * 3) + Math.sin(u * 5 + p.wave * 1.2) * 1;
      for (let x = Math.round(x0); x < x0 + len; x++) {
        const edgeX = x >= Math.round(x0 + len - 1);
        c.px(x, y + Math.round(Math.sin((x - x0) * 0.5 + p.wave) * 0.6 * u), VEIL, { x: 0.2, y: 0.1, z: 1 }, { bias: edgeX ? 1 : -1 });
      }
    }
    return;
  }
  const over = view === 'up';
  const top = Math.round(headY - 3.4);
  const bot = Math.round(hem - (over ? 1 : 3));
  const hairMat = hairM();
  for (let y = top; y <= bot; y++) {
    const u = (y - top) / (bot - top);
    const hw = 3.9 + u * 3.2;
    const off = sway * u * u;
    for (let x = Math.round(hx - hw + off); x < hx + hw + off; x++) {
      const rim = x === Math.round(hx - hw + off) || x + 1 >= hx + hw + off || y === bot;
      // From behind it is sheer: over her hair and gown it only lifts them a shade, so both read through it.
      if (over && !rim && c.materialAt(x, y)) {
        if (c.materialAt(x, y) === hairMat) c.shade(x, y, 1);
        continue;
      }
      c.px(x, y, rim ? LACE : VEIL, { x: (x + 0.5 - hx) / 12, y: 0.25 - u * 0.4, z: 1 }, { bias: rim ? 0 : -1 });
    }
  }
}
/** The pearl circlet the veil hangs from, a little blue rose at its side. */
function circlet(c: PixelCanvas, hx: number, headY: number, view: View): void {
  c.part();
  if (view === 'side') {
    for (let i = 0; i < 4; i++) c.px(Math.round(hx - 1 + i), Math.round(headY - 3.2 + i * 0.4), PEARL, sphere(0, 0.6));
    c.ellipse(hx + 2.2, headY - 2.4, 1, 1, ROSE);
    return;
  }
  for (let i = -3; i <= 2; i++) c.px(Math.round(hx + i), Math.round(headY - 3.4 + Math.abs(i + 0.5) * 0.3), PEARL, sphere(i * 0.2, 0.6), { bias: i === -1 ? 1 : 0 });
  if (view === 'down') {
    c.part();
    c.ellipse(hx - 3.3, headY - 2.3, 1.1, 1, ROSE);
    c.px(Math.round(hx - 3.6), Math.round(headY - 2.6), ROSE, sphere(-0.3, 0.6), { bias: 1 });
  }
}

/** The wilted bouquet in her hand: blue roses, one hung on a bent stem, a lace ribbon, falling petals. */
function bouquet(c: PixelCanvas, hx: number, hy: number, p: BansheePose): void {
  c.part();
  // The stems down below her fist, and the ribbon's tails.
  c.line(hx - 0.5, hy + 0.5, hx - 1, hy + 3.5, STEM);
  c.line(hx + 0.5, hy + 0.5, hx + 0.5, hy + 3.2, STEM);
  c.px(Math.round(hx + 1), Math.round(hy + 2.5), LACE, sphere(0.3, 0.2));
  c.px(Math.round(hx + 1.5), Math.round(hy + 3.5), LACE, sphere(0.3, 0.2));
  c.part();
  for (const [dx, dy, r] of [[-1.3, -1.6, 1.25], [1.1, -1.8, 1.2], [0, -2.9, 1.15]] as const) {
    c.ellipse(hx + dx, hy + dy, r, r * 0.9, ROSE, { normal: (_x, _y, ndx, ndy) => sphere(ndx * 0.8, ndy * 0.8, 1) });
    // The curl of the petals.
    c.px(Math.round(hx + dx - 0.3), Math.round(hy + dy - 0.3), ROSE, sphere(-0.3, 0.5), { bias: -1 });
  }
  // The wilted one, hanging its head on a bent stem.
  c.part();
  c.line(hx + 1.5, hy - 0.8, hx + 2.6, hy + 0.4, STEM);
  c.ellipse(hx + 2.8, hy + 1.3, 0.9, 1.1, ROSE_WILT);
  c.px(Math.round(hx - 2.4), Math.round(hy - 0.4), STEM, sphere(-0.4, 0.2));
  // Petals drifting down from it.
  for (let i = 0; i < p.shed; i++) {
    const x = hx + 2.6 + Math.sin(i * 2.1 + p.wave) * 1.8;
    const y = hy + 3 + i * 2.2;
    c.px(Math.round(x), Math.round(y), ROSE, { x: 0, y: 0.3, z: 0.9 }, { glow: 0.3 });
    c.spark(x, y, PETAL_GLOW, 0.3);
  }
}

/** The silver comb in her hand. */
function comb(c: PixelCanvas, hx: number, hy: number): void {
  c.part();
  c.shape(Math.round(hy - 2), Math.round(hy - 1), () => [hx - 0.5, hx + 2.5], SILVER, (_x, _y, t) => cyl(t, 0.6));
  for (let x = Math.round(hx - 0.5); x < hx + 2.5; x += 1) if (x % 2 === 0) c.px(x, Math.round(hy), SILVER, sphere(0, -0.2), { bias: -1 });
  c.spark(hx + 1.5, hy - 2, [230, 240, 255], 0.5);
}

/** A thin pale hand with long fingers, reaching on the way the forearm points. */
function hand(c: PixelCanvas, hx: number, hy: number, ex: number, ey: number): void {
  const sk = skin();
  c.part();
  c.ellipse(hx, hy + 0.2, 0.85, 0.9, sk);
  const dx = hx - ex;
  const dy = hy - ey;
  const l = Math.hypot(dx, dy) || 1;
  c.line(hx + (dx / l) * 1, hy + (dy / l) * 1 + 0.3, hx + (dx / l) * 2.3, hy + (dy / l) * 2.3 + 0.5, sk);
}

/** Where an arm's elbow bends, between the shoulder and the hand. */
const elbow = (sx: number, sy: number, hx: number, hy: number, out: number): Pt => ({ x: (sx + hx) / 2 + out * 0.8, y: (sy + hy) / 2 + 0.3 });

/**
 * An arm from the shoulder (sx, sy) to the hand: a long sleeve widening to a
 * ragged bell cuff at the wrist (the Bride's is lace), and the hand out of it.
 */
function arm(c: PixelCanvas, sx: number, sy: number, hx: number, hy: number, out: number): void {
  const e = elbow(sx, sy, hx, hy, out);
  const m = L.bride ? LACE : SLEEVE;
  c.part();
  c.capsule(sx, sy, e.x, e.y, 1.1, 1.1, m);
  // Toward the wrist the sleeve widens and its cuff hangs in rags.
  const wx = e.x + (hx - e.x) * 0.75;
  const wy = e.y + (hy - e.y) * 0.75;
  c.capsule(e.x, e.y, wx, wy, 1.1, L.bride ? 1 : 1.45, m);
  if (!L.bride) {
    c.part();
    c.px(Math.round(wx + out * 0.8), Math.round(wy + 1.4), SLEEVE, sphere(out * 0.4, -0.4), { bias: -1 });
    c.px(Math.round(wx - out * 0.4), Math.round(wy + 1.6), SHROUD_MIST, { x: 0, y: 0, z: 1 });
  }
  hand(c, hx, hy, e.x, e.y);
}

function drawFigure(c: PixelCanvas, p: BansheePose, view: View): void {
  const side = view === 'side';
  const U = -p.bob;
  const cx = 12 - (side ? p.lean : 0);
  const headY = 8 + U + (p.back ? -0.6 : 0);
  const sh = 13.4 + U;
  const hem = 25 + U;
  const hx = cx + p.tilt + (side ? -0.6 : 0);
  // Where the hands hang: by her sides.
  const restA = side ? { x: cx - 2.6, y: sh + 7.4 } : { x: cx - 4.2, y: sh + 7.5 };
  const restB = side ? { x: cx + 1.6, y: sh + 7 } : { x: cx + 4.2, y: sh + 7.5 };
  let ha = { x: restA.x + p.handA.x, y: restA.y + p.handA.y };
  let hb = { x: restB.x + p.handB.x, y: restB.y + p.handB.y };
  if (p.cover && !side) {
    // Both hands over her face.
    ha = { x: hx - 1.4, y: headY + 1.2 };
    hb = { x: hx + 1.1, y: headY + 1.2 };
  }
  const bot = sh + 10;

  if (L.bride && view !== 'up') veil(c, hx, headY, hem, p, view);
  if (view === 'down') hairFall(c, hx, headY, bot, p, false);
  if (side) arm(c, cx + 0.6, sh + 1, hb.x, hb.y, 1);
  if (view === 'up') {
    // From behind, her arms are on the far side of her: first, then the body over them.
    arm(c, cx - 2.8, sh + 1, ha.x, ha.y, -1);
    arm(c, cx + 2.8, sh + 1, hb.x, hb.y, 1);
  }
  if (L.bride) gown(c, cx + (side ? p.lean * 0.3 : 0), sh, hem, p, view);
  else shroud(c, cx + (side ? p.lean * 0.3 : 0), sh, hem, p, view);
  c.part();
  c.capsule(hx - (side ? 0.4 : 0.5), headY + 2.6, cx - (side ? 0.2 : 0.5), sh + 0.4, 0.9, 1.05, skin());
  if (view === 'up') {
    hairFall(c, hx, headY, sh + 7, p, true);
    if (L.bride) {
      veil(c, hx, headY, hem, p, view);
      circlet(c, hx, headY, view);
    }
    return;
  }
  if (!side) {
    arm(c, cx - 2.8, sh + 1, ha.x, ha.y, -1);
    arm(c, cx + 2.8, sh + 1, hb.x, hb.y, 1);
  }
  // In profile her hair falls down over the back of her shoulders, in front of the shroud.
  if (side) hairSide(c, hx, headY, sh, p);
  face(c, hx, headY, p, view);
  if (side) capSide(c, hx, headY);
  else hairFront(c, hx, headY, sh, p);
  if (L.bride) {
    pearls(c, cx, sh, view);
    circlet(c, hx, headY, view);
  }
  if (side) arm(c, cx - 0.8, sh + 1, ha.x, ha.y, -1);
  else {
    // Hands raised over her hair and face are drawn over them.
    for (const [h, s] of [[ha, -1], [hb, 1]] as const) if (h.y < sh + 3) hand(c, h.x, h.y, elbow(cx + s * 2.8, sh + 1, h.x, h.y, s).x, elbow(cx + s * 2.8, sh + 1, h.x, h.y, s).y);
  }
  if (L.bride) {
    // Held in both hands at her waist, or in one when they part.
    const both = !side && Math.abs(ha.x - hb.x) < 4.5 && Math.abs(ha.y - hb.y) < 3;
    const bh = side ? ha : both ? { x: (ha.x + hb.x) / 2 + 0.3, y: Math.min(ha.y, hb.y) } : hb;
    if (!p.cover) bouquet(c, bh.x, bh.y, p);
  } else if (p.comb) comb(c, hb.x - 1, hb.y);
}
// ---------------------------------------------------------------------------
// Animations

export type BansheeAnim = 'idle' | 'move' | 'keen' | 'shriek' | 'cast' | 'sing' | 'rest';

interface AnimDef {
  name: BansheeAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => BansheePose[];
  /** Frame indices to play in order, when some are held or repeated. */
  order?: readonly number[];
}

/** The Bride holds her bouquet before her in both hands while she drifts. */
const held = (p: BansheePose, view: View): BansheePose => {
  if (!L.bride || view === 'up') return p;
  if (view === 'side') p.handA = { x: p.handA.x - 0.6, y: p.handA.y - 1.8 };
  else {
    p.handB = { x: p.handB.x - 3.4, y: p.handB.y - 1.2 };
    p.handA = { x: p.handA.x + 3, y: p.handA.y - 0.9 };
  }
  return p;
};

const idle = (view: View): BansheePose[] =>
  [0, 1, 2, 3, 4, 5].map((i) => {
    const p = base();
    p.bob = [0, 1, 1, 1, 0, 0][i];
    p.wave = i;
    p.handA = { x: 0, y: [0, -0.5, -1, -0.5, 0, 0][i] };
    p.handB = { x: 0, y: [0, 0, -0.5, -1, -0.5, 0][i] };
    return held(p, view);
  });

/** Drifting along: leaning into it, the hair and rags streaming out behind. */
const move = (view: View): BansheePose[] =>
  [0, 1, 2, 3].map((i) => {
    const p = base();
    p.bob = [1, 2, 2, 1][i];
    p.wave = i * 1.5 + 0.5;
    p.stream = view === 'side' ? 1 : 0;
    p.flow = view === 'side' ? 0.4 : 0.45;
    p.lean = view === 'side' ? 1 : 0;
    p.handA = view === 'side' ? { x: 1.5, y: -0.5 } : { x: 0.5, y: 0.5 };
    p.handB = view === 'side' ? { x: 1.5, y: -0.5 } : { x: -0.5, y: 0.5 };
    return held(p, view);
  });

/** The keen: a breath drawn, then she leans in and wails, her hands reaching out, the hair blown back. */
const keen = (view: View): BansheePose[] =>
  [0, 1, 2, 3].map((i) => {
    const p = base();
    p.bob = i === 0 ? 1 : 0;
    p.wave = i;
    p.mouth = [0.3, 1, 1, 0.4][i];
    p.flow = [0.3, 0.85, 1, 0.5][i];
    p.glare = [0.5, 1, 1, 0.6][i];
    p.stream = view === 'side' ? [0, 0.6, 0.7, 0.3][i] : 0;
    const reach = i === 1 || i === 2;
    if (view === 'side') {
      p.lean = reach ? 1 : 0;
      p.handA = i === 0 ? { x: 1.5, y: -3 } : reach ? { x: -3.5, y: -4.5 } : { x: -1, y: -2 };
      p.handB = i === 0 ? { x: 0.5, y: -3 } : reach ? { x: -3.5, y: -3.5 } : { x: 0, y: -1 };
    } else if (view === 'down') {
      p.handA = i === 0 ? { x: 2.5, y: -3 } : reach ? { x: -1.5, y: -4.5 } : { x: -0.5, y: -1.5 };
      p.handB = i === 0 ? { x: -2.5, y: -3 } : reach ? { x: 1.5, y: -4.5 } : { x: 0.5, y: -1.5 };
    } else {
      p.handA = reach ? { x: -1, y: -6 } : { x: 0, y: -2 };
      p.handB = reach ? { x: 1, y: -6 } : { x: 0, y: -2 };
    }
    return p;
  });

/** The shriek: she hunches, gathering it, then flings her arms wide and throws her head back, shaking. */
const shriek = (view: View): BansheePose[] =>
  [0, 1, 2, 3, 4].map((i) => {
    const p = base();
    p.wave = i * 1.5;
    if (i === 0) {
      p.bob = -1;
      p.mouth = 0.2;
      p.flow = 0.2;
      p.handA = view === 'side' ? { x: 2, y: -4 } : { x: 3.5, y: -4 };
      p.handB = view === 'side' ? { x: -1, y: -4 } : { x: -3.5, y: -4 };
      return p;
    }
    p.bob = i === 4 ? 1 : 2;
    p.mouth = i === 4 ? 0.5 : 1;
    p.back = i < 4;
    p.flow = i === 4 ? 0.6 : 1;
    p.glare = 1;
    p.shake = i === 4 ? 0 : i % 2 ? 1 : -1;
    p.handA = view === 'side' ? { x: -2, y: -8 } : { x: -2.5, y: -7 };
    p.handB = view === 'side' ? { x: 3.5, y: -7 } : { x: 2.5, y: -7 };
    return p;
  });

/** Her Special's pose: rising, her arms lifting, her mouth opening into song, the hair lifting wild. */
const cast = (view: View): BansheePose[] =>
  [0.2, 0.45, 0.7, 1, 1].map((k, i) => {
    const p = base();
    p.bob = Math.round(k * 4);
    p.flow = 0.3 + k * 0.7;
    p.mouth = Math.min(1, k * 1.1);
    p.glare = k;
    p.wave = i * 1.3;
    p.back = k >= 1;
    p.handA = view === 'side' ? { x: -1 * k, y: -7 * k } : { x: -2.5 * k, y: -7 * k };
    p.handB = view === 'side' ? { x: 3 * k, y: -6 * k } : { x: 2.5 * k, y: -7 * k };
    return p;
  });

/** Singing the lament: held high, arms spread, the hair wild and thrashing. */
const sing = (view: View): BansheePose[] =>
  [0, 1, 2, 3].map((i) => {
    const p = base();
    p.bob = [4, 5, 5, 4][i];
    p.flow = 1;
    p.mouth = [1, 0.8, 1, 0.8][i];
    p.glare = 1;
    p.back = i % 2 === 0;
    p.wave = i * 1.6;
    p.shake = [0, 1, 0, -1][i] * 0.5;
    const sway = [0, 0.5, 1, 0.5][i];
    p.handA = view === 'side' ? { x: -1, y: -7 - sway } : { x: -3, y: -6 - sway };
    p.handB = view === 'side' ? { x: 3, y: -6 + sway } : { x: 3, y: -7 + sway };
    return p;
  });

/**
 * The idle moment, facing the viewer only. She tips her head and combs a
 * long lock with a silver comb, humming, stroke after stroke (the Bride
 * lifts her bouquet to her face instead, and it sheds a petal); then all at
 * once she breaks: a sob, a sudden wail, and she buries her face in her
 * hands, shaking, until she lowers them and drifts calm again.
 */
const rest = (view: View): BansheePose[] => {
  if (view !== 'down') return [];
  const at = (o: Partial<BansheePose>): BansheePose => ({ ...base(), ...o });
  const coverA = { x: 3.3, y: -10.8 };
  const coverB = { x: -3.1, y: -10.8 };
  const sobbing = (shake: number, wave: number): BansheePose => at({ cover: true, handA: coverA, handB: coverB, shake, bob: -1, wave, flow: 0.7, glare: 0 });
  if (L.bride) {
    const smell = { x: -4, y: -7.8 };
    return [
      held(at({}), 'down'),
      at({ handB: { x: -3.4, y: -4.5 }, handA: { x: 3.2, y: -1 }, tilt: -1, wave: 1, hum: true }),
      at({ handB: smell, handA: { x: 3.2, y: -1 }, tilt: -1, wave: 2, hum: true, glare: 0.2 }),
      at({ handB: smell, handA: { x: 3.2, y: -1 }, tilt: -1, wave: 3, hum: true, glare: 0.2, bob: 1 }),
      at({ handB: { x: -3.4, y: -3 }, handA: { x: 3.2, y: -1 }, wave: 4, shed: 1, glare: 0.6 }),
      at({ handB: { x: -3.4, y: -2.5 }, handA: { x: 3.2, y: -1 }, wave: 5, shed: 2, glare: 0.8 }),
      at({ mouth: 1, flow: 1, back: true, handA: { x: 1, y: -5 }, handB: { x: -1, y: -5 }, glare: 1, bob: 1, wave: 6 }),
      sobbing(1, 7),
      sobbing(-1, 8),
      held(at({ bob: 0, wave: 9, flow: 0.4, glare: 0.3, mouth: 0.2 }), 'down'),
    ];
  }
  // The comb drawn down a long lock on her right, her head tipped to it.
  const combAt = (y: number): BansheePose => at({ comb: true, tilt: 1, hum: true, handB: { x: -1.6, y }, handA: { x: 0, y: -0.5 }, wave: y, glare: 0.25 });
  return [
    at({}),
    combAt(-9.5),
    combAt(-7),
    combAt(-4.5),
    combAt(-2.5),
    at({ comb: true, tilt: 0, handB: { x: -1, y: -2 }, wave: 5, glare: 0.6, mouth: 0.3 }),
    at({ mouth: 1, flow: 1, back: true, handA: { x: 1, y: -5 }, handB: { x: -1, y: -5 }, glare: 1, bob: 1, wave: 6 }),
    sobbing(1, 7),
    sobbing(-1, 8),
    at({ bob: 0, wave: 9, flow: 0.4, glare: 0.3, mouth: 0.2, handA: { x: 1, y: -1 }, handB: { x: -1, y: -1 } }),
  ];
};

export const BANSHEE_ANIMS: AnimDef[] = [
  { name: 'idle', fps: 5, loop: true, poses: idle },
  { name: 'move', fps: 8, loop: true, poses: move },
  { name: 'keen', fps: 10, loop: false, poses: keen },
  { name: 'shriek', fps: 14, loop: false, poses: shriek, order: [0, 0, 1, 2, 3, 2, 3, 4] },
  { name: 'cast', fps: 9, loop: false, poses: cast },
  { name: 'sing', fps: 7, loop: true, poses: sing },
  { name: 'rest', fps: 7, loop: false, poses: rest, order: [0, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4, 4, 5, 5, 5, 6, 6, 7, 8, 7, 8, 7, 8, 7, 8, 9, 9, 0] },
];

export interface BansheeFrame {
  key: string;
  anim: BansheeAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawFrame(dir: Dir, p: BansheePose): PixelCanvas {
  const c = new PixelCanvas(BANSHEE_W, BANSHEE_H).offset(BODY_X + Math.round(p.shake), BODY_Y);
  drawFigure(c, p, dir === 'left' || dir === 'right' ? 'side' : dir);
  return dir === 'right' ? c.mirrored() : c;
}

export function buildBansheeFrames(look: BansheeLook = BANSHEE_LOOK): BansheeFrame[] {
  L = look;
  const out: BansheeFrame[] = [];
  for (const a of BANSHEE_ANIMS) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, i) => out.push({ key: `${a.name}_${dir}_${i}`, anim: a.name, dir, canvas: drawFrame(dir, pose) }));
    }
  }
  L = BANSHEE_LOOK;
  return out;
}

// ---------------------------------------------------------------------------
// Icons

const BANSHEE_TONES: Tones = [hex('#f2f6ff'), hex('#c4d4ff'), hex('#a0b8ff'), hex('#3a4c8a')];
const BRIDE_TONES: Tones = [hex('#fbf8ff'), hex('#dcd0ff'), hex('#b4a4f0'), hex('#4a3e8a')];

/** The keen: a wailing face in profile, arcs of sound pouring out of its mouth in a cone. */
export function keenIcon(bride = false): Uint8ClampedArray {
  const t = bride ? BRIDE_TONES : BANSHEE_TONES;
  const face: RGB = bride ? hex('#d8d0ee') : hex('#ccd8ec');
  const hair: RGB = bride ? hex('#bab2da') : hex('#e8eeff');
  return icon16((put) => {
    // Dark details, left out of the face drawn after (the icon keeps the brighter pixel where two meet).
    const dark = new Set(['1,6', '2,8', '2,9']);
    put(1, 6, hex('#10141f'));
    put(2, 8, hex('#05060c'));
    put(2, 9, hex('#05060c'));
    // The arcs, widening as they go.
    for (const [r, c] of [[5, t[0]], [8, t[1]], [11, t[2]], [14, t[3]]] as const) {
      for (let i = 0; i <= 12; i++) {
        const a = -0.6 + (i / 12) * 1.2;
        put(1 + Math.cos(a) * r, 9 + Math.sin(a) * r, c);
      }
    }
    // The face: hair streaming up and back from it, a black open mouth.
    for (let y = 4; y <= 10; y++) for (let x = 0; x <= 2; x++) if (!dark.has(`${x},${y}`)) put(x, y, face);
    put(3, 6, face);
    for (const [x0, y0, x1, y1] of [[0, 4, 3, 0], [1, 3, 5, 1], [0, 2, 1, 0]] as const) seg(put, x0, y0, x1, y1, hair);
    if (bride) for (const [x, y] of [[9, 3], [12, 13], [6, 14]]) put(x, y, hex('#6a86e0'));
  });
}

/** The shriek: a screaming face, rings bursting out round it and shrill jags flying off. */
export function shriekIcon(bride = false): Uint8ClampedArray {
  const t = bride ? BRIDE_TONES : BANSHEE_TONES;
  const face: RGB = bride ? hex('#d8d0ee') : hex('#ccd8ec');
  const hair: RGB = bride ? hex('#bab2da') : hex('#e8eeff');
  return icon16((put) => {
    const dark = new Set(['7,7', '9,7', '8,9', '8,10', '8,11', '7,10', '9,10']);
    put(7, 7, hex('#10141f'));
    put(9, 7, hex('#10141f'));
    for (let y = 9; y <= 11; y++) put(8, y, hex('#05060c'));
    put(7, 10, hex('#05060c'));
    put(9, 10, hex('#05060c'));
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      put(8 + Math.cos(a) * 7, 8.5 + Math.sin(a) * 6.5, t[2]);
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.4;
      seg(put, 8 + Math.cos(a) * 5, 8.5 + Math.sin(a) * 4.6, 8 + Math.cos(a) * 6, 8.5 + Math.sin(a) * 5.6, t[0]);
    }
    // Hair flung up off the head.
    for (const [x0, x1] of [[6, 3], [7, 6], [9, 10], [10, 13]] as const) seg(put, x0, 5, x1, 1, hair);
    for (let y = 5; y <= 11; y++) for (let x = 6; x <= 10; x++) if (!((x === 6 || x === 10) && y === 11) && !dark.has(`${x},${y}`)) put(x, y, face);
    if (bride) for (const [x, y] of [[2, 13], [14, 4], [13, 14]]) put(x, y, hex('#6a86e0'));
  });
}
