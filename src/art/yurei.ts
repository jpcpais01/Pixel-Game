// The Yurei (the Phantom's third type): a Japanese ghost floating over the
// ground. A white burial kimono crossed left over right, a pale obi, wide
// sleeves hanging from arms held limply forward, the hands drooping at the
// wrist, and the legs fading away to nothing. Very long straight black hair
// falls from a centre parting over her face, leaving a sliver of pale face
// and one eye in the gap; the white triangle of the dead is tied on her brow.
// Two or three blue spirit flames (hitodama) circle her in the world (see
// Yurei.ts); they're drawn here as their own little sheet.
//
// Her Yuki-onna skin is the snow woman on the same float: a pale ice-blue
// kimono worked with frost flowers, a deep blue obi and cord, long silver-blue
// hair swept by a wind that isn't there, her face bare and white with
// ice-blue lips, an ice crystal pinned in her hair, icicles fringing her
// sleeves, and her hem breaking up into drifting snow.
//
// Also here: her talismans (ofuda) in flight, the hitodama, and the icons.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB, type Vec3 } from './pixel';
import { DIRS, type Dir } from './wizard';
import { icon16, seg, type Tones } from './druid';

const ramp = (...c: string[]): RGB[] => c.map(hex);

export const YUREI_W = 48;
export const YUREI_H = 50;
/** Drawn in the 24x32 body box every hero uses, placed in a larger frame (hair poured out and raised sleeves reach past it). */
const BODY_X = 12;
const BODY_Y = 12;
export const YUREI_ORIGIN_X = BODY_X + 12;
export const YUREI_ORIGIN_Y = BODY_Y + 31;
/** Where her hands are above the ground, where talismans leave from. */
export const YUREI_CHEST_Y = 15;

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const dither = (x: number, y: number): number => BAYER[((Math.floor(y) & 3) << 2) | (Math.floor(x) & 3)];
const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

// ---------------------------------------------------------------------------
// Materials

// The burial kimono: white, cooled to blue-grey in its folds, faintly aglow.
const KIMONO: Material = { ramp: ramp('#485064', '#7a8496', '#aab4c2', '#d4dae2', '#f4f6f8'), outline: hex('#12161e'), outlineLit: hex('#232a36'), emissive: 0.12 };
const MIST: Material = { ramp: ramp('#3e4c62', '#71839c', '#aabcd2'), outline: hex('#141c28'), emissive: 0.45, noAO: true, noOutline: true };
const OBI: Material = { ramp: ramp('#363c4a', '#5a6272', '#868e9e', '#aeb4c0'), outline: hex('#101218'), outlineLit: hex('#1c2028') };
// Black hair: near black, its sheen a cold blue.
const HAIR: Material = { ramp: ramp('#020206', '#07080f', '#10121c', '#1c2030', '#323a54'), outline: hex('#000000'), outlineLit: hex('#06070c'), shine: true };
const SKIN: Material = { ramp: ramp('#464c60', '#6e7690', '#9aa2b8', '#c2c8d6', '#e2e6ee'), outline: hex('#181c26'), outlineLit: hex('#2a303c'), emissive: 0.1 };
const PAPER: Material = { ramp: ramp('#9ca2ac', '#d4d8de', '#f6f8fa', '#ffffff'), outline: hex('#262a32'), emissive: 0.22 };
const VOID: Material = { ramp: ramp('#010103', '#06060c'), outline: hex('#000000'), noAO: true, noOutline: true };
const SCLERA: Material = { ramp: ramp('#c8ccd6', '#f4f6fa'), outline: hex('#101218'), noAO: true, noOutline: true, emissive: 0.35 };
const SLEEVE_IN: Material = { ramp: ramp('#0a0c12', '#161a24'), outline: hex('#05060a'), noAO: true, noOutline: true };
const SPIRIT: Material = { ramp: ramp('#1c46b0', '#4686ec', '#9ac8ff', '#e8f4ff'), outline: hex('#0a1a48'), emissive: 1, noAO: true, noOutline: true };
const INK_RED: Material = { ramp: ramp('#6a0e10', '#b0221e', '#e0483a'), outline: hex('#2a0404'), noOutline: true };

// Yuki-onna.
const Y_KIMONO: Material = { ramp: ramp('#5a7698', '#8ca8c8', '#bcd2e8', '#e0ecf6', '#f8fcff'), outline: hex('#0c182a'), outlineLit: hex('#182840'), emissive: 0.16 };
const Y_MIST: Material = { ramp: ramp('#5478a4', '#98c0e6', '#e0f2ff'), outline: hex('#1a2a40'), emissive: 0.5, noAO: true, noOutline: true };
const Y_OBI: Material = { ramp: ramp('#0c1838', '#1c326c', '#3254a0', '#587ec8'), outline: hex('#050a18'), outlineLit: hex('#0a1430'), shine: true };
const Y_CORD: Material = { ramp: ramp('#a8d0f0', '#e4f4ff', '#ffffff'), outline: hex('#1a2a40'), noOutline: true, emissive: 0.3 };
const Y_HAIR: Material = { ramp: ramp('#1c2650', '#2e4280', '#4e6eaa', '#82a2d2', '#c4d8f2'), outline: hex('#0a1028'), outlineLit: hex('#141c3c'), shine: true };
const Y_SKIN: Material = { ramp: ramp('#74849e', '#a4b4ca', '#d0dcea', '#eef4fa', '#ffffff'), outline: hex('#1c2636'), outlineLit: hex('#2c3850'), emissive: 0.16 };
const ICE: Material = { ramp: ramp('#3a88cc', '#8ad0fa', '#d8f4ff', '#ffffff'), outline: hex('#123456'), emissive: 0.7, shine: true, noAO: true };
const ICE_LIP: Material = { ramp: ramp('#2a6cc0', '#5eacf2'), outline: hex('#0a2040'), noAO: true, noOutline: true, emissive: 0.15 };
const LASH: Material = { ramp: ramp('#080c1c', '#141e3a'), outline: hex('#04060e'), noAO: true, noOutline: true };

const FLAKE: RGB = [225, 245, 255];
const EYE_GLOW: RGB = [150, 210, 255];

export interface YureiLook {
  key: string;
  yuki: boolean;
}

export const YUREI_LOOK: YureiLook = { key: 'yurei', yuki: false };
export const YUKI_LOOK: YureiLook = { key: 'yurei_yuki', yuki: true };
export const YUREI_LOOKS = [YUREI_LOOK, YUKI_LOOK];

let L: YureiLook = YUREI_LOOK;

interface Mats {
  kimono: Material;
  mist: Material;
  obi: Material;
  hair: Material;
  skin: Material;
}

const mats = (): Mats =>
  L.yuki ? { kimono: Y_KIMONO, mist: Y_MIST, obi: Y_OBI, hair: Y_HAIR, skin: Y_SKIN } : { kimono: KIMONO, mist: MIST, obi: OBI, hair: HAIR, skin: SKIN };

type View = 'down' | 'up' | 'side';

interface Pt {
  x: number;
  y: number;
}

export interface YureiPose {
  /** Floated up (+) or sunk. */
  bob: number;
  /** The hem's ripple as it fades away. */
  wave: number;
  /** The hair's ends swinging, px (+ toward her back in the side view). */
  sway: number;
  /** Hands, relative to where they hang held forward. */
  handA: Pt;
  handB: Pt;
  /** Leaning into her drift (side view), px. */
  lean: number;
  /** Her head tipped over, px (the idle moment). */
  tilt: number;
  /** 0..1: the hair over her face drawn aside to show one wide eye. */
  peek: number;
  /** 0..1: her eyes burning through the hair (the Special). */
  glare: number;
  /** Shaking: the whole figure jitters this many px. */
  shake: number;
  /** A talisman pinched in her front hand, ready to flick. */
  talisman: boolean;
  /** 0..1: her hair pouring down to the ground ahead (Grasping hair). */
  pour: number;
  /** 0..1: her hair lifting and spreading on a wind from below (the Special). */
  lift: number;
  /** The hair flung sideways (whipped back over her eye), px. */
  whip: number;
  /** Yuki-onna's breath of snow, 0..1, and her hand raised to her lips. */
  breath: number;
  hush: boolean;
  /** Spirit flames kindled over her raised hands (the Special's pose). */
  flames: number;
}

const base = (): YureiPose => ({ bob: 0, wave: 0, sway: 0, handA: { x: 0, y: 0 }, handB: { x: 0, y: 0 }, lean: 0, tilt: 0, peek: 0, glare: 0, shake: 0, talisman: false, pour: 0, lift: 0, whip: 0, breath: 0, hush: false, flames: 0 });

// ---------------------------------------------------------------------------
// Pieces (body-box coordinates: 24 wide, the ground at y 31; she floats)

/** Fill the pixels of row y whose centres fall in [x0, x1). */
function run(c: PixelCanvas, y: number, x0: number, x1: number, m: Material, n: (x: number, t: number) => Vec3, skip?: (x: number) => boolean): void {
  const w = x1 - x0;
  if (w <= 0) return;
  for (let x = Math.round(x0); x + 0.5 < x1; x++) {
    if (x + 0.5 < x0) continue;
    if (skip?.(x)) continue;
    c.px(x, y, m, n(x, ((x + 0.5 - x0) / w) * 2 - 1));
  }
}

/**
 * A fall of straight hair from y0 to y1: its edges run from (l0, r0) at the
 * top to (l1, r1) at the bottom, the ends swinging `sway` px (more the lower
 * they are) and flung `whip` px (all the way down). Strands catch the light
 * in thin streaks and end raggedly.
 */
function curtain(c: PixelCanvas, l0: number, r0: number, y0: number, l1: number, r1: number, y1: number, sway: number, whip: number, m: Material, o: { tips?: boolean; lit?: number } = {}): void {
  const tips = o.tips ?? true;
  for (let y = Math.floor(y0); y <= Math.ceil(y1) + 1; y++) {
    const u = clamp01((y + 0.5 - y0) / Math.max(1, y1 - y0));
    const shift = sway * u * u + whip * (0.3 + 0.7 * u);
    const l = l0 + (l1 - l0) * u + shift;
    const r = r0 + (r1 - r0) * u + shift;
    run(
      c,
      y,
      l,
      r,
      m,
      (_x, t) => cyl(t * 0.85, 0.12 - u * 0.1),
      (x) => {
        if (!tips) return y > y1;
        // Every strand ends at its own length.
        const strand = Math.floor(x - shift + 64);
        const end = y1 - ((strand * 7) % 3) * 0.7;
        return y + 0.5 > end;
      },
    );
    // Streaks of sheen down the strands.
    for (let x = Math.round(l); x < r; x++) {
      const strand = Math.floor(x - shift + 64);
      if (strand % 3 === (o.lit ?? 1) && c.materialAt(x, y) === m) c.shade(x, y, 1);
    }
  }
}

/** A snowflake motif worked into her kimono: a little cross of frost, or a dot. */
function frostMotif(c: PixelCanvas, x: number, y: number, big: boolean): void {
  // Lit into the cloth itself (a new part would ring each pixel in outline).
  const at = (dx: number, dy: number) => {
    if (!c.filled(x + dx, y + dy)) return;
    c.shade(x + dx, y + dy, 2);
    c.spark(x + dx, y + dy, [200, 235, 255], dx || dy ? 0.25 : 0.45);
  };
  at(0, 0);
  if (!big) return;
  // A little six-pointed frost flower: arms up and down, and four short diagonals.
  at(0, -1);
  at(0, 1);
  at(-1, -1);
  at(1, -1);
  at(-1, 1);
  at(1, 1);
}

/** The kimono from the shoulders down, fading to nothing below the knees. */
function kimono(c: PixelCanvas, cx: number, top: number, p: YureiPose, view: View): void {
  const M = mats();
  const side = view === 'side';
  const end = top + 21;
  for (let y = Math.floor(top); y <= end; y++) {
    const u = y - top;
    let hw: number;
    if (side) hw = u < 1 ? 2.2 : u < 11 ? 3 + u * 0.03 : 3.3 - (u - 11) * 0.26;
    else hw = u < 1 ? 3 : u < 2 ? 4 : u < 11 ? 4.1 + u * 0.05 : 4.6 - (u - 11) * 0.4;
    if (hw < 0.6) break;
    const low = Math.max(0, u - 10);
    // The fading hem trails: behind her when she drifts sideways, rippling otherwise.
    const drift = side ? low * 0.42 + Math.sin(p.wave * 1.6 + u * 0.5) * low * 0.12 : Math.sin(p.wave * 1.6 + u * 0.45) * low * 0.16;
    const fade = clamp01((u - 11) / 8);
    const x0 = cx - hw + drift - (side ? 0.4 : 0);
    const x1 = cx + hw + drift - (side ? 0.4 : 0);
    run(
      c,
      y,
      x0,
      x1,
      fade > 0.4 ? M.mist : M.kimono,
      (_x, t) => cyl(t * 0.9, 0.22 - u * 0.02),
      (x) => fade > 0 && dither(x, y) < fade * 1.15 - 0.12,
    );
  }
  // Long pleats falling from the obi: a crease, and the lit edge of cloth beside it.
  for (let y = Math.round(top + 9); y <= top + 16; y++) {
    const low = Math.max(0, y - top - 10);
    const drift = side ? low * 0.42 : Math.sin(p.wave * 1.6 + (y - top) * 0.45) * low * 0.16;
    for (const fx of side ? [-1, 1.5] : [-2.6, 0.4, 2.8]) {
      c.shade(Math.round(cx + fx + drift), y, -1);
      if (y > top + 9) c.shade(Math.round(cx + fx + drift) + 1, y, 1);
    }
  }
  if (L.yuki) {
    // Her hem deepens to a colder blue before it breaks into snow.
    for (let y = Math.round(top + 13); y <= top + 16; y++) for (let x = Math.round(cx - 6); x <= cx + 6; x++) if (c.materialAt(x, y) === Y_KIMONO) c.shade(x, y, -1);
  }
  if (view === 'up') {
    // A seam down the back.
    for (let y = Math.round(top + 1); y <= top + 11; y++) c.shade(Math.round(cx), y, -1);
  }
  // The obi.
  c.part();
  const obiW = side ? 3.2 : 4.5;
  for (const oy of [top + 5.6, top + 6.6, top + 7.6]) {
    run(c, Math.round(oy), cx - obiW - (side ? 0.4 : 0), cx + obiW - (side ? 0.4 : 0), M.obi, (_x, t) => cyl(t * 0.9, oy < top + 6 ? 0.45 : oy > top + 7 ? -0.3 : 0.1));
  }
  // The obijime, a thin cord tied round the middle of the obi.
  c.part();
  const cord = L.yuki ? Y_CORD : PAPER;
  const cy = Math.round(top + 6.6);
  for (let x = Math.round(cx - obiW - (side ? 0.4 : 0)); x < cx + obiW - (side ? 0.4 : 0); x++) c.px(x, cy, cord, cyl((x + 0.5 - cx) / obiW, 0.3), { bias: L.yuki ? 0 : -1 });
  if (view === 'down') {
    // Its knot, the ends hanging.
    c.px(Math.round(cx - 1), cy + 1, cord, sphere(-0.2, -0.3), { bias: L.yuki ? 0 : -1 });
    c.px(Math.round(cx - 1), cy + 2, cord, sphere(-0.2, -0.5), { bias: L.yuki ? -1 : -2 });
  }
  if (L.yuki) {
    // A few frost flowers worked into the skirt.
    if (view === 'down') {
      frostMotif(c, Math.round(cx - 2), Math.round(top + 11), true);
      frostMotif(c, Math.round(cx + 2), Math.round(top + 14), true);
    } else if (view === 'up') frostMotif(c, Math.round(cx + 1), Math.round(top + 12), true);
    else frostMotif(c, Math.round(cx + 0.5), Math.round(top + 11), true);
  }
  if (view === 'down') {
    // The collar, crossed left over right: her left side wraps over, its edge
    // running from her left shoulder down to her right hip.
    c.part();
    c.px(Math.round(cx - 1), Math.round(top), M.skin, { x: 0, y: 0.3, z: 1 });
    c.px(Math.round(cx), Math.round(top), M.skin, { x: 0, y: 0.3, z: 1 });
    c.px(Math.round(cx - 1), Math.round(top + 1), M.skin, { x: 0, y: 0, z: 1 }, { bias: -1 });
    // The under panel's collar, then the over panel's, each a band of cloth with a crease beside it.
    const under = L.yuki ? Y_OBI : KIMONO;
    for (let i = 0; i <= 2; i++) c.px(Math.round(cx - 2.2 + i * 0.7), Math.round(top + i), under, cyl(-0.3, 0.3), { bias: L.yuki ? 0 : 1 });
    for (let i = 0; i <= 5; i++) {
      const x = Math.round(cx + 2.2 - i * 0.7);
      const y = Math.round(top + i);
      c.px(x, y, M.kimono, cyl(0.4, 0.4), { bias: 1 });
      c.px(x + 1, y, M.kimono, cyl(0.5, 0.4), { bias: 1 });
      c.shade(x - 1, y, -2);
    }
  }
}

/**
 * A wide hanging sleeve and the limp hand at its end. `front` sleeves face the
 * viewer (her arms held out toward them): the fabric hangs straight down from
 * the forearm as a broad drape. Otherwise the arm is seen from the side and
 * the drape hangs under the length of it, deepest at the wrist.
 */
function sleeve(c: PixelCanvas, sx: number, sy: number, wx: number, wy: number, s: number, p: YureiPose, holding: boolean, far: boolean): void {
  const M = mats();
  const front = Math.abs(wx - sx) < 3.2;
  const o = far ? { bias: -1 } : {};
  c.part();
  if (front) {
    const inner = wx - s * 1;
    const outer = sx + s * 1.8;
    const l = Math.min(inner, outer);
    const r = Math.max(inner, outer);
    // The forearm reaching out toward the viewer, then the drape from the wrist down.
    c.capsule(sx, sy, wx, wy, 1.6, 1.4, M.kimono);
    c.part();
    const top = wy + 0.4;
    const bottom = wy + 6;
    for (let y = Math.floor(top); y <= bottom; y++) {
      const u = (y - top) / (bottom - top);
      // Rounded at the bottom, its outer corner swinging with the hem.
      const round = u > 0.78 ? (u - 0.78) * 6 : 0;
      const swing = Math.sin(p.wave * 1.6 + 1) * u * 0.4;
      run(c, y, l + (s < 0 ? round * 0.4 : round) + swing, r - (s < 0 ? round : round * 0.4) + swing, M.kimono, (_x, t) => cyl(t * 0.9, 0.25 - u * 0.4));
    }
    // A fold down the drape.
    for (let y = Math.round(wy + 1); y <= bottom - 1; y++) c.shade(Math.round((l + r) / 2), y, -1);
    if (L.yuki) {
      frostMotif(c, Math.round((l + r) / 2 + s * 0.5), Math.round(wy + 3.5), true);
      for (let x = Math.round(l + 1); x < r - 1; x += 2) c.px(x, Math.round(bottom + 1), ICE, { x: 0, y: -0.4, z: 0.9 });
    }
  } else {
    // The sleeve covers the arm to the elbow, its drape hanging deep under
    // it; past the cuff the bare forearm reaches on, thin and pale.
    const ex = sx + (wx - sx) * 0.55;
    const ey = sy + (wy - sy) * 0.55;
    c.capsule(sx, sy, ex, ey, 1.5, 1.5, M.kimono, o);
    const x0 = Math.min(sx, ex);
    const x1 = Math.max(sx, ex);
    for (let x = Math.round(x0); x < x1; x++) {
      const k = clamp01((x + 0.5 - sx) / (ex - sx));
      const ay = sy + (ey - sy) * k;
      const depth = 2 + k * 3.6 + Math.sin(p.wave * 1.6 + x * 0.3) * 0.3;
      for (let y = Math.round(ay); y <= ay + depth; y++) c.px(x, y, M.kimono, cyl((k - 0.5) * 1.2, 0.1 - (y - ay) / 8), o);
      if (L.yuki && !far && x % 3 === 0 && k > 0.4) c.px(x, Math.round(ay + depth + 1), ICE, { x: 0, y: -0.4, z: 0.9 });
    }
    // A fold down the drape.
    if (!far) for (let y = Math.round(ey + 1); y <= ey + 4; y++) c.shade(Math.round((sx + ex) / 2), y, -1);
    if (L.yuki && !far) frostMotif(c, Math.round((sx + ex) / 2 + (ex - sx) * 0.2), Math.round(ey + 3), true);
    c.part();
    c.ellipse(ex, ey + 0.2, 0.9, 1.3, SLEEVE_IN);
    if (!holding) {
      c.part();
      c.capsule(ex, ey, wx, wy, 0.75, 0.65, M.skin, o);
    }
  }
  // The dark inside of the sleeve at the wrist (for a sleeve facing the viewer), and the hand.
  if (front) {
    c.part();
    c.ellipse(wx, wy + 0.2, 1.1, 0.8, SLEEVE_IN);
  }
  c.part();
  if (holding) {
    // Pinching a talisman, fingers up.
    c.ellipse(wx, wy - 0.4, 1, 1, M.skin, o);
    c.part();
    for (let y = Math.round(wy - 4.5); y <= wy - 1.5; y++) for (let x = Math.round(wx - 0.5); x <= wx + 0.6; x++) c.px(x, y, ofudaPaper(), { x: 0, y: 0, z: 1 });
    c.px(Math.round(wx), Math.round(wy - 4), L.yuki ? ICE : INK_RED);
  } else {
    // Limp: the hand hangs from the wrist, fingers pointing at the ground.
    if (front) c.capsule(wx, wy + 0.3, wx + 0.2 * s, wy + 3, 0.9, 0.55, M.skin, o);
    else {
      // Bent down at the wrist, the fingers dangling toward the ground.
      const dir = Math.sign(wx - sx) || -1;
      c.capsule(wx, wy, wx + dir * 0.8, wy + 1.4, 0.95, 0.8, M.skin, o);
      c.capsule(wx + dir * 0.8, wy + 1.4, wx + dir * 0.9, wy + 3.6, 0.7, 0.4, M.skin, o);
    }
  }
}

const ofudaPaper = (): Material => (L.yuki ? FROST_PAPER : WASHI);

/** Two little spirit flames kindled over her raised hands. */
function handFlames(c: PixelCanvas, x: number, y: number, k: number, wave: number): void {
  if (k <= 0) return;
  c.part();
  const lick = Math.sin(wave * 2.1) * 0.8;
  c.ellipse(x, y, 1.4 * k + 0.4, 1.3 * k + 0.4, SPIRIT, { glow: 1 });
  c.capsule(x, y, x + lick, y - 2.5 * k - 1, 1 * k + 0.3, 0.3, SPIRIT, { glow: 1 });
  c.part();
  c.px(x, y, SPIRIT, { x: 0, y: 0, z: 1 }, { bias: 3, glow: 1 });
  const g: RGB = L.yuki ? [210, 240, 255] : [120, 180, 255];
  for (const [dx, dy, a] of [[0, -2, 0.5], [-2, 0, 0.35], [2, 0, 0.35], [0, 2, 0.3], [0, -4, 0.3]] as const) c.spark(x + dx, y + dy, g, a * k);
}

/** Yuki-onna's snowflakes, drifting down round her as the frames go by. */
function snow(c: PixelCanvas, p: YureiPose, cx: number, top: number): void {
  const flakes: [number, number, number][] = [
    [-9, 2, 0.4],
    [9, 9, 1.8],
    [-10, 17, 1.1],
  ];
  for (const [dx, dy, ph] of flakes) {
    const y = top + ((dy + p.wave * 1.5 + ph * 3) % 22) - 6;
    const x = cx + dx + Math.sin(p.wave * 1.2 + ph * 2) * 1.2;
    c.spark(x, y, FLAKE, 0.85);
    if (ph > 1.5 && ph < 2) {
      c.spark(x - 1, y, FLAKE, 0.25);
      c.spark(x + 1, y, FLAKE, 0.25);
      c.spark(x, y - 1, FLAKE, 0.25);
      c.spark(x, y + 1, FLAKE, 0.25);
    }
  }
}

// ---------------------------------------------------------------------------
// The figure

/**
 * Yuki-onna's hair caught on a wind that isn't there: a long tress pours off
 * the side of her head and streams out to the side and down, tapering and
 * rippling, lit along its top and darker blue underneath.
 */
function windHair(c: PixelCanvas, hx: number, headY: number, _cx: number, top: number, p: YureiPose, side: number): void {
  // Three strands leave her head together and fan apart toward fine tips,
  // background showing between them, each rippling a beat behind the last.
  const strands = [
    { reach: 11, drop: 0.55, r: 1.3, lag: 0 },
    { reach: 12.5, drop: 0.9, r: 1.1, lag: 0.7 },
    { reach: 9.5, drop: 1.25, r: 0.9, lag: 1.4 },
  ];
  strands.forEach((st, n) => {
    c.part();
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 8; i++) {
      const k = i / 8;
      const flutter = Math.sin(p.wave * 1.6 - i * 0.9 - st.lag) * k * 1.3;
      const x = hx + side * (2.6 + k * st.reach + p.lift * k * 2);
      const y = headY - 1.5 + k * (top + 8 - headY) * st.drop + flutter + p.sway * k;
      pts.push([x, y, st.r * (1 - k) + 0.3]);
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0, r0] = pts[i];
      const [x1, y1, r1] = pts[i + 1];
      c.capsule(x0, y0, x1, y1, r0, r1, Y_HAIR, { bias: n === 1 ? 0 : n === 0 ? 1 : -1 });
    }
  });
}

function drawDown(c: PixelCanvas, p: YureiPose): void {
  const M = mats();
  const b = p.bob;
  const cx = 12;
  const bow = p.pour * 1.5;
  const top = 11.6 - b;
  const headY = 6.8 - b + bow;
  const hx = cx + p.tilt;
  const yuki = L.yuki;
  const spread = p.lift * 2.4;

  // The long hair down her back, showing past her shoulders.
  c.part();
  const backEnd = top + 10 - p.pour * 3;
  if (yuki) windHair(c, hx, headY, cx, top, p, 1);
  curtain(c, hx - 4.2, hx + 4.2, headY - 2.5, cx - 4.6 - spread, cx + (yuki ? 5.2 : 4.6) + spread, backEnd, p.sway + (yuki ? 1 : 0), p.whip, M.hair, { lit: 2 });

  kimono(c, cx, top, p, 'down');

  // The face.
  c.part();
  c.ellipse(hx, headY + 0.6, 2.8, 3.1, M.skin, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.8 - 0.1, 1) });
  if (yuki) faceYuki(c, hx, headY, p);

  // The crown, parted in the middle.
  c.part();
  // Round over the top, its sides running on down into the curtains.
  c.shape(Math.floor(headY - 5), Math.round(headY - (yuki ? 1.6 : 1.4)), (y) => {
    const dy = (y + 0.5 - (headY - 0.8)) / 4.2;
    const w = 4.5 * Math.sqrt(Math.max(0, 1 - dy * dy));
    const gap = yuki || y < headY - 2.6 ? 0 : 1;
    return gap ? [hx - w, hx - gap] : [hx - w, hx + w];
  }, M.hair, (_x, y, t) => sphere(t * 0.85, (headY - 0.8 - y) / 4.2, 1));
  if (!yuki) c.shape(Math.round(headY - 2.6), Math.round(headY - 1.4), (y) => {
    const dy = (y + 0.5 - (headY - 0.8)) / 4.2;
    return [hx + 1, hx + 4.5 * Math.sqrt(Math.max(0, 1 - dy * dy))];
  }, M.hair, (_x, y, t) => sphere(0.3 + t * 0.55, (headY - 0.8 - y) / 4.2, 1));
  for (let y = Math.round(headY - 4.4); y <= headY - 2.5; y++) c.shade(Math.round(hx - 1), y, -1);
  // The sheen ring round the crown.
  for (let x = Math.round(hx - 3); x <= hx + 2; x++) c.shade(x, Math.round(headY - 3.4), 1);

  // The hair falling over her face and down her front (Yuki-onna's frames her face instead).
  c.part();
  const gap = yuki ? 2.4 : 0.95 * (1 - p.pour);
  // Over the shoulders and onto the chest, leaving the collar's V between them
  // (poured all the way to the ground for Grasping hair).
  const frontEnd = (yuki ? top + 5 : top + 6) + p.pour * (31 - top - 6 + 2);
  const flare = p.lift * 1.6;
  for (const s of [-1, 1]) {
    const inner = hx + s * gap;
    const outer = hx + s * 4.4;
    const lo = cx + s * (yuki ? 3 : 2 - p.pour * 1.6);
    const ho = cx + s * (yuki ? 4.6 : 3.8 + p.pour * 0.4) + s * flare;
    curtain(c, Math.min(inner, outer), Math.max(inner, outer), headY - 2.6, Math.min(lo, ho), Math.max(lo, ho), frontEnd, p.sway * 0.5, p.whip, M.hair, { lit: s > 0 ? 0 : 1 });
  }
  if (yuki) {
    // Her fringe, cut straight across the brow.
    c.part();
    for (let y = Math.round(headY - 2.4); y <= headY - 1.4; y++) run(c, y, hx - 3, hx + 3, M.hair, (_x, t) => cyl(t * 0.8, 0.3));
  }
  if (p.pour > 0.6) {
    // Poured to the ground: a spreading pool of hair at her feet.
    c.part();
    const r = 1.5 + p.pour * 6;
    c.ellipse(cx, 31.5, r, 1 + p.pour * 1.4, M.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.6, dy * 0.6 + 0.3, 0.6) });
    for (let i = 0; i < 5; i++) c.shade(Math.round(cx - r + 1 + i * (r * 0.45)), 31, 1);
  }
  if (!yuki && p.peek > 0) peekEye(c, hx, headY, p);
  if (!yuki && p.pour < 0.5) gapFace(c, hx, headY, p);

  // The triangle of the dead on her brow (Yuki-onna wears an ice crystal).
  if (!yuki) {
    c.part();
    const ty = Math.round(headY - 2.8 + p.pour);
    for (let x = Math.round(hx - 2); x <= hx + 1; x++) c.px(x, ty, PAPER, sphere((x + 0.5 - hx) / 3, 0.1));
    c.px(Math.round(hx - 1), ty - 1, PAPER, sphere(-0.2, 0.5));
    c.px(Math.round(hx), ty - 1, PAPER, sphere(0.2, 0.5), { bias: 1 });
  } else crystal(c, hx + 3.4, headY - 2.8);

  // Sleeves and limp hands, held out toward the viewer.
  const ha = { x: cx - 3.2 + p.handA.x, y: top + 2.8 + p.handA.y };
  const hb = { x: cx + 3.2 + p.handB.x, y: top + 2.8 + p.handB.y };
  sleeve(c, cx - 4.3, top + 1, ha.x, ha.y, -1, p, false, false);
  sleeve(c, cx + 4.3, top + 1, hb.x, hb.y, 1, p, p.talisman, false);
  if (yuki && p.hush) {
    // A hand lifted to her lips.
    c.part();
    c.ellipse(hx - 1.2, headY + 3.4, 1, 0.9, M.skin);
  }
  handFlames(c, ha.x - 0.5, ha.y - 3.5, p.flames, p.wave);
  handFlames(c, hb.x + 0.5, hb.y - 3.5, p.flames, p.wave + 1.3);
  if (yuki) {
    snow(c, p, cx, top);
    if (p.breath > 0) breath(c, hx - 1, headY + 2.6, p.breath, -1);
  }
}

/** The sliver of face in the gap of the hair: one dark eye, the corner of a mouth. */
function gapFace(c: PixelCanvas, hx: number, headY: number, p: YureiPose): void {
  c.part();
  const ex = Math.round(hx - 1);
  const ey = Math.round(headY + 0.4);
  c.px(ex, ey, VOID);
  if (p.glare > 0) {
    c.spark(ex, ey, EYE_GLOW, 0.5 + p.glare * 0.6);
    c.spark(ex, ey - 1, EYE_GLOW, p.glare * 0.25);
    c.spark(ex, ey + 1, EYE_GLOW, p.glare * 0.25);
  } else c.spark(ex, ey, [120, 160, 220], 0.25);
  c.shade(Math.round(hx), Math.round(headY + 2.8), -2);
}

/** The hair drawn aside from one eye: wide, pale, staring. */
function peekEye(c: PixelCanvas, hx: number, headY: number, p: YureiPose): void {
  c.part();
  const open = Math.round(1 + p.peek * 2);
  for (let y = Math.round(headY - 0.5); y <= headY + 1.5; y++) for (let i = 1; i <= open; i++) c.px(Math.round(hx - 1 - i), y, SKIN, sphere(-0.5, 0.1), { bias: y === Math.round(headY - 0.5) ? -1 : 0 });
  if (p.peek >= 0.5) {
    const ey = Math.round(headY + 0.4);
    c.px(Math.round(hx - 3.6), ey, SCLERA);
    c.px(Math.round(hx - 2.6), ey, VOID);
    c.px(Math.round(hx - 1.6), ey, SCLERA);
    c.spark(Math.round(hx - 2.6), ey, EYE_GLOW, 0.6);
  }
  // The lock pushed aside bunches beside it.
  for (let y = Math.round(headY - 1); y <= headY + 2; y++) c.shade(Math.round(hx - 2 - open), y, 1);
}

/** Yuki-onna's face: downcast lashes, ice-blue lips. */
function faceYuki(c: PixelCanvas, hx: number, headY: number, p: YureiPose): void {
  c.part();
  const ey = Math.round(headY + 0.5);
  for (const ex of [hx - 1.6, hx + 1.4]) {
    if (p.glare > 0) {
      c.px(Math.round(ex), ey, ICE);
      c.spark(Math.round(ex), ey, [200, 240, 255], 0.5 + p.glare * 0.5);
    } else c.px(Math.round(ex), ey, LASH);
  }
  c.px(Math.round(hx - 1), Math.round(headY + 2.6), ICE_LIP, FLAT_N, { bias: 1 });
}

const FLAT_N: Vec3 = { x: 0, y: 0, z: 1 };

/** The ice crystal pinned in Yuki-onna's hair, a strand of ice beads hanging from it. */
function crystal(c: PixelCanvas, x: number, y: number): void {
  c.part();
  const X = Math.round(x);
  const Y = Math.round(y);
  c.px(X, Y, ICE, sphere(0, 0.2), { bias: 2 });
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) c.px(X + dx, Y + dy, ICE, sphere(dx * 0.6, -dy * 0.6));
  c.px(X + 1, Y + 2, ICE, sphere(0.3, 0));
  c.px(X + 1, Y + 3, ICE, sphere(0.3, -0.3), { bias: 1 });
  c.spark(X, Y, [220, 245, 255], 0.9);
  c.spark(X, Y - 2, [200, 235, 255], 0.35);
}

/** A breath of snow blown from her lips, streaming out and thinning. */
function breath(c: PixelCanvas, x: number, y: number, k: number, dir: number): void {
  for (let i = 0; i < 9; i++) {
    const d = (i / 8) * 9 * k;
    const px = x + dir * (d + 1);
    const py = y + d * 0.35 + Math.sin(i * 1.7) * (d * 0.25);
    c.spark(px, py, FLAKE, (1 - i / 10) * (0.5 + k * 0.5));
    if (i % 3 === 1) c.spark(px, py - 1, FLAKE, 0.3 * k);
  }
}

function drawSide(c: PixelCanvas, p: YureiPose): void {
  const M = mats();
  const b = p.bob;
  const cx = 12 - p.lean;
  const top = 11.6 - b;
  const bow = p.pour;
  const headY = 6.8 - b + bow * 1.5;
  const hx = cx - 0.5 + p.tilt * 0.5 - bow * 1.2;
  const yuki = L.yuki;
  const spread = p.lift * 2;

  // The far arm, mostly hidden behind her.
  sleeve(c, cx + 0.6, top + 0.8, cx - 6 + p.handB.x, top + 1.8 + p.handB.y, -1, p, false, true);

  // The long hair down her back, the ends swinging behind as she drifts.
  c.part();
  const backEnd = top + 10 - p.pour * 2;
  if (yuki) windHair(c, hx, headY, cx, top, p, 1);
  curtain(c, hx - 0.8, hx + 3.9, headY - 2.4, cx + 0.2 + spread * 0.3, cx + 4.6 + spread, backEnd, p.sway + (yuki ? 1.6 : 0), p.whip, M.hair, { lit: 2 });

  kimono(c, cx, top, p, 'side');

  // The face, in profile.
  c.part();
  c.ellipse(hx - 1.2, headY + 0.6, 2.3, 3.1, M.skin, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8 - 0.2, dy * 0.8 - 0.1, 1) });
  c.px(Math.round(hx - 3.6), Math.round(headY + 0.9), M.skin, sphere(-0.8, 0));
  if (yuki) {
    c.part();
    c.px(Math.round(hx - 2.6), Math.round(headY + 0.5), p.glare > 0 ? ICE : LASH);
    if (p.glare > 0) c.spark(Math.round(hx - 2.6), Math.round(headY + 0.5), [200, 240, 255], 0.6 + p.glare * 0.4);
    c.px(Math.round(hx - 3.4), Math.round(headY + 2.6), ICE_LIP);
  }

  // The crown and the hair over her cheek.
  c.part();
  c.shape(Math.floor(headY - 4.6), Math.round(headY - 1.6), (y) => {
    const dy = (y + 0.5 - (headY - 1.2)) / 3.5;
    const w = 3.9 * Math.sqrt(Math.max(0, 1 - dy * dy));
    return [hx - w + 0.3, hx + w + 0.3];
  }, M.hair, (_x, y, t) => sphere(t * 0.85, (headY - 1.2 - y) / 3.5, 1));
  for (let x = Math.round(hx - 2); x <= hx + 2; x++) c.shade(x, Math.round(headY - 3.4), 1);
  c.part();
  curtain(c, hx - (yuki ? 1.2 : 1.5), hx + 3.4, headY - 2.2, cx - 1.6, cx + 2.4 + spread * 0.5, top + (yuki ? 6 : 5.5) - p.pour * 1, p.sway * 0.6, p.whip, M.hair, { lit: 1 });
  if (!yuki) {
    // The lock hanging forward over her face, down past her chin (poured
    // all the way to the ground ahead for Grasping hair).
    c.part();
    const lockEnd = top + 4.5 + p.pour * (31 - top - 4.5 + 1);
    const lockX = cx - 4.6 - p.pour * 2.5 - spread * 0.6;
    curtain(c, hx - 4.3, hx - 2.5, headY - 2.4, lockX, lockX + 1.9 + p.pour * 0.8, lockEnd, -p.sway * 0.3, p.whip, M.hair, { lit: 0 });
    if (p.pour > 0.6) {
      c.part();
      const r = 1.5 + p.pour * 5;
      c.ellipse(lockX - r * 0.5, 31.5, r, 1 + p.pour, M.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.6, dy * 0.6 + 0.3, 0.6) });
    }
    // Her nose and the point of her chin showing through the hair.
    if (p.pour < 0.5) {
      c.part();
      c.px(Math.round(hx - 4.6), Math.round(headY + 1), SKIN, sphere(-0.7, 0.2));
      c.px(Math.round(hx - 4), Math.round(headY + 3.2), SKIN, sphere(-0.5, -0.4), { bias: -1 });
    }
    // The eye in the sliver between the hair and her cheek.
    if (p.pour < 0.5) {
      c.part();
      const ex = Math.round(hx - 2.2);
      const ey = Math.round(headY + 0.4);
      c.px(ex, ey, VOID);
      c.spark(ex, ey, EYE_GLOW, p.glare > 0 ? 0.5 + p.glare * 0.6 : 0.25);
    }
    // The triangle on her brow, and its band round her head.
    c.part();
    const ty = Math.round(headY - 2.8 + p.pour);
    c.px(Math.round(hx - 2.6), ty, PAPER, sphere(-0.3, 0.3));
    c.px(Math.round(hx - 3.6), ty, PAPER, sphere(-0.6, 0.3));
    c.px(Math.round(hx + 2.4), ty + 1, PAPER, sphere(0.4, 0.2), { bias: -1 });
    c.px(Math.round(hx - 3.6), ty - 1, PAPER, sphere(-0.6, 0.6));
    c.px(Math.round(hx - 2.6), ty - 1, PAPER, sphere(-0.3, 0.5));
  } else {
    if (p.pour > 0.2) {
      // Grasping hair: a silver tress pours from her brow down to the ground ahead.
      c.part();
      const lockX = cx - 4.6 - p.pour * 2.5;
      curtain(c, hx - 3.6, hx - 1.8, headY - 1.5, lockX, lockX + 2.2, top + 4.5 + p.pour * (31 - top - 4.5 + 1), 0, p.whip, M.hair, { lit: 0 });
      if (p.pour > 0.6) c.ellipse(lockX - (1.5 + p.pour * 5) * 0.5, 31.5, 1.5 + p.pour * 5, 1 + p.pour, M.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.6, dy * 0.6 + 0.3, 0.6) });
    }
    // Her fringe, and the crystal at the back of her head.
    c.part();
    for (let y = Math.round(headY - 2.2); y <= headY - 0.8; y++) run(c, y, hx - 3.4, hx - 0.5, M.hair, (_x, t) => cyl(t * 0.8, 0.3));
    crystal(c, hx + 2.2, headY - 3);
  }

  // The near arm, held out ahead, the hand hanging limp.
  const w = { x: cx - 7.2 + p.handA.x, y: top + 2.2 + p.handA.y };
  sleeve(c, cx - 0.8, top + 1.2, w.x, w.y, -1, p, p.talisman, false);
  handFlames(c, w.x, w.y - 3.5, p.flames, p.wave);
  if (yuki) {
    snow(c, p, cx, top);
    if (p.breath > 0) breath(c, hx - 3.6, headY + 2.6, p.breath, -1);
  }
}

function drawUp(c: PixelCanvas, p: YureiPose): void {
  const M = mats();
  const b = p.bob;
  const cx = 12;
  const top = 11.6 - b;
  const headY = 6.8 - b + p.pour * 1.5;
  const hx = cx + p.tilt;
  const yuki = L.yuki;
  const spread = p.lift * 2.4;

  // Sleeves at her sides (her arms are held out ahead, away from us).
  const ha = { x: cx - 5 + p.handA.x * 0.6, y: top + 2.2 + p.handA.y };
  const hb = { x: cx + 5 + p.handB.x * 0.6, y: top + 2.2 + p.handB.y };
  for (const [s, h] of [[-1, ha], [1, hb]] as const) {
    c.part();
    const l = Math.min(h.x, cx + s * 6.8);
    const r = Math.max(h.x, cx + s * 6.8);
    for (let y = Math.round(h.y - 1); y <= h.y + 5.5; y++) {
      const u = (y - h.y + 1) / 6.5;
      const round = u > 0.75 ? (u - 0.75) * 5 : 0;
      run(c, y, l + (s < 0 ? round : 0), r - (s > 0 ? round : 0), M.kimono, (_x, t) => cyl(t * 0.9, 0.2 - u * 0.4));
    }
    if (yuki) for (let x = Math.round(l + 1); x < r - 1; x += 2) c.px(x, Math.round(h.y + 6.5), ICE, { x: 0, y: -0.4, z: 0.9 });
  }

  kimono(c, cx, top, p, 'up');

  // The head from behind, and the long fall of hair over her back.
  c.part();
  c.ellipse(hx, headY - 0.8, 4.2, 3.8, M.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.85, dy * 0.85, 1) });
  c.part();
  const backEnd = top + 10.5 - p.pour * 4;
  if (yuki) windHair(c, hx, headY, cx, top, p, 1);
  c.part();
  curtain(c, hx - 4.1, hx + 4.1, headY - 0.5, cx - 4.3 - spread, cx + (yuki ? 4.9 : 4.3) + spread, backEnd, p.sway + (yuki ? 1.5 : 0), p.whip, M.hair, { lit: 1 });
  for (let x = Math.round(hx - 3); x <= hx + 2; x++) c.shade(x, Math.round(headY - 3.2), 1);
  if (!yuki) {
    // The band of the triangle, knotted at the back of her head.
    c.part();
    const ty = Math.round(headY - 2.6);
    for (let x = Math.round(hx - 4); x <= hx + 3; x++) if (c.filled(x, ty)) c.px(x, ty, PAPER, cyl(((x - hx + 0.5) / 4) * 0.9, 0.2), { bias: -1 });
    c.px(Math.round(hx - 1), ty, PAPER, sphere(-0.3, 0.3), { bias: 1 });
    c.px(Math.round(hx), ty, PAPER, sphere(0.3, 0.3), { bias: 1 });
    c.px(Math.round(hx - 1), ty + 1, PAPER, sphere(-0.2, -0.2));
    c.px(Math.round(hx), ty + 2, PAPER, sphere(0.2, -0.2));
  } else crystal(c, hx + 3, headY - 2.6);
  handFlames(c, ha.x - 1, ha.y - 4, p.flames, p.wave);
  handFlames(c, hb.x + 1, hb.y - 4, p.flames, p.wave + 1.3);
  if (yuki) snow(c, p, cx, top);
}

// ---------------------------------------------------------------------------
// Animations

export type YureiAnim = 'idle' | 'move' | 'throw' | 'hair' | 'cast' | 'rest';

interface AnimDef {
  name: YureiAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => YureiPose[];
  /** Frame indices to play in order, when some are held or repeated. */
  order?: readonly number[];
}

const at = (o: Partial<YureiPose>): YureiPose => ({ ...base(), ...o });

/** Hovering: a slow rise and fall, the hair's ends stirring, the hands bobbing a beat behind. */
const idle = (): YureiPose[] =>
  [0, 1, 2, 3].map((i) =>
    at({
      bob: [0, 1, 1, 0][i],
      wave: i,
      sway: [0, 0.6, 0, -0.6][i],
      handA: { x: 0, y: [0, 0, 1, 1][i] },
      handB: { x: 0, y: [1, 0, 0, 1][i] },
    }),
  );

/** Drifting: leaning in, the hair and the hem streaming behind. */
const move = (view: View): YureiPose[] =>
  [0, 1, 2, 3].map((i) =>
    at({
      bob: [1, 2, 2, 1][i],
      wave: i + 0.5,
      sway: view === 'side' ? [2, 2.6, 2, 1.4][i] : view === 'up' ? [0.5, 1, 0.5, 0][i] : [-0.5, 0, 0.5, 0][i],
      lean: view === 'side' ? 1 : 0,
      handA: view === 'side' ? { x: 0.5, y: [0, -0.5, 0, 0.5][i] } : { x: 0, y: [0, 0, 1, 1][i] },
      handB: view === 'side' ? { x: 0.5, y: 0 } : { x: 0, y: [1, 1, 0, 0][i] },
    }),
  );

/** The flick: a talisman drawn up between two fingers, then snapped out the way she faces. */
const flick = (view: View): YureiPose[] => {
  const side = view === 'side';
  const up = side ? { x: 6.5, y: -4 } : view === 'down' ? { x: 0.8, y: -4.5 } : { x: 0.5, y: -3 };
  const out = side ? { x: -2.5, y: -1 } : view === 'down' ? { x: -0.5, y: 2.5 } : { x: 0, y: -1 };
  return [
    at({ bob: 1, wave: 0, talisman: true, ...(side ? { handA: up } : { handB: up }) }),
    at({ bob: 1, wave: 1, talisman: true, ...(side ? { handA: { x: up.x - 1, y: up.y - 0.5 } } : { handB: { x: up.x, y: up.y - 0.5 } }) }),
    at({ bob: 1, wave: 2, lean: side ? 1 : 0, sway: side ? -0.6 : 0, ...(side ? { handA: out } : { handB: out }) }),
    at({ bob: 1, wave: 3, ...(side ? { handA: { x: -1, y: 0 } } : { handB: { x: 0, y: 1 } }) }),
  ];
};

/** Grasping hair: she bows, and her hair pours down to the ground and away along it. */
const pourHair = (view: View): YureiPose[] =>
  [0, 0.35, 0.75, 1, 1, 0.6].map((k, i) =>
    at({
      bob: i === 0 ? 1 : 0,
      wave: i,
      pour: k,
      handA: view === 'side' ? { x: 1.5 * k, y: 2 * k } : { x: 0.5 * k, y: 2 * k },
      handB: view === 'side' ? { x: 1, y: 2 * k } : { x: -0.5 * k, y: 2 * k },
      sway: view === 'side' ? -1 * k : 0,
    }),
  );

/** The Special's pose: rising, arms lifted wide, hair lifting on a cold wind, eyes burning through it, spirit flames kindling over her hands. */
const cast = (view: View): YureiPose[] =>
  [0.3, 0.6, 1, 1, 1].map((k, i) =>
    at({
      bob: Math.round(k * 3),
      glare: k,
      lift: k,
      flames: Math.max(0, k - 0.3) / 0.7,
      wave: i,
      sway: (i % 2 ? 0.6 : -0.6) * k,
      handA: view === 'side' ? { x: 1.5 * k, y: -5 * k } : view === 'down' ? { x: -6 * k, y: -4.5 * k } : { x: -3 * k, y: -4 * k },
      handB: view === 'side' ? { x: 2.5 * k, y: -5 * k } : view === 'down' ? { x: 6 * k, y: -4.5 * k } : { x: 3 * k, y: -4 * k },
    }),
  );

/**
 * The idle moment, facing the viewer only. The Yurei slowly tips her head
 * over, further and further... the hair over her face slides aside and one
 * wide eye peeks out at you. A long stare. Then she snaps upright and whips
 * the hair back over it. Yuki-onna tips her head, lifts a hand to her lips
 * and blows a long breath of snow across the frame, then lowers it, pleased.
 */
const rest = (view: View): YureiPose[] => {
  if (view !== 'down') return [];
  if (L.yuki) {
    return [
      at({}),
      at({ tilt: -0.5, wave: 1, sway: 0.4 }),
      at({ tilt: -1, wave: 2, hush: true, handA: { x: 1.5, y: -3 } }),
      at({ tilt: -1, wave: 3, hush: true, handA: { x: 1.5, y: -3.5 }, bob: 1 }),
      at({ tilt: -1, wave: 4, breath: 0.35, handA: { x: 0, y: -2 }, bob: 1 }),
      at({ tilt: -1, wave: 5, breath: 0.7, handA: { x: -0.5, y: -1.5 }, bob: 1, sway: -0.6 }),
      at({ tilt: -1, wave: 6, breath: 1, handA: { x: -0.5, y: -1 }, bob: 1, sway: -1 }),
      at({ tilt: -0.5, wave: 7, breath: 1, bob: 1, sway: -0.6 }),
      at({ tilt: 0, wave: 8, glare: 0.4, bob: 1 }),
      at({ tilt: 0, wave: 9 }),
    ];
  }
  return [
    at({}),
    at({ tilt: 0.5, wave: 1 }),
    at({ tilt: 1, wave: 2, sway: 0.4 }),
    at({ tilt: 1.5, wave: 3, sway: 0.8, bob: -1 }),
    at({ tilt: 1.5, wave: 4, sway: 0.8, bob: -1, peek: 0.3 }),
    at({ tilt: 1.5, wave: 5, sway: 0.8, bob: -1, peek: 1 }),
    at({ tilt: 1.5, wave: 6, sway: 0.8, bob: -1, peek: 1, glare: 0.6 }),
    at({ tilt: 0, wave: 7, whip: -2.5, sway: -1.5, bob: 1, shake: 1 }),
    at({ tilt: 0, wave: 8, whip: 1.2, sway: 1, bob: 1, shake: -1 }),
    at({ tilt: 0, wave: 9, whip: -0.4, bob: 0 }),
  ];
};

export const YUREI_ANIMS: AnimDef[] = [
  { name: 'idle', fps: 4, loop: true, poses: idle },
  { name: 'move', fps: 7, loop: true, poses: move },
  { name: 'throw', fps: 16, loop: false, poses: flick },
  { name: 'hair', fps: 12, loop: false, poses: pourHair, order: [0, 1, 2, 3, 4, 4, 4, 5] },
  { name: 'cast', fps: 10, loop: false, poses: cast },
  { name: 'rest', fps: 6, loop: false, poses: rest, order: [0, 1, 1, 2, 2, 3, 3, 3, 4, 5, 6, 6, 6, 6, 6, 6, 7, 8, 9, 0] },
];

export interface YureiFrame {
  key: string;
  anim: YureiAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawFrame(dir: Dir, p: YureiPose): PixelCanvas {
  const c = new PixelCanvas(YUREI_W, YUREI_H).offset(BODY_X + p.shake, BODY_Y);
  if (dir === 'down') drawDown(c, p);
  else if (dir === 'up') drawUp(c, p);
  else drawSide(c, p);
  return dir === 'right' ? c.mirrored() : c;
}

export function buildYureiFrames(look: YureiLook = YUREI_LOOK): YureiFrame[] {
  L = look;
  const out: YureiFrame[] = [];
  for (const a of YUREI_ANIMS) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, i) => out.push({ key: `${a.name}_${dir}_${i}`, anim: a.name, dir, canvas: drawFrame(dir, pose) }));
    }
  }
  L = YUREI_LOOK;
  return out;
}

// ---------------------------------------------------------------------------
// The talismans (ofuda) she throws, and the hitodama

const WASHI: Material = { ramp: ramp('#8a7c5e', '#c4b48e', '#e8dcbc', '#fbf4e0'), outline: hex('#2a2214'), emissive: 0.15 };
const FROST_PAPER: Material = { ramp: ramp('#6a8cb0', '#a8cae6', '#d8eefc', '#f4fbff'), outline: hex('#142a44'), emissive: 0.3 };
const SUMI: Material = { ramp: ramp('#0c0c10', '#22222a'), outline: hex('#000000'), noOutline: true };
const DEEP_INK: Material = { ramp: ramp('#0e2a5a', '#1e4a8a'), outline: hex('#06122a'), noOutline: true };

export const OFUDA_SIZE = 12;
/** Flutter frames: the slip turning in the air, face on, three-quarter, edge on, three-quarter. */
export const OFUDA_FRAMES = 4;

/**
 * A paper talisman, standing upright in an OFUDA_SIZE square (the world turns
 * it to its flight): a seal stamped in red at its head and a brushed column
 * of characters under it; the frost-paper one has a snowflake seal and deep
 * blue ink. A spirit-glow clings to its edge. `f` turns it in the air;
 * frame `OFUDA_FRAMES` is the slip stuck flat on a foe, its glow smouldering.
 */
export function ofudaFrame(f: number, yuki: boolean): PixelCanvas {
  const c = new PixelCanvas(OFUDA_SIZE, OFUDA_SIZE);
  const paper = yuki ? FROST_PAPER : WASHI;
  const ink = yuki ? DEEP_INK : SUMI;
  const seal = yuki ? ICE : INK_RED;
  const stuck = f >= OFUDA_FRAMES;
  const w = stuck ? 4 : [4, 3, 1, 3][f];
  const x0 = Math.round(6 - w / 2);
  const t = (x: number) => (w > 1 ? ((x + 0.5 - x0) / w) * 2 - 1 : 0);
  // The slip twists along its length a little as it turns, so it reads as paper.
  const tilt = stuck ? 0 : [0, 0.4, 0, -0.4][f];
  for (let y = 2; y <= 9; y++) for (let x = x0; x < x0 + w; x++) c.px(x, y, paper, { x: t(x) * 0.7 + tilt * 0.3, y: 0.1, z: 0.8 });
  c.part();
  if (w >= 3) {
    const mx = x0 + Math.floor(w / 2);
    // The seal, then the brushed column.
    c.px(mx, 3, seal);
    if (w >= 4) c.px(mx - 1, 3, seal, FLAT_N, { bias: -1 });
    if (yuki) {
      c.px(mx, 2, seal, FLAT_N, { bias: 1 });
      c.px(mx, 4, seal, FLAT_N, { bias: 1 });
    }
    for (const [dx, y] of [[0, 5], [-1, 6], [0, 6], [0, 7], [-1, 8], [0, 8]] as const) if (w >= 4 || dx === 0) c.px(mx + dx, y, ink);
  } else c.px(x0, 5, ink);
  // The spirit-glow hugging its edge.
  const glow: RGB = yuki ? [200, 236, 255] : [110, 170, 255];
  for (let y = 0; y < OFUDA_SIZE; y++) {
    for (let x = 0; x < OFUDA_SIZE; x++) {
      if (c.filled(x, y)) continue;
      if (c.filled(x - 1, y) || c.filled(x + 1, y) || c.filled(x, y - 1) || c.filled(x, y + 1)) c.spark(x, y, glow, stuck ? 0.65 : 0.4);
    }
  }
  return c;
}

export const HITODAMA_W = 12;
export const HITODAMA_H = 16;
export const HITODAMA_FRAMES = 6;

const Y_SPIRIT: Material = { ramp: ramp('#5aa0d8', '#a8dcff', '#e4f6ff', '#ffffff'), outline: hex('#1a3a5a'), emissive: 1, noAO: true, noOutline: true };

/**
 * A hitodama: a ball of blue spirit-fire with a tail licking up from it,
 * flickering through its frames (the Yuki-onna's burns ice-white, a flake
 * of snow caught in it).
 */
export function hitodamaFrame(f: number, yuki: boolean): PixelCanvas {
  const c = new PixelCanvas(HITODAMA_W, HITODAMA_H);
  const m = yuki ? Y_SPIRIT : SPIRIT;
  const a = (f / HITODAMA_FRAMES) * Math.PI * 2;
  const lick = Math.sin(a) * 1.4;
  const tall = 6 + Math.cos(a * 2) * 0.8;
  const bx = 6;
  const by = 11.5;
  c.ellipse(bx, by, 2.6, 2.4, m, { normal: (_x, _y, dx, dy) => sphere(dx, dy, 1), bias: -1 });
  c.capsule(bx, by - 0.5, bx + lick * 0.6, by - tall * 0.55, 2, 1.2, m, { bias: -1 });
  c.capsule(bx + lick * 0.6, by - tall * 0.55, bx + lick, by - tall, 1.2, 0.3, m, { bias: -1 });
  c.part();
  c.ellipse(bx - 0.3, by - 0.2, 1.4, 1.3, m, { bias: 1 });
  c.part();
  c.px(bx - 1, by - 1, m, FLAT_N, { bias: 3 });
  // A wisp breaking off the tip now and then.
  if (f % 3 === 1) c.px(Math.round(bx + lick * 1.3), Math.round(by - tall - 2), m, FLAT_N, { bias: 0 });
  const g: RGB = yuki ? [210, 240, 255] : [90, 150, 255];
  for (let y = 0; y < HITODAMA_H; y++)
    for (let x = 0; x < HITODAMA_W; x++) {
      if (c.filled(x, y)) continue;
      if (c.filled(x - 1, y) || c.filled(x + 1, y) || c.filled(x, y - 1) || c.filled(x, y + 1)) c.spark(x, y, g, 0.4);
    }
  if (yuki) {
    const sx = Math.round(bx + 3 + Math.sin(a) * 1.5);
    const sy = Math.round(by - 4 - f * 0.6);
    c.spark(sx, sy, FLAKE, 0.9);
  }
  return c;
}

// ---------------------------------------------------------------------------
// Icons

export const YUREI_TONES: Tones = [hex('#f0f8ff'), hex('#8ac8ff'), hex('#3a7ae0'), hex('#14306a')];
export const YUKI_TONES: Tones = [hex('#ffffff'), hex('#d8f4ff'), hex('#8ad0f4'), hex('#3a78b0')];

/** Ofuda: a talisman flicked through the air, a streak of spirit-light behind, another already burning. */
export function ofudaIcon(yuki = false): Uint8ClampedArray {
  const t = yuki ? YUKI_TONES : YUREI_TONES;
  const paper: RGB = yuki ? hex('#d8eefc') : hex('#e8dcbc');
  const paperDim: RGB = yuki ? hex('#a8cae6') : hex('#c4b48e');
  const seal: RGB = yuki ? hex('#8ad0fa') : hex('#d03a2e');
  const ink: RGB = yuki ? hex('#1e4a8a') : hex('#22222a');
  return icon16((put) => {
    // The streak it leaves.
    seg(put, 0, 14, 5, 9, t[3]);
    seg(put, 1, 15, 5, 11, t[3]);
    seg(put, 2, 12, 5, 9, t[2]);
    // The slip, turned along its flight: a long diagonal strip.
    for (let i = 0; i < 9; i++) {
      const x = 5 + i * 0.85;
      const y = 10 - i * 0.85;
      put(x, y, paper);
      put(x + 1, y, paper);
      put(x + 1, y + 1, paperDim);
    }
    put(12, 3, seal);
    put(13, 3, seal);
    put(12, 2, seal);
    for (const [x, y] of [[10, 6], [9, 7], [8, 8], [9, 8], [7, 9]]) put(x, y, ink);
    // A spirit flame catching at its tail.
    put(13, 1, t[1]);
    put(14, 2, t[2]);
    put(14, 0, t[0]);
  });
}

/** Grasping hair: long black hair streaming along the ground into a pool of strands, grasping up. */
export function hairIcon(yuki = false): Uint8ClampedArray {
  const t = yuki ? YUKI_TONES : YUREI_TONES;
  const h: RGB = yuki ? hex('#c0d0ea') : hex('#6a789e');
  const hd: RGB = yuki ? hex('#7890b8') : hex('#3a4466');
  return icon16((put) => {
    // The pool's rim of spirit light, dim at the back.
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2;
      put(9.5 + Math.cos(a) * 5.8, 12 + Math.sin(a) * 2.6, Math.sin(a) > 0 ? t[2] : t[3]);
    }
    // Strands streaming in from the left and fanning into the pool, a glint running along them.
    for (let s = 0; s < 3; s++) {
      for (let x = 0; x <= 12; x++) {
        const y = 11 + s + Math.sin(x * 0.8 + s * 2) * 0.5 + (x > 7 ? (s - 1) * (x - 7) * 0.4 : 0);
        put(x, y, (x + s * 3) % 7 === 0 ? t[1] : s === 1 ? h : hd);
      }
    }
    // Grasping tendrils rising out of the pool, hooked at their tips.
    for (const [x, hgt, curl] of [[7, 6, -1], [10, 9, 1], [13, 5, -1]] as const) {
      for (let k = 0; k <= hgt; k++) put(x + Math.sin(k * 0.7) * 0.8, 11 - k, k > hgt - 2 ? t[1] : h);
      put(x + Math.sin(hgt * 0.7) * 0.8 + curl, 10 - hgt, t[0]);
    }
  });
}
