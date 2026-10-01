// The rogue, drawn procedurally from a small rig like the archer's.
//
// A cutpurse of the back alleys: a charcoal hood and a short mantle, a
// crimson scarf pulled up over the nose with its tails hanging behind, a dark
// leather vest over a slate shirt, a crimson sash knotted at the hip, belts
// with a pouch, wrapped trousers and soft boots. A dagger in each gloved hand,
// held reverse-grip at rest and turned point-first to strike.
//
// The body keeps to the 24x32 box inside a larger frame. Hands are posed in
// the rogue's own terms (forward, out to the side, height) and each dagger
// points along a direction in the same terms, so one set of keyframes aims
// the blades right in every view.
//
// The shadow dancer is his other look on the same rig: a midnight-violet hood,
// a pale porcelain mask with eyes lit violet, a silver sash, long scarf tails,
// and blades of living shadow that glow.
//
// The corsair is the cutthroat's skin: a black tricorn with a skull on it over
// a red bandana, long black hair, an eyepatch and a goatee, a navy captain's
// coat with gold buttons and epaulettes, its tails to the knee, a ruffled
// linen shirt and a red sash.
//
// The kitsune is the shadow dancer's skin: a white hood with fox ears standing
// up out of it, a white fox mask with red markings and eyes of blue foxfire, a
// crimson kimono top under a gold obi, three great fox tails tipped with
// foxfire, and blades of it.
//
// Nightbloom is the shadow dancer's other skin: a moonflower dancer. Long
// dark hair with a white moonflower over one ear and jasmine woven through
// it, a sheer indigo veil from her crown down her back, a silk bodice over a
// bare midriff, a silver chain belt and a skirt of indigo silk petals, long
// sashes trailing from her hip, silver bracelets and anklets, and slim curved
// moonsilver daggers shaped like petals.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB } from './pixel';
import { BLADE, BOOT, CRIMSON, EYE, GOLD, SKIN, STEEL } from './palette';
import { DIRS, type Dir } from './wizard';

export const ROGUE_W = 48;
export const ROGUE_H = 50;
const BODY_X = 12;
const BODY_Y = 12;
/** Sprite origin in the frame: body centre, just under the feet. */
export const ROGUE_ORIGIN_X = BODY_X + 12;
export const ROGUE_ORIGIN_Y = BODY_Y + 31;
/** Height above the feet the blades strike at. */
export const ROGUE_CHEST_Y = 13;
/** A tossed dagger: how far its grip sits behind its middle, and its grip to point. */
const TOSS_GRIP = 1.6;
const TOSS_LEN = 4.4;
/** How high the cutthroat flips his dagger above the hand, and how many turns it makes. */
const TOSS_PEAK = 12.5;
const TOSS_TURNS = 2;
/** The idle moment's pace, and the dancer's whirl of light: its trail of sparks and the ring they ride. */
const REST_FPS = 9;
const SWIRL_TRAIL = 6;
const SWIRL_RX = 8;
const SWIRL_RY = 2.6;
/** How far Nightbloom's petal blades bow to one side, in pixels. */
const PETAL_BOW = 0.8;

// ---------------------------------------------------------------------------
// Materials

const INK = hex('#0b0910');
const ramp = (...c: string[]): RGB[] => c.map(hex);

const HOOD: Material = { ramp: ramp('#110f18', '#1d1a27', '#2b2738', '#3d374d', '#554d66'), outline: INK, outlineLit: hex('#1e1a2a') };
const SHIRT: Material = { ramp: ramp('#16161f', '#24242f', '#343443', '#474759'), outline: INK };
const VEST: Material = { ramp: ramp('#1c110e', '#311f18', '#4a2e22', '#654030', '#80553d'), outline: INK };
const WRAPS: Material = { ramp: ramp('#15141b', '#221f29', '#322e3a', '#44404c'), outline: INK };
const GLOVE: Material = { ramp: ramp('#150e11', '#26191c', '#382628', '#4e3634'), outline: INK };
const HILT: Material = { ramp: ramp('#1a1012', '#2c1c1c', '#40292a', '#583a36'), outline: INK };

const DANCER_HOOD: Material = { ramp: ramp('#0f0a1e', '#1a1236', '#281c52', '#3a2a72', '#503c94'), outline: hex('#07040f'), outlineLit: hex('#1a1034') };
const DANCER_SHIRT: Material = { ramp: ramp('#110d1c', '#1c162c', '#2a2240', '#3a3056'), outline: hex('#07040f') };
const DANCER_VEST: Material = { ramp: ramp('#120c1e', '#1e1432', '#2c1e48', '#3e2b62', '#553c80'), outline: hex('#07040f') };
const DANCER_SCARF: Material = { ramp: ramp('#240c3e', '#3e1664', '#5e2490', '#8238bc', '#a85ce0'), outline: hex('#0c0418'), outlineLit: hex('#220a3a') };
const DANCER_SASH: Material = { ramp: ramp('#2e2c44', '#4a4866', '#6e6c8e', '#9a98b8', '#c8c6e0'), outline: hex('#12101e'), shine: true };
const MASK: Material = { ramp: ramp('#5a5670', '#8e8ca6', '#c4c4d8', '#e8e8f4', '#ffffff'), outline: hex('#15121f'), outlineLit: hex('#2a2640') };
const SHADOW_BLADE: Material = {
  ramp: ramp('#3a1a80', '#6a3ad0', '#a47cff', '#dccaff', '#f8f2ff'),
  outline: hex('#0e0620'),
  emissive: 0.7,
  shine: true,
  noAO: true,
};
const DANCER_HILT: Material = { ramp: ramp('#0e0a18', '#1a1428', '#2a2240', '#3c3258'), outline: hex('#07040f') };

// The corsair's.
const TRICORN: Material = { ramp: ramp('#0c0a0e', '#18151c', '#26222c', '#383240', '#4e465a'), outline: hex('#050407'), outlineLit: hex('#16121c') };
const NAVY_COAT: Material = { ramp: ramp('#0a0e22', '#141e3c', '#20305e', '#324686', '#4c62ac'), outline: hex('#050716'), outlineLit: hex('#111a36') };
const LINEN: Material = { ramp: ramp('#686052', '#a69c8a', '#dad2be', '#f4eee0', '#ffffff'), outline: hex('#1c1812'), outlineLit: hex('#34302a') };
const PIRATE_HAIR: Material = { ramp: ramp('#0a0808', '#161212', '#241e1c', '#38302c'), outline: hex('#040303') };
const PATCH: Material = { ramp: ramp('#060508', '#100e14', '#1a1820', '#26242e'), outline: hex('#020203') };
const BONE_WHITE: Material = { ramp: ramp('#8a8474', '#c4bca8', '#ece6d6', '#ffffff'), outline: hex('#1c1812') };

// The kitsune's.
const FOX_HOOD: Material = { ramp: ramp('#48425a', '#86809a', '#c4c0d4', '#ecE8f4', '#ffffff'), outline: hex('#141020'), outlineLit: hex('#2a2438') };
const FOX_RED: Material = { ramp: ramp('#360610', '#660e1c', '#a4182a', '#d63040', '#ff6a70'), outline: hex('#16030a'), outlineLit: hex('#2e0812') };
const FOX_UNDER: Material = { ramp: ramp('#0c0a10', '#16141c', '#22202a', '#32303c'), outline: hex('#050408') };
const OBI: Material = { ramp: ramp('#4a2e08', '#8a5a14', '#c8902a', '#f0c050', '#fff0a0'), outline: hex('#1e1204'), shine: true };
const FOX_MASK: Material = { ramp: ramp('#6a6478', '#a8a4b8', '#dcdae6', '#f6f6fb', '#ffffff'), outline: hex('#18141f'), outlineLit: hex('#2e2a3a') };
const FOX_TAIL: Material = { ramp: ramp('#584e60', '#9a90a2', '#d4ccd8', '#f2eef6', '#ffffff'), outline: hex('#1a141e'), outlineLit: hex('#302838') };
const FOXFIRE: Material = { ramp: ramp('#1a3aa0', '#3a70e8', '#7ab8ff', '#c8e8ff', '#f4fbff'), outline: hex('#0a1440'), emissive: 0.9, noAO: true };
const FOX_BLADE: Material = { ramp: ramp('#1a3a90', '#3a6ad8', '#7ab0ff', '#cce6ff', '#f4fbff'), outline: hex('#081030'), emissive: 0.7, shine: true, noAO: true };
const FOX_HILT: Material = { ramp: ramp('#1a0608', '#2e0c10', '#44141a', '#5e1e26'), outline: hex('#0a0204') };

// Nightbloom's.
const NB_SILK: Material = { ramp: ramp('#0e0a26', '#1a1444', '#2a2066', '#3c2f8a', '#5446ac'), outline: hex('#060414'), outlineLit: hex('#140e30') };
/** The veil, the skirt's petals and the sashes: a lighter, sheerer indigo with a sheen. */
const NB_VEIL: Material = { ramp: ramp('#1c1650', '#2e2878', '#463ea2', '#6a62c8', '#958ee6'), outline: hex('#0a0820'), outlineLit: hex('#1a1444') };
const NB_HAIR: Material = { ramp: ramp('#07060f', '#100e1e', '#1a1830', '#28264a', '#3a3866'), outline: hex('#030208'), outlineLit: hex('#0e0c1c') };
const NB_SKIN: Material = { ramp: ramp('#7a4a4c', '#b0766c', '#d8a292', '#f0c6b4', '#fde2d2'), outline: hex('#2a1418'), outlineLit: hex('#4a2530') };
const NB_LIP: Material = { ramp: ramp('#8a3a54', '#b8566e', '#d87a8e'), outline: hex('#2a1418'), noAO: true };
const NB_EYE: Material = { ramp: ramp('#120c2c', '#1e1648'), outline: hex('#05030e'), noAO: true };
const MOONFLOWER: Material = { ramp: ramp('#7a84b4', '#b4bce0', '#e4e8fa', '#ffffff'), outline: hex('#262a4a'), emissive: 0.45, noAO: true };
const JASMINE: Material = { ramp: ramp('#c8c0a0', '#f4ecd0', '#fffaf0'), outline: hex('#3a3424'), emissive: 0.35, noAO: true, noOutline: true };
const MOONSILVER: Material = { ramp: ramp('#4a4e68', '#8a90ac', '#c4cadc', '#eef2fa', '#ffffff'), outline: hex('#141626'), shine: true };
const PETAL_BLADE: Material = { ramp: ramp('#5a4aa8', '#9a8ee0', '#d4ccfa', '#f2eeff', '#ffffff'), outline: hex('#140c34'), emissive: 0.75, shine: true, noAO: true };
const NB_HILT: Material = { ramp: ramp('#0c0a1e', '#18143a', '#262058', '#342c74'), outline: hex('#050310') };
/** The moonflowers' pale gold hearts. */
const BLOOM_HEART: RGB = [255, 240, 190];

/** One look for the rogue: its texture key, its cloth and its blades. */
export interface RogueLook {
  key: string;
  hood: Material;
  shirt: Material;
  vest: Material;
  scarf: Material;
  sash: Material;
  blade: Material;
  hilt: Material;
  /** The guard and the buckles. */
  metal: Material;
  /** A silver half-mask across the eyes, above the scarf. */
  mask: boolean;
  /** How long the scarf's tails hang, in pixels. */
  tails: number;
  /** Eyes lit from within, and light along the edges of the blades. */
  lit?: RGB;
  /** The upper arm and forearm, when not the shirt's sleeve and wraps. */
  sleeve?: Material;
  forearm?: Material;
  /** The corsair: a tricorn over a bandana, an eyepatch, a captain's coat with tails and epaulettes. */
  corsair?: boolean;
  /** The kitsune: fox ears on the hood, a fox mask, and fox tails in place of the scarf's. */
  kitsune?: boolean;
  /** A shadow dancer (or its skin): its idle moment is a pirouette, not a flipped knife. */
  dance?: boolean;
  /**
   * Nightbloom: a woman's figure in place of the hood and vest: long hair with
   * moonflowers, a veil, a bodice and a petal skirt, sashes from the hip
   * (`scarf`, `tails` long), bare arms with bracelets, anklets, and curved
   * petal blades.
   */
  bloom?: boolean;
}

export const ROGUE_LOOK: RogueLook = {
  key: 'rogue',
  hood: HOOD,
  shirt: SHIRT,
  vest: VEST,
  scarf: CRIMSON,
  sash: CRIMSON,
  blade: BLADE,
  hilt: HILT,
  metal: STEEL,
  mask: false,
  tails: 5,
};

export const DANCER_LOOK: RogueLook = {
  key: 'rogue_dancer',
  hood: DANCER_HOOD,
  shirt: DANCER_SHIRT,
  vest: DANCER_VEST,
  scarf: DANCER_SCARF,
  sash: DANCER_SASH,
  blade: SHADOW_BLADE,
  hilt: DANCER_HILT,
  metal: GOLD,
  mask: true,
  tails: 8,
  lit: hex('#c49cff'),
  dance: true,
};

export const CORSAIR_LOOK: RogueLook = {
  key: 'rogue_corsair',
  hood: TRICORN,
  shirt: LINEN,
  vest: NAVY_COAT,
  scarf: CRIMSON,
  sash: CRIMSON,
  blade: BLADE,
  hilt: HILT,
  metal: GOLD,
  mask: false,
  tails: 3,
  sleeve: NAVY_COAT,
  forearm: NAVY_COAT,
  corsair: true,
};

export const KITSUNE_LOOK: RogueLook = {
  key: 'rogue_kitsune',
  hood: FOX_HOOD,
  shirt: FOX_UNDER,
  vest: FOX_RED,
  scarf: FOX_RED,
  sash: OBI,
  blade: FOX_BLADE,
  hilt: FOX_HILT,
  metal: GOLD,
  mask: false,
  tails: 0,
  lit: hex('#8ac8ff'),
  sleeve: FOX_RED,
  kitsune: true,
  dance: true,
};

export const NIGHTBLOOM_LOOK: RogueLook = {
  key: 'rogue_nightbloom',
  hood: NB_HAIR,
  shirt: NB_SKIN,
  vest: NB_SILK,
  scarf: NB_VEIL,
  sash: MOONSILVER,
  blade: PETAL_BLADE,
  hilt: NB_HILT,
  metal: MOONSILVER,
  mask: false,
  tails: 9,
  lit: hex('#dcd4ff'),
  sleeve: NB_SKIN,
  forearm: NB_SKIN,
  bloom: true,
  dance: true,
};

export const ROGUE_LOOKS = [ROGUE_LOOK, DANCER_LOOK, CORSAIR_LOOK, KITSUNE_LOOK, NIGHTBLOOM_LOOK];

/** The look being drawn; set by buildRogueFrames. */
let S: RogueLook = ROGUE_LOOK;

// ---------------------------------------------------------------------------
// Rig

/** A point in the rogue's terms: `f` forward, `s` out to its own side, `h` up from the chest. */
export interface Hand {
  f: number;
  s: number;
  h: number;
}

const H = (f: number, s: number, h: number): Hand => ({ f, s, h });

export interface Pose {
  /** Whole body raised (walk passing frames); negative crouches. */
  lift: number;
  /** Upper body lowered. */
  breath: number;
  /** Foot offsets. Side view: forward (+) / back (-). Front/back: lift. */
  footA: number;
  footB: number;
  /** Upper body shifted forward (side view), in pixels. */
  lean: number;
  /** The hands (screen left from the front and back, the near arm from the side), and where each blade points. */
  a: Hand;
  b: Hand;
  da: Hand;
  db: Hand;
  /** Scarf tails streaming back, 0 hanging .. 1 flying. */
  stream: number;
  /** Tails swinging to one side (front and back views). */
  sway: number;
  /** 0..1 light running along the blades (the dancer's, or a strike's gleam). */
  gleam: number;
  blink?: boolean;
  /** The near-hand dagger tossed into the air (the idle moment): its middle on screen and the way its point faces, in radians. The hand is empty. */
  toss?: { x: number; y: number; ang: number };
  /** The head nudged from the body (a bow); front view only. */
  headY?: number;
  /** Drawn from another view though filed as facing down: the pirouette's turn. */
  turn?: 'left' | 'up' | 'right';
  /** 0..1 round the turn: sparks of the blades' light whirling round him. */
  swirl?: number;
}

type View = 'down' | 'up' | 'side';

/** The chest row in body coordinates, the height hands are posed from. */
const CH = 18;

interface Placed {
  x: number;
  y: number;
  /** Drawn behind the body. */
  behind: boolean;
}

/** Where a point in the rogue's terms lands on screen in each view. `hx` is the upper body's centre (side view). */
function place(view: View, arm: 'a' | 'b', q: Hand, U: number, hx: number): Placed {
  const side = arm === 'a' ? -1 : 1;
  if (view === 'down') return { x: 12 + side * q.s, y: CH + U - q.h + q.f * 0.7, behind: q.f < -1 };
  if (view === 'up') return { x: 12 + side * q.s, y: CH + U - q.h - q.f * 0.8, behind: q.f > 1 };
  // Facing left; the far arm sits a touch higher and behind the body.
  const far = arm === 'b';
  return { x: hx - 1 - q.f * 1.05 + (far ? 0.8 : 0), y: CH + U - q.h + (far ? -0.6 : 0.3), behind: far };
}

/** The blade's tip on screen: the hand pushed along the blade's direction, never shorter than a stub. */
function bladeTip(view: View, arm: 'a' | 'b', hand: Hand, d: Hand, U: number, hx: number, at: Placed): [number, number] {
  const len = 4.6;
  const t = place(view, arm, H(hand.f + d.f * len, hand.s + d.s * len, hand.h + d.h * len), U, hx);
  let vx = t.x - at.x;
  let vy = t.y - at.y;
  const l = Math.hypot(vx, vy);
  // Seen end-on a blade still shows a little of itself.
  if (l < 2) {
    const k = l < 0.01 ? 0 : 2 / l;
    vx = l < 0.01 ? 0 : vx * k;
    vy = l < 0.01 ? 2 : vy * k;
  }
  return [at.x + vx, at.y + vy];
}

/** A dagger in the hand at `p`, its point at (tx, ty): a pommel behind the fist, a small guard, the blade. */
function dagger(c: PixelCanvas, p: Placed, tx: number, ty: number, gleam: number, bias = 0): void {
  const dx = tx - p.x;
  const dy = ty - p.y;
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l;
  const uy = dy / l;
  // Pommel peeking out behind the fist.
  c.part();
  c.px(p.x - ux * 1.6, p.y - uy * 1.6, S.hilt, sphere(-0.3, -0.3), { bias });
  // The guard, across the blade at the fist.
  c.part();
  const gx = p.x + ux * 1.1;
  const gy = p.y + uy * 1.1;
  c.px(gx - uy, gy + ux, S.metal, sphere(-0.4, -0.4), { bias });
  c.px(gx + uy, gy - ux, S.metal, sphere(0.4, 0.2), { bias });
  // The blade, a lit edge and a darker back.
  c.part();
  const glow = S.lit ? { glow: 0.55 + gleam * 0.4, bias } : { bias };
  if (S.bloom) petalBlade(c, gx + ux * 0.9, gy + uy * 0.9, tx, ty, glow);
  else c.line(gx + ux * 0.9, gy + uy * 0.9, tx, ty, S.blade, (i, n) => sphere(-0.35, -0.4 + (i / Math.max(1, n)) * 0.2), glow);
  if (S.lit) {
    const [r, g, b] = S.lit;
    c.spark(tx, ty, [r, g, b], 0.5 + gleam * 0.5);
    if (gleam > 0.3) c.spark(tx + ux, ty + uy, [r, g, b], gleam * 0.5);
  } else if (gleam > 0) {
    // A glint running to the point.
    c.spark(tx - ux, ty - uy, [255, 255, 255], 0.6 * gleam);
    c.spark(tx, ty, [255, 250, 236], gleam);
  }
}

/**
 * Nightbloom's blade: a slim petal of moonsilver, bellied in its first half
 * and bowed to one side, so it curves to its point like a moonflower's petal.
 */
function petalBlade(c: PixelCanvas, x0: number, y0: number, tx: number, ty: number, o: { glow?: number; bias: number }): void {
  const dx = tx - x0;
  const dy = ty - y0;
  const l = Math.hypot(dx, dy) || 1;
  // Across the blade: the bow goes this way, the belly the other.
  const nx = -dy / l;
  const ny = dx / l;
  const n = Math.max(2, Math.ceil(l * 1.6));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const bow = Math.sin(t * Math.PI) * PETAL_BOW;
    const x = x0 + dx * t + nx * bow;
    const y = y0 + dy * t + ny * bow;
    c.px(x, y, S.blade, sphere(-0.35, -0.45 + t * 0.3), o);
    if (t > 0.15 && t < 0.6) c.px(x - nx * 0.9, y - ny * 0.9, S.blade, sphere(0.3, 0.2), { ...o, bias: o.bias - 1 });
  }
}

/** A dagger spinning through the air, its middle at (x, y) and its point facing `ang`: the grip shows where no fist covers it. */
function tossed(c: PixelCanvas, x: number, y: number, ang: number, gleam: number): void {
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  const grip = { x: x - ux * TOSS_GRIP, y: y - uy * TOSS_GRIP, behind: false };
  dagger(c, grip, grip.x + ux * TOSS_LEN, grip.y + uy * TOSS_LEN, gleam);
  c.part();
  c.px(grip.x, grip.y, S.hilt, sphere(-0.3, -0.3));
  c.px(grip.x - ux * 0.8, grip.y - uy * 0.8, S.hilt, sphere(0, -0.3), { bias: -1 });
}

// ---------------------------------------------------------------------------
// Parts

/** A sleeved arm from the shoulder, bent at the elbow (towards `hint`), a wrapped forearm and a gloved fist. */
function arm(c: PixelCanvas, sx: number, sy: number, p: Placed, reach: number, hint: [number, number], bias = 0): void {
  const { x: fx, y: fy } = p;
  const dx = fx - sx;
  const dy = fy - sy;
  const d = Math.hypot(dx, dy) || 0.01;
  let ex = sx + dx / 2;
  let ey = sy + dy / 2;
  if (d < reach * 2) {
    // Two equal bones: the elbow sits where they meet, on the side the hint points.
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
  c.part();
  const slim = S.bloom ? 0.3 : 0;
  c.capsule(sx, sy, ex, ey, 1.45 - slim, 1.25 - slim, S.sleeve ?? S.shirt, { bias });
  c.part();
  c.capsule(ex, ey, fx, fy, 1.25 - slim, 1.1 - slim, S.forearm ?? WRAPS, { bias });
  if (S.corsair) {
    // A turned-back gold-edged cuff, and linen frilled at the wrist.
    c.part();
    c.capsule(ex + (fx - ex) * 0.55, ey + (fy - ey) * 0.55, ex + (fx - ex) * 0.75, ey + (fy - ey) * 0.75, 1.45, 1.45, S.metal, { bias });
    c.px(ex + (fx - ex) * 0.88, ey + (fy - ey) * 0.88, LINEN, sphere(0, -0.3), { bias });
  }
  if (S.bloom) {
    // A silver armlet above the elbow, and two thin bangles at the wrist.
    c.part();
    c.px(sx + (ex - sx) * 0.55, sy + (ey - sy) * 0.55, S.metal, sphere(-0.3, -0.4), { bias });
    c.px(ex + (fx - ex) * 0.62, ey + (fy - ey) * 0.62, S.metal, sphere(-0.3, -0.4), { bias });
    c.px(ex + (fx - ex) * 0.8, ey + (fy - ey) * 0.8, S.metal, sphere(0.3, -0.2), { bias });
    c.part();
    c.ellipse(fx, fy, 1.0, 1.0, NB_SKIN, { bias });
    return;
  }
  c.part();
  c.ellipse(fx, fy, 1.15, 1.1, GLOVE, { bias });
}

function leg(c: PixelCanvas, hx: number, hy: number, fx: number, fy: number, bias = 0): void {
  if (S.bloom) {
    // Slim legs in indigo silk, a silver anklet just above the foot.
    c.part();
    c.capsule(hx, hy, fx, fy, 1.3, 0.95, NB_SILK, { bias });
    c.part();
    const ay = Math.round(fy - 0.4);
    for (const dx of [-1, 0]) c.px(fx + dx, ay, MOONSILVER, sphere(dx ? -0.4 : 0.3, -0.3), { bias });
    c.spark(fx - 1, ay, [230, 236, 255], 0.25);
    return;
  }
  c.part();
  c.capsule(hx, hy, fx, fy, 1.55, 1.25, WRAPS, { bias });
  // Bindings round the shin.
  const y = Math.round(hy + (fy - hy) * 0.72);
  const x = hx + (fx - hx) * 0.72;
  c.shade(x - 1, y, -1);
  c.shade(x, y, -1);
}

/** A soft boot, laced up the ankle. */
function boot(c: PixelCanvas, x: number, y: number, side = false, bias = 0): void {
  if (S.bloom) {
    // A dancer's soft slipper, pointed.
    c.part();
    if (side) c.ellipse(x - 0.6, y + 0.2, 1.9, 0.85, NB_HILT, { flatten: 0.8, bias });
    else c.ellipse(x, y + 0.2, 1.1, 1.0, NB_HILT, { flatten: 0.8, bias });
    return;
  }
  c.part();
  if (side) c.ellipse(x - 0.3, y, 2.2, 1.15, BOOT, { flatten: 0.8, bias });
  else c.ellipse(x, y, 1.55, 1.25, BOOT, { flatten: 0.8, bias });
  c.part();
  c.shape(Math.round(y - 2.2), Math.round(y - 1.4), () => [x - 1.3, x + 1.3], BOOT, (_x, _y, t) => cyl(t, 0.2), { bias: bias + 1 });
}

/** The hood's short mantle over the shoulders. */
function mantle(c: PixelCanvas, cx: number, U: number, l: number, r: number): void {
  const top = 14 + U;
  c.part();
  c.shape(top, top + 2, (y) => {
    const u = (y - top) / 2;
    const k = Math.sqrt(u) * 0.7 + 0.3;
    return [cx - l * k, cx + r * k];
  }, S.hood, (_x, _y, t, u) => sphere(t * 0.95, u - 0.6, 1));
  // A ragged, notched hem.
  const y = top + 2;
  for (let x = Math.floor(cx - l); x <= Math.ceil(cx + r); x++) if (c.filled(x, y) && (x & 1) === 1) c.shade(x, y, -1);
}

/**
 * The scarf's two tails from the knot at the nape (x, y): hanging, swinging
 * to one side, or streaming back (`dir` -1/1) as he runs. Length from the look.
 */
function tails(c: PixelCanvas, x: number, y: number, dir: number, stream: number, sway: number, bias = 0): void {
  const n = S.tails;
  for (const [k, off] of [[0, 0], [1, 1.2]] as const) {
    c.part();
    let px = x + off * dir * 0.4;
    let py = y + off * 0.4;
    for (let i = 0; i < n + (k === 0 ? 0 : -1); i++) {
      const u = (i + 1) / n;
      // Hanging drops straight down; streaming lifts the tail out behind, rippling.
      const nx = px + dir * stream * (0.9 + off * 0.05) + sway * 0.25 * u + Math.sin(i * 1.7 + off * 2) * 0.35 * stream;
      const ny = py + (1 - stream) * 0.95 + stream * (0.25 + off * 0.12) + Math.cos(i * 1.3) * 0.2 * stream;
      c.capsule(px, py, nx, ny, 0.75 - u * 0.2, 0.7 - u * 0.25, S.scarf, { bias: bias + (k ? -1 : 0) });
      px = nx;
      py = ny;
    }
  }
}

function eyes(c: PixelCanvas, pts: [number, number][], blink: boolean | undefined): void {
  c.part();
  for (const [x, y] of pts) {
    if (blink) c.px(x, y, S.bloom ? NB_SKIN : S.kitsune ? FOX_MASK : S.mask ? MASK : SKIN, sphere(0, -0.3), { bias: -1 });
    else if (S.bloom) c.px(x, y, NB_EYE);
    else if (S.lit) {
      c.px(x, y, EYE);
      c.spark(x, y, S.lit, 0.9);
    } else c.px(x, y, EYE);
  }
}

/**
 * The corsair's tricorn from the front or behind: a low crown, the brim
 * cocked up at both sides with a corner pointing at the viewer, gold at the
 * corners, and a small white skull on its front.
 */
function tricorn(c: PixelCanvas, cx: number, U: number, front: boolean): void {
  c.part();
  const crown = [2.2, 2.8, 3.0];
  c.shape(6 + U, 8 + U, (y) => [cx - crown[y - 6 - U], cx + crown[y - 6 - U]], TRICORN, (_x, _y, t, u) => sphere(t * 0.9, u * 0.9 - 0.8, 1));
  c.part();
  c.shape(8 + U, 9 + U, (y) => (y === 8 + U ? [cx - 5, cx + 5] : [cx - 4.3, cx + 4.3]), TRICORN, (_x, y, t) => sphere(t * 0.7, y === 8 + U ? -0.6 : 0.3, 1), { bias: front ? 0 : -1 });
  c.shape(10 + U, 10 + U, () => [cx - 1.2, cx + 1.2], TRICORN, (_x, _y, t) => sphere(t * 0.7, 0.5, 1));
  // The wings cocked up at either side.
  c.px(cx - 5, 7 + U, TRICORN, sphere(-0.6, -0.6), { bias: 1 });
  c.px(cx + 4, 7 + U, TRICORN, sphere(0.6, -0.6));
  // Gold at each corner.
  c.part();
  c.px(cx - 5, 6 + U, S.metal, sphere(-0.4, -0.6));
  c.px(cx + 4, 6 + U, S.metal, sphere(0.4, -0.6));
  c.px(cx - 1, 10 + U, S.metal, sphere(-0.3, 0.4));
  c.px(cx, 10 + U, S.metal, sphere(0.3, 0.4), { bias: -1 });
  if (front) {
    c.part();
    c.px(cx - 1, 7 + U, BONE_WHITE, sphere(-0.2, -0.3));
    c.px(cx, 7 + U, BONE_WHITE, sphere(0.2, -0.3));
    c.shade(cx - 1, 8 + U, 1);
  }
}

/** The corsair's face: a red bandana under the hat, long black hair, a patch over his left eye, and a goatee. */
function corsairFace(c: PixelCanvas, cx: number, U: number, blink: boolean | undefined): void {
  c.part();
  c.shape(10 + U, 16 + U, (y) => [cx - 3.5 - (y - 10 - U) * 0.1, cx - 2.3], PIRATE_HAIR, (x, _y, t, u) => sphere(t * 0.8, u * 0.4 - 0.3 + (x & 1 ? 0.15 : -0.15), 1));
  c.shape(10 + U, 16 + U, (y) => [cx + 2.3, cx + 3.5 + (y - 10 - U) * 0.1], PIRATE_HAIR, (x, _y, t, u) => sphere(t * 0.8, u * 0.4 - 0.3 + (x & 1 ? 0.15 : -0.15), 1));
  c.part();
  c.ellipse(cx, 12.7 + U, 2.5, 2.3, SKIN);
  c.part();
  c.shape(10 + U, 10 + U, () => [cx - 2.7, cx + 2.7], S.scarf, (_x, _y, t) => sphere(t * 0.8, -0.3, 1));
  c.part();
  c.px(cx - 1, 15 + U, PIRATE_HAIR, sphere(-0.2, 0.3));
  c.px(cx, 15 + U, PIRATE_HAIR, sphere(0.2, 0.3), { bias: -1 });
  c.shade(cx - 1, 14 + U, -1);
  c.shade(cx, 14 + U, -1);
  // The patch and its strap.
  c.part();
  c.px(cx + 1, 12 + U, PATCH, sphere(0.2, 0));
  c.px(cx + 2, 11 + U, PATCH, sphere(0.4, -0.2));
  c.px(cx, 11 + U, PATCH, sphere(-0.2, -0.2));
  eyes(c, [[cx - 2, 12 + U]], blink);
}

/** Gold epaulettes on the shoulders, their fringe hanging. */
function epaulettes(c: PixelCanvas, pts: [number, number][]): void {
  for (const [x, y] of pts) {
    c.part();
    c.ellipse(x, y, 1.9, 1.1, S.metal, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.8 - 0.4, 1) });
    for (let dx = -1; dx <= 1; dx++) c.px(x + dx, y + 1.4, S.metal, sphere(dx * 0.3, 0.4), { bias: -1 });
  }
}

/** A tall pointed fox ear from its base at (x, y) to the tip, white outside, red within. */
function ear(c: PixelCanvas, x: number, y: number, tx: number, ty: number, bias = 0): void {
  const top = Math.round(ty);
  const bot = Math.round(y);
  c.part();
  c.shape(top, bot, (py) => {
    const u = (py - top) / Math.max(1, bot - top);
    const mx = tx + (x - tx) * u;
    const hw = 0.35 + u * 1.25;
    return [mx - hw, mx + hw];
  }, S.hood, (_x, _y, t, u) => sphere(t * 0.9, u * 0.5 - 0.6, 1), { bias });
  c.part();
  for (let py = top + 1; py < bot; py++) {
    const u = (py - top) / Math.max(1, bot - top);
    c.px(tx + (x - tx) * u, py, S.vest, sphere(0, 0.2), { bias: bias - 1 });
  }
}

/**
 * Three great fox tails from the small of the back, fanned out and swaying,
 * each tipped with a flame of foxfire. `tips` are where they end.
 */
function foxTails(c: PixelCanvas, x: number, y: number, tips: [number, number][], bias = 0): void {
  tips.forEach(([tx, ty], i) => {
    // A curve: up out of the back, then bending towards the tip.
    const mx = x + (tx - x) * 0.35;
    const my = y + (ty - y) * 0.75;
    c.part();
    c.capsule(x, y, mx, my, 1.1, 1.75, FOX_TAIL, { bias: bias + (i === 1 ? -1 : 0) });
    c.capsule(mx, my, tx, ty, 1.75, 1.2, FOX_TAIL, { bias: bias + (i === 1 ? -1 : 0) });
    c.part();
    const fx = tx + (tx - mx) * 0.18;
    const fy = ty + (ty - my) * 0.18;
    c.ellipse(fx, fy, 1.2, 1.2, FOXFIRE);
    c.spark(fx, fy, S.lit ?? [255, 255, 255], 0.5);
  });
}

/** The kitsune's mask from the front: white, a pointed snout with a black nose, red marks at the eyes and brow. */
function foxMask(c: PixelCanvas, cx: number, U: number, blink: boolean | undefined): void {
  c.part();
  c.ellipse(cx, 12.3 + U, 2.6, 2.2, FOX_MASK);
  c.part();
  c.shape(13 + U, 15 + U, (y) => {
    const hw = [1.6, 1.1, 0.7][y - 13 - U];
    return [cx - hw, cx + hw];
  }, FOX_MASK, (_x, _y, t, u) => sphere(t * 0.8, 0.2 + u * 0.4, 1));
  c.part();
  c.px(cx - 1, 15 + U, PATCH, sphere(-0.2, 0.2));
  c.px(cx, 15 + U, PATCH, sphere(0.2, 0.2));
  // Red flicks sweeping up from the eyes, and a mark on the brow.
  c.part();
  for (const [x, y] of [[cx - 3, 11], [cx + 2, 11], [cx - 2, 13], [cx + 1, 13]] as const) c.px(x, y + U, S.vest, sphere(0, -0.2));
  eyes(c, [[cx - 2, 12 + U], [cx + 1, 12 + U]], blink);
}

// ---------------------------------------------------------------------------
// Directions
// ---------------------------------------------------------------------------
// Directions

const REACH_FRONT = 4.3;
const REACH_SIDE = 5.1;

/** The torso's outline: broad at the chest, narrowing to the belt. */
function torsoWidth(y: number, top: number, waist: number, chest: number): number {
  const u = Math.max(0, (y + 0.5 - top) / (waist - top));
  return chest - 0.8 * u * u;
}

// ---------------------------------------------------------------------------
// Nightbloom

/** Her waist sits a pixel higher than his, for a longer skirt. */
const NB_WAIST = 21;
/** Where the petal skirt ends, above the feet. */
const NB_HEM = 26.5;

/** A moonflower: a round white bloom with a pale gold heart (small: a plus of petals). */
function moonflower(c: PixelCanvas, x: number, y: number, big: boolean, bias = 0): void {
  c.part();
  const pts: [number, number][] = big
    ? [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]
    : [[0, -1], [-1, 0], [1, 0], [0, 1]];
  for (const [dx, dy] of pts) c.px(x + dx, y + dy, MOONFLOWER, sphere(dx * 0.6, dy * 0.6), { bias: bias + (dx && dy ? -1 : 0) });
  c.px(x, y, JASMINE, sphere(0, 0), { bias: bias + 1, glow: 0.6 });
  c.spark(x, y, BLOOM_HEART, big ? 0.7 : 0.45);
}

/** A jasmine star tucked in the hair: one bright point. */
function jasmine(c: PixelCanvas, x: number, y: number): void {
  c.px(x, y, JASMINE, sphere(0, -0.3));
  c.spark(x, y, [255, 250, 230], 0.3);
}

/** The silk veil hanging from her crown: folds down it, silver beads along its hem. */
function sheer(c: PixelCanvas, y0: number, y1: number, edge: (y: number) => [number, number], bias = 0): void {
  c.part();
  const a = Math.round(y0);
  const b = Math.round(y1);
  for (let y = a; y <= b; y++) {
    const [l, r] = edge(y);
    const xa = Math.round(l);
    const xb = Math.round(r) - 1;
    for (let x = xa; x <= xb; x++) {
      const t = xb > xa ? ((x - xa) / (xb - xa)) * 2 - 1 : 0;
      if (y === b) {
        if ((x & 1) === 0) c.px(x, y, MOONSILVER, sphere(t * 0.5, 0.3), { bias });
        continue;
      }
      // Darker within, with long folds falling down it; its edges catch the light.
      const rim = x === xa || x === xb;
      const fold = !rim && (x - xa) % 3 === 2;
      c.px(x, y, NB_VEIL, sphere(t * 0.7, -0.2 + ((y - a) / Math.max(1, b - a)) * 0.4, 1), { bias: bias + (rim ? 0 : fold ? -2 : -1) });
    }
  }
}

/** The petal skirt's hem: every other pixel hangs one lower, a point of a petal. */
function petalHem(c: PixelCanvas, y: number, l: number, r: number, flutter: number, bias = 0): void {
  for (let x = Math.round(l); x < Math.round(r); x++) {
    if (((x + flutter) & 1) === 0 && c.filled(x, y)) c.px(x, y + 1, NB_VEIL, sphere(0, 0.5), { bias: bias - 1 });
  }
}

/** Her bare torso: shoulders to a slim waist. */
const nbWidth = (y: number, top: number, waist: number): number => {
  const u = Math.max(0, Math.min(1, (y + 0.5 - top) / (waist - top)));
  return 3.6 - u * 0.9 + (u > 0.85 ? 0.2 : 0);
};

/**
 * The torso from the front or behind: skin, a silk bodice with a dipped
 * neckline (straps across the back), a bare midriff, the chain belt with its
 * hanging links, and the petal skirt with its panels.
 */
function bloomBody(c: PixelCanvas, cx: number, U: number, L: number, sway: number, front: boolean): void {
  const top = 15 + U;
  const waist = NB_WAIST + U;
  const hem = NB_HEM + L;
  c.part();
  c.shape(top, waist, (y) => {
    const hw = nbWidth(y, top, waist);
    return [cx - hw, cx + hw];
  }, NB_SKIN, (_x, y, t) => sphere(t * 0.9, ((y - top) / (waist - top)) * 0.7 - 0.3, 1));
  // The bodice.
  c.part();
  c.shape(top + 1, top + 4, (y) => {
    const hw = nbWidth(y, top, waist) + 0.1;
    return [cx - hw, cx + hw];
  }, NB_SILK, (_x, y, t) => sphere(t * 0.9, (y - top - 2.5) * 0.3, 1));
  if (front) {
    // A sweetheart neckline, a fold beneath it, and the silver trim at its edge.
    c.erase(cx - 1, top + 1);
    c.erase(cx, top + 1);
    c.px(cx - 1, top + 1, NB_SKIN, sphere(-0.2, 0.2));
    c.px(cx, top + 1, NB_SKIN, sphere(0.2, 0.2), { bias: -1 });
    c.shade(cx - 1, top + 3, -1);
    c.part();
    for (let x = Math.round(cx - 2.6); x < cx + 2.6; x++) if ((x & 1) === 0) c.px(x, top + 4, S.metal, sphere(0, 0.3), { bias: -1 });
    // A crescent pendant on a fine chain at her throat.
    c.px(cx - 1, top, S.metal, sphere(-0.2, -0.4));
    c.spark(cx - 1, top, [230, 236, 255], 0.5);
    // The navel's little shadow.
    c.shade(cx - 1, waist - 1, -1);
  } else {
    // Bare back: the bodice laced up the middle.
    for (let y = top + 1; y <= top + 4; y++) c.px(cx - 1 + ((y & 1) ? 0 : 1), y, S.metal, sphere(0, -0.2), { bias: -1 });
    c.shade(cx - 1, top + 6, -1);
  }
  // The petal skirt: panels of indigo silk flaring from the belt, folds between them.
  c.part();
  const skirt = (y: number): [number, number] => {
    const u = (y - waist) / Math.max(1, hem - waist);
    const hw = 3.0 + u * 1.9;
    const s = sway * u * 0.45;
    return [cx - hw + s, cx + hw + s];
  };
  c.shape(Math.round(waist), Math.round(hem), skirt, NB_VEIL, (_x, y, t) => sphere(t * 0.9, ((y - waist) / Math.max(1, hem - waist)) * 0.5 - 0.1, 1));
  for (let y = Math.round(waist + 2); y <= hem; y++) {
    const u = (y - waist) / Math.max(1, hem - waist);
    const s = sway * u * 0.45;
    for (const k of [-2.6, 0, 2.2]) c.shade(Math.round(cx + k * (1 + u * 0.5) - 0.5 + s), y, -1);
  }
  const [hl, hr] = skirt(Math.round(hem));
  petalHem(c, Math.round(hem), hl, hr, Math.round(sway));
  // Stars stitched into the silk in moon-thread, faintly lit.
  for (const [dx, dy] of [[-2, 2], [2, 3], [-3, 4], [1, 5]] as const) {
    const y = waist + dy;
    if (y < hem) c.spark(cx + dx + Math.round(sway * ((y - waist) / (hem - waist)) * 0.45), y, [200, 190, 255], 0.35);
  }
  // The chain belt, links hanging below it.
  c.part();
  c.shape(Math.round(waist), Math.round(waist), () => [cx - 3.1, cx + 3.1], S.metal, (_x, _y, t) => cyl(t, 0.3));
  for (let x = Math.round(cx - 2.6); x < cx + 2.6; x += 2) c.px(x, waist + 1, S.metal, sphere(0, 0.4), { bias: -1 });
}

/** Long hair behind the head and down her back, swaying (`len`: how far it falls). */
function hairFall(c: PixelCanvas, cx: number, U: number, sway: number, len: number, bias = 0): void {
  c.part();
  c.ellipse(cx, 11.4 + U, 4.0, 3.9, S.hood, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1), bias });
  const y0 = 12 + U;
  const y1 = 12 + U + len;
  c.shape(Math.round(y0), Math.round(y1), (y) => {
    const u = (y - y0) / (y1 - y0);
    const hw = 4.1 - u * 1.6 - (u > 0.85 ? (u - 0.85) * 8 : 0);
    const s = sway * u * 0.5;
    return hw < 0.4 ? null : [cx - hw + s, cx + hw + s];
  }, S.hood, (x, _y, t, u) => sphere(t * 0.85, u * 0.5 - 0.2 + (x & 1 ? 0.12 : -0.12), 1), { bias });
}

function bloomDown(c: PixelCanvas, p: Pose, U: number, L: number, behindArms: () => void, frontArms: () => void, head: (d: () => void) => void): void {
  const cx = 12;
  // The veil from her crown, falling behind her past her hips.
  sheer(c, 9 + U, 25 + U, (y) => {
    const u = (y - 9 - U) / 16;
    const hw = 3.6 + u * 2.6;
    const s = p.sway * u * 0.6;
    return [cx - hw + s, cx + hw + s];
  }, -1);
  hairFall(c, cx, U, p.sway, 8, -1);
  behindArms();
  leg(c, 10.6, NB_WAIST + 1 + L, 10.3 - p.footA * 0.2, 28.6 - p.footA);
  leg(c, 13.4, NB_WAIST + 1 + L, 13.7 + p.footB * 0.2, 28.6 - p.footB);
  boot(c, 10.3, 29.8 - p.footA);
  boot(c, 13.7, 29.8 - p.footB);
  bloomBody(c, cx, U, L, p.sway, true);
  // The sashes from the moonflower knotted at her hip, trailing to her ankles.
  tails(c, cx + 2.6, NB_WAIST + 0.8 + U, 1, Math.max(0.35, p.stream), p.sway);
  moonflower(c, cx + 2.6, NB_WAIST + U, false);
  head(() => {
    // Her face, and her hair: a fringe swept to one side and locks falling in front of her shoulders.
    c.part();
    c.ellipse(cx, 12.7 + U, 2.6, 2.7, NB_SKIN);
    c.part();
    c.shape(8 + U, 11 + U, (y) => {
      const r = y - 8 - U;
      if (r === 0) return [cx - 3.2, cx + 3.2];
      if (r === 1) return [cx - 3.8, cx + 3.8];
      if (r === 2) return [cx - 3.9, cx + 1.4];
      return [cx - 3.9, cx - 1.6];
    }, S.hood, (_x, y, t) => sphere(t * 0.8, y === 8 + U ? -0.7 : -0.1, 1));
    c.capsule(cx + 3.2, 11 + U, cx + 3.4, 11.5 + U, 0.9, 0.9, S.hood);
    for (const sd of [-1, 1]) c.capsule(cx + sd * 3.3, 11.5 + U, cx + sd * 3.6 + p.sway * 0.25, 19 + U, 1.15, 0.8, S.hood);
    eyes(c, [[cx - 2, 12 + U], [cx + 1, 12 + U]], p.blink);
    c.part();
    c.px(cx - 1, 14 + U, NB_LIP, sphere(0, 0.2));
    moonflower(c, cx + 3, 9 + U, true);
    jasmine(c, cx - 3, 9 + U);
    jasmine(c, cx - 4, 15 + U);
    jasmine(c, cx + 4, 17 + U);
  });
  frontArms();
}

function bloomUp(c: PixelCanvas, p: Pose, U: number, L: number, behindArms: () => void, frontArms: () => void): void {
  const cx = 12;
  behindArms();
  leg(c, 10.6, NB_WAIST + 1 + L, 10.3, 28.6 - p.footB);
  leg(c, 13.4, NB_WAIST + 1 + L, 13.7, 28.6 - p.footA);
  boot(c, 10.3, 29.8 - p.footB);
  boot(c, 13.7, 29.8 - p.footA);
  bloomBody(c, cx, U, L, p.sway, false);
  // The veil from her crown, flaring out past her hair to her hips.
  sheer(c, 9 + U, 23 + U, (y) => {
    const u = (y - 9 - U) / 14;
    const hw = 3.4 + u * 2.8;
    const s = p.sway * u * 0.7;
    return [cx - hw + s, cx + hw + s];
  });
  // Her hair over it, down to the small of her back, jasmine woven down it.
  hairFall(c, cx, U, p.sway, 9);
  c.part();
  for (const [dy, dx] of [[2, 0], [4.5, -1], [7, 0]] as const) jasmine(c, cx - 0.5 + dx + p.sway * (dy / 9) * 0.5, 12 + U + dy);
  moonflower(c, cx + 3, 9 + U, true);
  tails(c, cx - 2.6, NB_WAIST + 0.8 + U, -1, p.stream * 0.3 + 0.1, p.sway);
  moonflower(c, cx - 2.6, NB_WAIST + U, false);
  frontArms();
}

/** Facing left: the veil and hair streaming back behind her, the skirt flaring behind as she moves. */
function bloomSide(c: PixelCanvas, p: Pose, U: number, L: number, hx: number, farArm: () => void, nearArm: () => void): void {
  const cx = 12;
  const k = p.stream;
  sheer(c, 9 + U, 24 + U - k * 3, (y) => {
    const u = (y - 9 - U) / (15 - k * 3);
    return [hx + 0.6 + u * (1 + k * 2.5), hx + 3.6 + u * (2.6 + k * 4)];
  }, -1);
  // The long fall of hair down her back.
  c.part();
  c.capsule(hx + 1.6, 12 + U, hx + 3 + k * 2.6, 20 + U - k * 2.4, 2.2, 1.1, S.hood, { bias: -1 });
  farArm();
  const lift = (f: number) => Math.max(0, f) * 0.35;
  leg(c, cx + 0.8, NB_WAIST + 1 + L, cx + 1 - p.footB, 28.6 - lift(p.footB), -1);
  boot(c, cx + 0.4 - p.footB, 29.8 - lift(p.footB), true, -1);
  leg(c, cx - 0.6, NB_WAIST + 1 + L, cx - 0.4 - p.footA, 28.6 - lift(p.footA));
  boot(c, cx - 1.2 - p.footA, 29.8 - lift(p.footA), true);

  const top = 15 + U;
  const waist = NB_WAIST + U;
  const hem = NB_HEM + L;
  c.part();
  c.shape(top, waist, (y) => {
    const u = (y - top) / (waist - top);
    return [hx - 2.6 + u * 0.5, hx + 2.6 - u * 0.4];
  }, NB_SKIN, (_x, y, t) => sphere(t * 0.9 - 0.1, ((y - top) / (waist - top)) * 0.7 - 0.3, 1));
  c.part();
  c.shape(top + 1, top + 4, (y) => [hx - (y === top + 2 || y === top + 3 ? 3.1 : 2.7), hx + 2.6], NB_SILK, (_x, y, t) => sphere(t * 0.9 - 0.1, (y - top - 2.5) * 0.3, 1));
  c.part();
  c.px(hx - 3, top + 4, S.metal, sphere(-0.5, 0.3), { bias: -1 });
  c.px(hx - 3, top, S.metal, sphere(-0.4, -0.4));
  c.spark(hx - 3, top, [230, 236, 255], 0.4);
  c.part();
  const skirt = (y: number): [number, number] => {
    const u = (y - waist) / Math.max(1, hem - waist);
    return [hx - 2.4 - u * (1.2 - k * 0.6) + (cx - hx) * u * 0.5, hx + 2.4 + u * (1.6 + k * 2.4)];
  };
  c.shape(Math.round(waist), Math.round(hem), skirt, NB_VEIL, (_x, y, t) => sphere(t * 0.9 - 0.1, ((y - waist) / Math.max(1, hem - waist)) * 0.5 - 0.1, 1));
  for (let y = Math.round(waist + 2); y <= hem; y++) {
    const [l, r] = skirt(y);
    c.shade(Math.round(l + (r - l) * 0.55), y, -1);
  }
  const [hl, hr] = skirt(Math.round(hem));
  petalHem(c, Math.round(hem), hl, hr, 0);
  c.spark(Math.round(hx - 1), waist + 3, [200, 190, 255], 0.35);
  c.spark(Math.round(hx + 2), waist + 4, [200, 190, 255], 0.35);
  c.part();
  c.shape(Math.round(waist), Math.round(waist), () => [hx - 2.2, hx + 2.4], S.metal, (_x, _y, t) => cyl(t, 0.3));
  tails(c, hx + 2.2, waist + 0.8, 1, k, 0);
  moonflower(c, hx + 2, waist, false);

  // Her head in profile: hair, the face, a fringe over the brow, the moonflower behind her ear.
  c.part();
  c.ellipse(hx + 0.6, 11.4 + U, 3.4, 3.6, S.hood, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.2, dy * 0.8 - 0.1, 1) });
  c.part();
  c.ellipse(hx - 1.2, 12.8 + U, 2.2, 2.3, NB_SKIN);
  c.px(hx - 4, 12.6 + U, NB_SKIN, sphere(-0.7, -0.1), { bias: 1 });
  c.part();
  c.shape(8 + U, 10 + U, (y) => [hx - 3.4 + (10 + U - y) * 0.7, hx + 3.2], S.hood, (_x, _y, t, u) => sphere(t * 0.9, u - 0.7, 1));
  c.capsule(hx + 0.6, 11 + U, hx + 1.2, 16.5 + U, 1.3, 0.9, S.hood);
  eyes(c, [[hx - 3, 12 + U]], p.blink);
  c.part();
  c.px(hx - 3, 14 + U, NB_LIP, sphere(-0.3, 0.2));
  moonflower(c, hx + 1.6, 9.6 + U, true);
  jasmine(c, hx + 2.6, 14 + U);
  jasmine(c, hx + 3.4 + k * 1.8, 17 + U - k);
  nearArm();
}

function drawDown(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('down', 'a', p.a, U, cx);
  const fb = place('down', 'b', p.b, U, cx);
  const [tax, tay] = bladeTip('down', 'a', p.a, p.da, U, cx, fa);
  const [tbx, tby] = bladeTip('down', 'b', p.b, p.db, U, cx, fb);
  // A blade pointing up past the fist is behind the arm; otherwise in front of it.
  const armA = (bias: number) => {
    if (!p.toss && tay < fa.y - 1) dagger(c, fa, tax, tay, p.gleam, bias);
    arm(c, 7.6, 16.4 + U, fa, REACH_FRONT, [-0.35, 1], bias);
    if (!p.toss && tay >= fa.y - 1) dagger(c, fa, tax, tay, p.gleam, bias);
  };
  // Everything above the collar, drawn nudged by the pose's head offset.
  const head = (draw: () => void) => {
    c.offset(BODY_X, BODY_Y + (p.headY ?? 0));
    draw();
    c.offset(BODY_X, BODY_Y);
  };
  // The tossed dagger flies over everything.
  const flying = () => {
    if (p.toss) tossed(c, p.toss.x, p.toss.y, p.toss.ang, p.gleam);
  };
  const armB = (bias: number) => {
    if (tby < fb.y - 1) dagger(c, fb, tbx, tby, p.gleam, bias);
    arm(c, 16.4, 16.4 + U, fb, REACH_FRONT, [0.35, 1], bias);
    if (tby >= fb.y - 1) dagger(c, fb, tbx, tby, p.gleam, bias);
  };

  if (S.bloom) {
    bloomDown(c, p, U, L, () => {
      if (fa.behind) armA(-1);
      if (fb.behind) armB(-1);
    }, () => {
      if (!fb.behind) armB(0);
      if (!fa.behind) armA(0);
      flying();
    }, head);
    return;
  }

  // The scarf's tails, flicking out past his shoulder (the corsair's bandana knot sits higher, under his hat).
  tails(c, cx + 2.5, (S.corsair ? 10.8 : 13.5) + U, 1, Math.max(0.35, p.stream), p.sway, -1);
  if (S.kitsune) foxTails(c, cx + 0.5, 21 + U, [[cx - 6.4 + p.sway * 0.4, 15.5 + U], [cx + 7.6 + p.sway * 0.4, 21.5 + U], [cx + 6.4 + p.sway * 0.4, 15 + U]], -1);
  if (S.corsair) {
    // The coat's tails, hanging behind his legs to the knee.
    c.part();
    c.shape(22 + U, 26 + L, (y) => {
      const u = (y - 22 - U) / Math.max(1, 4 + L - U);
      const hw = 4.3 + u * 1.0;
      return [cx - hw + p.sway * u * 0.4, cx + hw + p.sway * u * 0.4];
    }, S.vest, (_x, _y, t, u) => sphere(t * 0.9, u * 0.4, 1), { bias: -1 });
  }
  if (fa.behind) armA(-1);
  if (fb.behind) armB(-1);

  leg(c, 10.3, 22.5 + L, 10 - p.footA * 0.2, 28.4 - p.footA);
  leg(c, 13.7, 22.5 + L, 14 + p.footB * 0.2, 28.4 - p.footB);
  boot(c, 10, 29.6 - p.footA);
  boot(c, 14, 29.6 - p.footB);

  // Shirt, then the vest over it, open at the front in a narrow V.
  const top = 15 + U;
  const waist = 22 + U;
  c.part();
  c.shape(top, waist + 1, (y) => {
    const hw = torsoWidth(y, top, waist, 4.2);
    return [cx - hw, cx + hw];
  }, S.shirt, (_x, y, t) => sphere(t * 0.9, ((y - top) / (waist - top)) * 0.8 - 0.35, 1));
  c.part();
  c.shape(top, waist + 1, (y) => {
    const hw = torsoWidth(y, top, waist, 4.2) + 0.1;
    return [cx - hw, cx + hw];
  }, S.vest, (_x, y, t) => sphere(t * 0.9, ((y - top) / (waist - top)) * 0.8 - 0.3, 1));
  for (let y = top; y <= waist - 2; y++) {
    const v = Math.max(0, 1.4 - (y - top) * 0.28);
    for (let x = Math.round(cx - v); x < Math.round(cx + v); x++) c.erase(x, y);
  }
  for (let y = top + 3; y <= waist + 1; y++) c.shade(cx, y, -1);
  if (S.corsair) {
    // A frill of linen down the open front, and gold buttons either side of it.
    c.part();
    for (const [x, y] of [[cx - 1, top], [cx, top], [cx - 1, top + 1], [cx, top + 2], [cx - 1, top + 3]] as const) c.px(x, y, LINEN, sphere(x < cx ? -0.3 : 0.3, -0.2), { bias: 1 });
    for (const y of [top + 3, top + 5]) {
      c.px(cx - 3, y, S.metal, sphere(-0.3, -0.4));
      c.px(cx + 2, y, S.metal, sphere(0.3, -0.4), { bias: -1 });
    }
  }
  // The sash, knotted at his left hip, a short tail hanging from the knot.
  c.part();
  c.shape(waist, waist + 1, () => [cx - 4.1, cx + 4.1], S.sash, (_x, y, t) => cyl(t, y === waist ? 0.3 : -0.2));
  c.part();
  c.ellipse(cx + 2.6, waist + 0.6, 1.1, 1, S.sash);
  c.capsule(cx + 2.8, waist + 1.5, cx + 3.2 + p.sway * 0.2, waist + 4, 0.8, 0.55, S.sash);
  // A belt slung from the right shoulder to the left hip, a pouch on it.
  c.part();
  c.capsule(8.4, 15.6 + U, 15, 21.2 + U, 0.5, 0.5, HILT);
  c.part();
  c.ellipse(9, 22.6 + U, 1.2, 1, S.hilt);
  c.px(9, 22 + U, S.metal, sphere(-0.3, -0.5));

  if (S.corsair) {
    epaulettes(c, [[7.4, 15.6 + U], [16.6, 15.6 + U]]);
    head(() => {
      corsairFace(c, cx, U, p.blink);
      tricorn(c, cx, U, true);
    });
    if (!fb.behind) armB(0);
    if (!fa.behind) armA(0);
    flying();
    return;
  }
  mantle(c, cx, U, 5.4, 5.4);

  if (S.kitsune) {
    // The hood with a fox's ears standing up out of it, the mask under its brim.
    head(() => {
      c.part();
      c.ellipse(cx, 11.3 + U, 3.9, 3.7, S.hood, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
      ear(c, cx - 2.4, 9 + U, cx - 3.9, 4 + U);
      ear(c, cx + 2.4, 9 + U, cx + 3.9, 4 + U, -1);
      foxMask(c, cx, U, p.blink);
      c.part();
      c.shape(10 + U, 10 + U, () => [cx - 2.6, cx + 2.6], S.hood, (_x, _y, t) => sphere(t * 0.8, -0.5, 1));
    });
    if (!fb.behind) armB(0);
    if (!fa.behind) armA(0);
    flying();
    return;
  }

  // Head: the hood, the face in its shadow, the scarf pulled up over the nose (or the mask).
  head(() => {
    c.part();
    c.ellipse(cx, 11.3 + U, 3.9, 3.7, S.hood, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
    c.part();
    // The hood's peak.
    c.px(cx - 1, 7 + U, S.hood, sphere(-0.3, -0.8));
    c.px(cx, 7 + U, S.hood, sphere(0.1, -0.8));
    c.part();
    c.ellipse(cx, 12.7 + U, 2.5, 2.3, SKIN);
    // The hood's brim low over the brow, only the eyes showing under it.
    c.part();
    c.shape(10 + U, 10 + U, () => [cx - 2.6, cx + 2.6], S.hood, (_x, _y, t) => sphere(t * 0.8, -0.5, 1));
    for (let x = cx - 2; x <= cx + 1; x++) c.shade(x, 11 + U, -1);
    c.part();
    c.shape(13 + U, 15 + U, (y) => {
      const hw = y === 15 + U ? 2.3 : 2.7;
      return [cx - hw, cx + hw];
    }, S.scarf, (_x, y, t) => sphere(t * 0.9, (y - 13 - U) * 0.35 - 0.2, 1));
    c.shade(cx - 1, 14 + U, -1);
    if (S.mask) {
      // A silver half-mask across the eyes, swept up at the temples.
      c.part();
      c.shape(11 + U, 12 + U, (y) => (y === 11 + U ? [cx - 3.2, cx + 3.2] : [cx - 2.8, cx + 2.8]), MASK, (_x, y, t) => sphere(t * 0.9, y === 11 + U ? 0.4 : -0.1, 1));
    }
    eyes(c, [[cx - 2, 12 + U], [cx + 1, 12 + U]], p.blink);
  });

  if (!fb.behind) armB(0);
  if (!fa.behind) armA(0);
  flying();
}

function drawUp(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('up', 'a', p.a, U, cx);
  const fb = place('up', 'b', p.b, U, cx);
  const [tax, tay] = bladeTip('up', 'a', p.a, p.da, U, cx, fa);
  const [tbx, tby] = bladeTip('up', 'b', p.b, p.db, U, cx, fb);
  const armA = (bias: number) => {
    dagger(c, fa, tax, tay, p.gleam, bias);
    arm(c, 7.6, 16.4 + U, fa, REACH_FRONT, [-0.35, 0.8], bias);
  };
  const armB = (bias: number) => {
    dagger(c, fb, tbx, tby, p.gleam, bias);
    arm(c, 16.4, 16.4 + U, fb, REACH_FRONT, [0.35, 0.8], bias);
  };
  if (S.bloom) {
    bloomUp(c, p, U, L, () => {
      if (fa.behind) armA(-1);
      if (fb.behind) armB(-1);
    }, () => {
      if (!fb.behind) armB(0);
      if (!fa.behind) armA(0);
    });
    return;
  }
  if (fa.behind) armA(-1);
  if (fb.behind) armB(-1);

  leg(c, 10.3, 22.5 + L, 10, 28.4 - p.footB);
  leg(c, 13.7, 22.5 + L, 14, 28.4 - p.footA);
  boot(c, 10, 29.6 - p.footB);
  boot(c, 14, 29.6 - p.footA);

  // The vest's back, the sash round it, the knot's tail at his left hip.
  const top = 15 + U;
  const waist = 22 + U;
  if (S.corsair) {
    // The captain's coat from behind, down to the knee with a vent up the back,
    // the epaulettes, his hair tied back, the bandana's ends and the tricorn.
    const hem = 26 + L;
    c.part();
    c.shape(top, hem, (y) => {
      const u = (y - top) / (hem - top);
      const hw = y <= waist ? torsoWidth(y, top, waist, 4.3) : 4.2 + (y - waist) * 0.3;
      return [cx - hw + p.sway * u * 0.3, cx + hw + p.sway * u * 0.3];
    }, S.vest, (_x, y, t) => sphere(t * 0.9, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.3 : 0.25, 1));
    for (let y = top + 2; y <= hem; y++) c.shade(cx + (y > waist + 1 ? Math.round(p.sway * 0.3) : 0), y, y > waist + 1 ? -2 : -1);
    c.part();
    for (const x of [cx - 2, cx + 1]) c.px(x, waist, S.metal, sphere(0, -0.3));
    epaulettes(c, [[7.4, 15.6 + U], [16.6, 15.6 + U]]);
    c.part();
    c.ellipse(cx, 11.8 + U, 3.3, 3.0, PIRATE_HAIR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 1) });
    c.part();
    c.capsule(cx - 0.5, 13 + U, cx - 0.5 + p.sway * 0.2, 18 + U, 1.3, 0.9, PIRATE_HAIR);
    c.part();
    c.px(cx - 1, 14 + U, S.scarf, sphere(-0.3, 0));
    c.px(cx, 14 + U, S.scarf, sphere(0.3, 0));
    tails(c, cx + 0.6, 11 + U, p.sway >= 0 ? 1 : -1, p.stream * 0.3, p.sway);
    tricorn(c, cx, U, false);
    if (!fb.behind) armB(0);
    if (!fa.behind) armA(0);
    return;
  }
  c.part();
  c.shape(top, waist + 1, (y) => {
    const hw = torsoWidth(y, top, waist, 4.2) + 0.1;
    return [cx - hw, cx + hw];
  }, S.vest, (_x, y, t) => sphere(t * 0.9, ((y - top) / (waist - top)) * 0.8 - 0.3, 1));
  for (let y = top + 2; y <= waist; y++) c.shade(cx, y, -1);
  c.part();
  c.shape(waist, waist + 1, () => [cx - 4.1, cx + 4.1], S.sash, (_x, y, t) => cyl(t, y === waist ? 0.3 : -0.2));
  c.part();
  c.capsule(cx - 2.8, waist + 1.5, cx - 3.2 + p.sway * 0.2, waist + 4, 0.8, 0.55, S.sash);
  // The belt across his back.
  c.part();
  c.capsule(15.6, 15.6 + U, 9, 21.2 + U, 0.5, 0.5, HILT);

  mantle(c, cx, U, 5.4, 5.4);
  // The back of the hood, drawn to a point.
  c.part();
  c.ellipse(cx, 11.4 + U, 3.9, 3.7, S.hood, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 1) });
  c.part();
  c.shape(14 + U, 16 + U, (y) => {
    const hw = 1.4 - (y - 14 - U) * 0.5;
    return hw < 0.3 ? null : [cx - hw, cx + hw];
  }, S.hood, (_x, _y, t, u) => sphere(t * 0.8, u * 0.6, 1));
  c.shade(cx, 9 + U, 1);
  if (S.kitsune) {
    // Ears up out of the hood, and the three tails fanned over his back.
    ear(c, cx - 2.4, 9 + U, cx - 3.9, 4 + U);
    ear(c, cx + 2.4, 9 + U, cx + 3.9, 4 + U);
    foxTails(c, cx, 21 + U, [[cx - 6 + p.sway * 0.4, 14.5 + U], [cx + 0.6 + p.sway * 0.4, 15 + U], [cx + 6 + p.sway * 0.4, 14.5 + U]]);
  } else {
    // The scarf knotted at the nape, its tails down his back.
    c.part();
    c.ellipse(cx, 14.2 + U, 1.3, 0.9, S.scarf);
    tails(c, cx - 0.4, 14.6 + U, p.sway >= 0 ? 1 : -1, p.stream * 0.3, p.sway);
  }

  if (!fb.behind) armB(0);
  if (!fa.behind) armA(0);
}

/** Facing left. Right-facing frames are mirrored from these. */
function drawSide(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const hx = cx - p.lean; // upper body centre
  const fa = place('side', 'a', p.a, U, hx);
  const fb = place('side', 'b', p.b, U, hx);
  const [tax, tay] = bladeTip('side', 'a', p.a, p.da, U, hx, fa);
  const [tbx, tby] = bladeTip('side', 'b', p.b, p.db, U, hx, fb);

  if (S.bloom) {
    bloomSide(c, p, U, L, hx, () => {
      dagger(c, fb, tbx, tby, p.gleam, -1);
      arm(c, hx + 1.2, 16.6 + U, fb, REACH_SIDE, [0.3, 1], -1);
    }, () => {
      const back = tax > fa.x + 1;
      if (back) dagger(c, fa, tax, tay, p.gleam);
      arm(c, hx + 0.2, 16.8 + U, fa, REACH_SIDE, [0.4, 1]);
      if (!back) dagger(c, fa, tax, tay, p.gleam);
    });
    return;
  }

  // The scarf's tails behind his head, streaming as he runs (the fox's tails from the small of the back).
  tails(c, hx + 2.6, (S.corsair ? 10.8 : 13.4) + U, 1, p.stream, 0, -1);
  if (S.kitsune) {
    const k = p.stream;
    foxTails(c, hx + 2.4, 21 + U, [[hx + 6.4 + k * 1.2, 11.8 + U + k * 1.5], [hx + 8.4 + k * 1.4, 15 + U + k * 1.2], [hx + 7.6 + k * 1.2, 19.5 + U]], -1);
  }
  if (S.corsair) {
    // The coat's tails behind his legs, flaring as he runs.
    c.part();
    c.shape(22 + U, 26 + L, (y) => {
      const u = (y - 22 - U) / Math.max(1, 4 + L - U);
      return [hx + 0.2 + (cx - hx) * u * 0.5, hx + 3.4 + u * (1 + p.stream * 1.6)];
    }, S.vest, (_x, _y, t, u) => sphere(t * 0.9 + 0.1, u * 0.4, 1), { bias: -1 });
  }

  // Far arm and its dagger behind everything.
  dagger(c, fb, tbx, tby, p.gleam, -1);
  arm(c, hx + 1.2, 16.6 + U, fb, REACH_SIDE, [0.3, 1], -1);

  // Legs: back leg in shade first, then the front leg.
  const lift = (f: number) => Math.max(0, f) * 0.35;
  leg(c, cx + 0.8, 22.5 + L, cx + 1 - p.footB, 28.4 - lift(p.footB), -1);
  boot(c, cx + 0.4 - p.footB, 29.7 - lift(p.footB), true, -1);
  leg(c, cx - 0.6, 22.5 + L, cx - 0.4 - p.footA, 28.4 - lift(p.footA));
  boot(c, cx - 1.2 - p.footA, 29.7 - lift(p.footA), true);

  // The torso in profile: shirt, vest, the sash with its tail behind.
  const ttop = 15 + U;
  const waist = 22 + U;
  c.part();
  c.shape(ttop, waist + 1, (y) => {
    const u = y <= waist ? 0 : 1;
    const shift = hx + (cx - hx) * u * 0.5;
    const hw = torsoWidth(y, ttop, waist, 3);
    return [shift - hw - 0.2, shift + hw + 0.2];
  }, S.vest, (_x, y, t) => sphere(t * 0.9 - 0.1, ((y - ttop) / (waist - ttop)) * 0.8 - 0.3, 1));
  c.part();
  // The shirt showing at the vest's open front.
  c.shape(ttop + 1, waist - 2, () => [hx - 3.2, hx - 2.2], S.shirt, () => sphere(-0.6, 0, 1));
  c.part();
  c.shape(waist, waist + 1, () => [hx - 3.2, hx + 3.2], S.sash, (_x, y, t) => cyl(t, y === waist ? 0.3 : -0.2));
  c.part();
  c.capsule(hx + 2.8, waist + 1, hx + 3.8 + p.stream * 1.6, waist + 3.6 - p.stream * 1.2, 0.8, 0.55, S.sash);
  // The belt down the chest.
  c.part();
  c.capsule(hx + 1.8, 15.4 + U, hx - 2.3, 21.4 + U, 0.5, 0.5, HILT);

  if (S.corsair) {
    // A frill of linen at the open front, an epaulette, and his head: hair
    // down his back, the bandana, the patch and its strap, a goatee, then the
    // tricorn in profile, cocked up fore and aft.
    c.part();
    for (const y of [ttop, ttop + 1, ttop + 2]) c.px(Math.round(hx - 3.4 + ((y - ttop) & 1) * 0.6), y, LINEN, sphere(-0.5, -0.2), { bias: 1 });
    epaulettes(c, [[hx + 0.4, 15.6 + U]]);
    c.part();
    c.ellipse(hx + 1, 12 + U, 2.6, 3.0, PIRATE_HAIR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.2, dy * 0.8, 1) });
    c.capsule(hx + 2.2, 13 + U, hx + 3 + p.stream * 0.8, 18 + U, 1.2, 0.8, PIRATE_HAIR);
    c.part();
    c.ellipse(hx - 1.4, 12.8 + U, 2.2, 2.2, SKIN);
    c.part();
    c.px(hx - 4, 12.6 + U, SKIN, sphere(-0.7, -0.1), { bias: 1 });
    c.part();
    c.shape(10 + U, 10 + U, () => [hx - 3.6, hx + 1.4], S.scarf, (_x, _y, t) => sphere(t * 0.8, -0.3, 1));
    c.px(hx - 3, 15 + U, PIRATE_HAIR, sphere(-0.3, 0.3));
    c.px(hx - 2, 15 + U, PIRATE_HAIR, sphere(0.2, 0.3), { bias: -1 });
    c.shade(hx - 3, 14 + U, -1);
    c.part();
    c.px(hx - 3, 12 + U, PATCH, sphere(-0.2, 0));
    for (const [dx, y] of [[-2, 11], [-1, 11], [0, 11], [1, 11]] as const) c.px(hx + dx, y + U, PATCH, sphere(0, -0.2));
    c.part();
    c.shape(6 + U, 8 + U, (y) => [hx - [1.8, 2.4, 2.6][y - 6 - U], hx + [2.2, 2.8, 3.0][y - 6 - U]], TRICORN, (_x, _y, t, u) => sphere(t * 0.9, u * 0.9 - 0.8, 1));
    c.shape(9 + U, 9 + U, () => [hx - 4.6, hx + 4.4], TRICORN, (_x, _y, t) => sphere(t * 0.7, 0.2, 1));
    c.px(hx - 5, 8 + U, TRICORN, sphere(-0.6, -0.6), { bias: 1 });
    c.px(hx + 4, 8 + U, TRICORN, sphere(0.6, -0.6));
    c.part();
    c.px(hx - 5, 7 + U, S.metal, sphere(-0.4, -0.6));
    c.px(hx + 4, 7 + U, S.metal, sphere(0.4, -0.6));
    const back = tax > fa.x + 1;
    if (back) dagger(c, fa, tax, tay, p.gleam);
    arm(c, hx + 0.2, 16.8 + U, fa, REACH_SIDE, [0.4, 1]);
    if (!back) dagger(c, fa, tax, tay, p.gleam);
    return;
  }
  mantle(c, hx, U, 4, 4.2);

  if (S.kitsune) {
    // The hood, the far ear and the near one, the fox mask in profile with its
    // snout thrust forward, and the brim over it.
    c.part();
    c.ellipse(hx + 0.4, 11.4 + U, 3.4, 3.6, S.hood, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.2, dy * 0.8 - 0.1, 1) });
    ear(c, hx + 2, 9 + U, hx + 2.4, 4.4 + U, -1);
    ear(c, hx + 0.2, 9 + U, hx - 0.8, 3.8 + U);
    c.part();
    c.ellipse(hx - 1.4, 12.6 + U, 2.2, 2.1, FOX_MASK);
    c.part();
    c.capsule(hx - 2.6, 13.2 + U, hx - 5.2, 14.2 + U, 1.1, 0.6, FOX_MASK);
    c.part();
    c.px(hx - 6, 14 + U, PATCH, sphere(-0.4, 0.2));
    c.px(hx - 2, 11 + U, S.vest, sphere(0, -0.2));
    c.px(hx - 3, 13 + U, S.vest, sphere(0, 0.2));
    c.part();
    c.shape(8 + U, 9 + U, (y) => [hx - 3.6 + (9 + U - y) * 0.8, hx + 3], S.hood, (_x, _y, t, u) => sphere(t * 0.9, u - 0.7, 1));
    eyes(c, [[hx - 3, 12 + U]], p.blink);
    const back = tax > fa.x + 1;
    if (back) dagger(c, fa, tax, tay, p.gleam);
    arm(c, hx + 0.2, 16.8 + U, fa, REACH_SIDE, [0.4, 1]);
    if (!back) dagger(c, fa, tax, tay, p.gleam);
    return;
  }

  // Head: the hood in profile, the face peeking out, the scarf over the nose.
  c.part();
  c.ellipse(hx + 0.4, 11.4 + U, 3.4, 3.6, S.hood, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.2, dy * 0.8 - 0.1, 1) });
  c.part();
  c.ellipse(hx - 1.4, 12.8 + U, 2.2, 2.2, SKIN);
  c.part();
  c.px(hx - 4, 12.6 + U, SKIN, sphere(-0.7, -0.1), { bias: 1 });
  c.part();
  c.shape(13 + U, 15 + U, (y) => [hx - 4.1 + (y === 13 + U ? 0 : 0.3), hx + 0.6], S.scarf, (_x, y, t) => sphere(t * 0.9, (y - 13 - U) * 0.35 - 0.2, 1));
  if (S.mask) {
    c.part();
    c.shape(11 + U, 12 + U, (y) => [hx - 4.2, hx + (y === 11 + U ? 0.8 : 0.2)], MASK, (_x, y, t) => sphere(t * 0.9 - 0.2, y === 11 + U ? 0.4 : -0.1, 1));
  }
  c.part();
  // The hood's peak over the brow.
  c.shape(8 + U, 9 + U, (y) => [hx - 3.6 + (9 + U - y) * 0.8, hx + 3], S.hood, (_x, _y, t, u) => sphere(t * 0.9, u - 0.7, 1));
  c.shade(hx - 3, 10 + U, -1);
  c.shade(hx - 2, 10 + U, -1);
  eyes(c, [[hx - 3, 12 + U]], p.blink);

  // Near shoulder, the near arm and its dagger (behind the fist when it points back past him).
  const back = tax > fa.x + 1;
  if (back) dagger(c, fa, tax, tay, p.gleam);
  arm(c, hx + 0.2, 16.8 + U, fa, REACH_SIDE, [0.4, 1]);
  if (!back) dagger(c, fa, tax, tay, p.gleam);
}

// ---------------------------------------------------------------------------
// Animations

/** At rest: fists low by the hips, the blades turned down and out, ready. */
const REST_A = H(1.4, 3.6, -3.4);
const REST_B = H(1.4, 3.6, -3.4);
const REST_D = H(0.5, 0.45, -0.75);
/** From the side the far hand rides a little ahead, so its blade shows. */
const REST_B_SIDE = H(2.2, 0, -2.4);

const base = (view: View): Pose => ({
  lift: 0,
  breath: 0,
  footA: view === 'side' ? 1 : 0,
  footB: view === 'side' ? -1 : 0,
  lean: 0,
  a: { ...REST_A },
  b: view === 'side' ? { ...REST_B_SIDE } : { ...REST_B },
  da: { ...REST_D },
  db: { ...REST_D },
  stream: 0,
  sway: 0,
  gleam: 0,
});

/** Standing light on his feet, weight shifting, blades turning idly. */
function idle(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = (f / N) * Math.PI * 2;
    const p = base(view);
    p.breath = Math.sin(ph) > 0.5 ? 1 : 0;
    p.a.h += Math.sin(ph) * 0.4;
    p.b.h += Math.sin(ph + 1) * 0.4;
    p.sway = Math.sin(ph - 1) * 0.8;
    p.blink = f === 4;
    if (f === 2) p.gleam = 0.6;
    frames.push(p);
  }
  return frames;
}

/** A quick, low prowl. */
function walk(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = ((f + 0.5) / N) * Math.PI * 2;
    const s = Math.sin(ph);
    const p = base(view);
    p.lift = Math.abs(s) < 0.6 ? 1 : 0;
    p.breath = 1;
    p.stream = 0.5;
    if (view === 'side') {
      p.footA = Math.round(s * 2.4);
      p.footB = -p.footA;
      p.lean = 1;
      p.stream = 0.7 + Math.abs(s) * 0.2;
      p.a = H(1.2 - s * 1.8, 4.2, -2.6 + p.lift * 0.4);
      p.b = H(2.2 + s * 1.2, 0, -2.2 + p.lift * 0.4);
    } else {
      p.footA = s > 0.3 ? 1 : 0;
      p.footB = s < -0.3 ? 1 : 0;
      p.sway = s * 1.2;
      p.a = H(0.6 + s * 1.4, 4.2, -3 + p.lift * 0.4);
      p.b = H(0.6 - s * 1.4, 4.2, -3 + p.lift * 0.4);
    }
    frames.push(p);
  }
  return frames;
}

interface Key {
  a: Hand;
  b: Hand;
  da: Hand;
  db: Hand;
  /** Side-view hands, where the front pose doesn't carry over. */
  aSide?: Hand;
  bSide?: Hand;
  lean?: number;
  breath?: number;
  lift?: number;
  step?: number;
  stream?: number;
  gleam?: number;
}

/** An action as keyframes; anything left out stays at rest. */
function action(keys: Key[]) {
  return (view: View): Pose[] =>
    keys.map((k) => {
      const p = base(view);
      p.a = { ...(view === 'side' && k.aSide ? k.aSide : k.a) };
      p.b = { ...(view === 'side' && k.bSide ? k.bSide : k.b) };
      p.da = { ...k.da };
      p.db = { ...k.db };
      p.breath = k.breath ?? 0;
      p.lift = k.lift ?? 0;
      p.gleam = k.gleam ?? 0;
      p.stream = k.stream ?? 0.3;
      const step = k.step ?? 0;
      if (view === 'side') {
        p.lean = k.lean ?? 0;
        p.footA = 1 + step;
        p.footB = -1 - Math.round(step * 0.6);
      } else {
        p.footA = step > 0 ? 1 : 0;
        p.sway = (k.lean ?? 0) * -0.5;
      }
      return p;
    });
}

/** Point-first, straight ahead. */
const FWD = H(1, 0, 0.1);
/** Point up and out, drawn back over the shoulder for a cut. */
const RAISED = H(-0.3, 0.3, 1);

/** The first stab: the near hand drawn back, then driven straight in, the blade turned point-first. */
const stab1 = action([
  { a: H(-0.6, 3.4, 0.6), b: REST_B, da: H(0.6, 0, 0.6), db: REST_D, bSide: REST_B_SIDE, breath: 1, lean: -1 },
  { a: H(6.2, 1.2, 1.2), b: H(0.2, 4.2, -2.4), da: FWD, db: REST_D, bSide: H(1.4, 0, -2), step: 2, lean: 2, gleam: 1, stream: 0.8 },
  { a: H(5.6, 1.4, 1), b: H(0.2, 4.2, -2.4), da: FWD, db: REST_D, bSide: H(1.4, 0, -2), step: 2, lean: 2, gleam: 0.4, stream: 0.6 },
  { a: H(2.2, 3.4, -1.6), b: REST_B, da: H(0.2, 0.3, -0.8), db: REST_D, bSide: REST_B_SIDE, step: 1, lean: 1 },
]);

/** The second stab from the other hand, a half step deeper. */
const stab2 = action([
  { a: H(1.6, 4, -1.6), b: H(-0.6, 3.4, 0.6), da: REST_D, db: H(0.6, 0, 0.6), aSide: H(1.8, 0, -1.4), bSide: H(-0.4, 0, 0.8), breath: 1, lean: -1 },
  { a: H(0.6, 4.2, -2.4), b: H(6.4, 1.2, 1.4), da: REST_D, db: FWD, aSide: H(0.4, 0, -2), bSide: H(6.4, 0, 1.6), step: 2, lean: 2, gleam: 1, stream: 0.8 },
  { a: H(0.6, 4.2, -2.4), b: H(5.8, 1.4, 1.1), da: REST_D, db: FWD, aSide: H(0.4, 0, -2), bSide: H(5.8, 0, 1.4), step: 2, lean: 2, gleam: 0.4, stream: 0.6 },
  { a: REST_A, b: H(2.2, 3.4, -1.6), da: REST_D, db: H(0.2, 0.3, -0.8), bSide: H(2.4, 0, -1.8), step: 1, lean: 1 },
]);

/**
 * The finisher: both blades raised high at the shoulders, torn down across
 * each other in an X, flung wide, and brought home.
 */
const cross = action([
  { a: H(0.6, 3.2, 4.2), b: H(0.6, 3.2, 4.2), da: RAISED, db: RAISED, aSide: H(0.6, 0, 5.6), bSide: H(1.6, 0, 5), lift: 1, lean: -1, stream: 0.2 },
  { a: H(1.4, 3.6, 5), b: H(1.4, 3.6, 5), da: H(0.2, 0.5, 1), db: H(0.2, 0.5, 1), aSide: H(1, 0, 6.2), bSide: H(2, 0, 5.6), lift: 1, lean: -1, gleam: 0.6, stream: 0.2 },
  { a: H(5.2, -1.2, 0.4), b: H(5.2, -1.2, 0.4), da: H(0.6, -0.8, -0.6), db: H(0.6, -0.8, -0.6), aSide: H(6, 0, 0.2), bSide: H(5, 0, -1.2), step: 2, lean: 2, breath: 2, gleam: 1, stream: 0.9 },
  { a: H(3.6, 4.8, -2), b: H(3.6, 4.8, -2), da: H(0.4, 1, -0.3), db: H(0.4, 1, -0.3), aSide: H(4.4, 0, -2), bSide: H(2.6, 0, -3), step: 2, lean: 2, breath: 2, gleam: 0.5, stream: 0.7 },
  { a: H(1.6, 3.8, -3), b: H(1.6, 3.8, -3), da: REST_D, db: REST_D, aSide: H(1.6, 0, -2.6), bSide: REST_B_SIDE, step: 1, lean: 1, breath: 1 },
]);

/** The shadowstep: a crouch, then a low dart, blades swept back, the scarf flying. */
const dash = action([
  { a: H(1.4, 3, -1.6), b: H(1.4, 3, -1.6), da: FWD, db: FWD, aSide: H(2, 0, -1), bSide: H(2.8, 0, -1.4), breath: 2, lift: -1, lean: 1, stream: 0.6 },
  { a: H(-1.4, 3.4, -2.2), b: H(-1.4, 3.4, -2.2), da: H(-0.6, 0.6, -0.6), db: H(-0.6, 0.6, -0.6), aSide: H(-3, 0, -1), bSide: H(-2, 0, -1.6), breath: 2, lean: 3, step: 2, stream: 1, gleam: 0.5 },
  { a: H(-1.8, 3.6, -2), b: H(-1.8, 3.6, -2), da: H(-0.6, 0.6, -0.5), db: H(-0.6, 0.6, -0.5), aSide: H(-3.4, 0, -0.6), bSide: H(-2.4, 0, -1.2), breath: 2, lean: 3, step: 3, stream: 1, gleam: 0.8 },
]);

// ---------------------------------------------------------------------------
// The idle moment (`rest`), filed facing the viewer only

/** A pose from the stand (idle frame 0) with the given changes. */
const from = (k: Partial<Pose>): Pose => ({ ...idle('down')[0], ...k });

/** Blade point straight up, the knife caught by its hilt. */
const UP = H(0, 0.1, 1);
/** Where the flip leaves the hand and where it comes down to be caught (the dagger's middle), in body pixels. */
const FLIP_FROM: [number, number] = [9, 14.4];
const FLIP_TO: [number, number] = [9, 15.2];
/** The dagger in flight, `t` of the way from the hand and back. */
const flight = (t: number, hand: Hand): Pose =>
  from({
    a: hand,
    breath: 0,
    toss: {
      x: FLIP_FROM[0] + (FLIP_TO[0] - FLIP_FROM[0]) * t - Math.sin(t * Math.PI) * 0.6,
      y: FLIP_FROM[1] + (FLIP_TO[1] - FLIP_FROM[1]) * t - 4 * TOSS_PEAK * t * (1 - t),
      ang: -Math.PI / 2 + t * TOSS_TURNS * Math.PI * 2,
    },
  });

/**
 * The cutthroat (and the corsair): he weighs the knife in his hand, bouncing
 * it twice, flicks it up to spin end over end above his head, snatches it
 * out of the air by the hilt, point up with a glint, and lets it settle back
 * into his reverse grip.
 */
const FLIP_HAND = H(2.2, 3.0, 1.5);
const CUT_REST: Pose[] = [
  from({}),
  from({ a: H(1.6, 3.4, -2.4), da: H(0.5, 0.4, -0.6), breath: 1 }),
  from({ a: H(1.8, 3.4, -4.2), da: H(0.6, 0.4, -0.4), breath: 1, sway: -0.3 }),
  from({ a: FLIP_HAND, da: UP, lift: 1, gleam: 0.2, toss: { x: FLIP_FROM[0], y: FLIP_FROM[1] - 1.5, ang: -Math.PI / 2 + 0.5 } }),
  flight(1 / 7, FLIP_HAND),
  flight(2 / 7, H(2.2, 3.0, 1.9)),
  flight(3 / 7, H(2.2, 3.0, 2.1)),
  flight(4 / 7, H(2.2, 3.0, 2.1)),
  flight(5 / 7, H(2.2, 3.0, 2.0)),
  flight(6 / 7, H(2.2, 3.1, 1.8)),
  from({ a: H(2.2, 3.0, 1.2), da: UP, breath: 1, gleam: 1 }),
  from({ a: H(2.2, 3.1, 2.0), da: UP, gleam: 0.5, sway: 0.4 }),
  from({ a: H(2.0, 3.3, -0.6), da: H(0.4, 0.3, 0.3), sway: 0.2 }),
  from({ a: H(1.6, 3.5, -2.6), da: H(0.5, 0.45, -0.6), breath: 1 }),
  from({ a: H(2.2, 3.1, 2.0), da: UP, gleam: 0.2, blink: true }),
  from({ a: H(1.6, 3.4, -2.0), da: H(0.4, 0.4, -0.8) }),
];

/** Arms flung wide for the turn, blades pointing out. */
const WIDE = H(0.6, 5.4, 1.4);
const OUT = H(0.1, 1, 0.1);
/** From the side the near arm leads and the far one trails. */
const LEAD = H(3.4, 0, 1.4);
const TRAIL = H(-2.6, 0, 1.8);

/**
 * The shadow dancer (and the kitsune): a little plié, up onto his toes with
 * his arms opening, two turns on the spot (drawn from the front, the side,
 * the back and the other side) with his scarf, or tails, flying and the
 * blades' light whirling round him, a landing that lets them swing on past
 * him, and a deep courtly bow, one hand at his chest, eyes closed.
 */
const DANCE_REST: Pose[] = [
  from({}),
  from({ lift: -1, a: H(2.2, 1.8, -0.8), b: H(2.2, 1.8, -0.8), da: H(0.4, -0.4, -0.8), db: H(0.4, -0.4, -0.8), sway: -0.2 }),
  from({ lift: 1, a: WIDE, b: WIDE, da: OUT, db: OUT, stream: 0.4, sway: 0.4 }),
  from({ turn: 'left', lift: 1, footA: 1, footB: -1, a: LEAD, b: TRAIL, da: H(1, 0, 0.1), db: H(-1, 0, 0.2), stream: 1, swirl: 0.25 }),
  from({ turn: 'up', lift: 1, a: WIDE, b: WIDE, da: OUT, db: OUT, stream: 0.7, sway: 2.4, swirl: 0.5 }),
  from({ turn: 'right', lift: 1, footA: 1, footB: -1, a: LEAD, b: TRAIL, da: H(1, 0, 0.1), db: H(-1, 0, 0.2), stream: 1, swirl: 0.75 }),
  from({ lift: 1, a: WIDE, b: WIDE, da: OUT, db: OUT, stream: 0.6, sway: -2.4, swirl: 1 }),
  from({ breath: 1, a: H(1, 4.8, -0.6), b: H(1, 4.8, -0.6), da: H(0.3, 0.8, -0.4), db: H(0.3, 0.8, -0.4), stream: 0.4, sway: -1.6 }),
  from({ lift: -1, breath: 1, headY: 1, a: H(2.6, -0.8, 0.4), b: H(-0.2, 5.8, -2.6), da: H(0.3, 0.6, -0.8), db: H(0.1, 0.7, -0.7), sway: -0.4, blink: true }),
  from({ lift: -1, breath: 1, headY: 1, a: H(2.6, -0.8, 0.4), b: H(-0.3, 6.0, -2.9), da: H(0.3, 0.6, -0.8), db: H(0.1, 0.7, -0.7), sway: 0.2, blink: true, gleam: 0.9 }),
  from({ breath: 1, a: H(1.8, 2.4, -2.0), b: H(1.2, 4.4, -2.6), da: H(0.4, 0.4, -0.8), db: H(0.5, 0.45, -0.75), sway: 0.3 }),
];

/** Which of each type's poses plays at each step: the same length, so one order serves both. */
const CUT_STEPS = [0, 1, 2, 1, 2, 15, 3, 4, 5, 6, 7, 8, 9, 10, 11, 11, 11, 14, 11, 11, 12, 13, 13, 0];
const DANCE_STEPS = [0, 1, 1, 2, 3, 4, 5, 6, 3, 4, 5, 6, 7, 7, 8, 8, 8, 8, 9, 9, 9, 8, 10, 0];

/**
 * rig() takes one frame order per rig, but the two types move differently.
 * So each step's frame stands for the pair of poses the types show there:
 * steps where both repeat themselves share a frame, and each type draws its
 * own pose for every frame.
 */
function mergeSteps(lines: readonly (readonly number[])[]): { order: number[]; picks: number[][] } {
  const seen = new Map<string, number>();
  const order: number[] = [];
  const picks: number[][] = lines.map(() => []);
  for (let t = 0; t < lines[0].length; t++) {
    const k = lines.map((l) => l[t]).join(',');
    let i = seen.get(k);
    if (i === undefined) {
      i = seen.size;
      seen.set(k, i);
      lines.forEach((l, j) => picks[j].push(l[t]));
    }
    order.push(i);
  }
  return { order, picks };
}

const REST_MERGE = mergeSteps([CUT_STEPS, DANCE_STEPS]);

function rest(view: View): Pose[] {
  if (view !== 'down') return [];
  return S.dance ? REST_MERGE.picks[1].map((i) => DANCE_REST[i]) : REST_MERGE.picks[0].map((i) => CUT_REST[i]);
}

// ---------------------------------------------------------------------------
// Frame generation

export type RogueAnim = 'idle' | 'walk' | 'stab1' | 'stab2' | 'cross' | 'dash' | 'rest';

export interface RogueAnimDef {
  name: RogueAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => Pose[];
  /** Frame indices to play in sequence, when some are held or repeated. */
  order?: readonly number[];
}

export const ROGUE_ANIMS: RogueAnimDef[] = [
  { name: 'idle', fps: 7, loop: true, poses: idle },
  { name: 'walk', fps: 12, loop: true, poses: walk },
  { name: 'stab1', fps: 20, loop: false, poses: stab1 },
  { name: 'stab2', fps: 20, loop: false, poses: stab2 },
  { name: 'cross', fps: 15, loop: false, poses: cross },
  { name: 'dash', fps: 14, loop: true, poses: dash },
  { name: 'rest', fps: REST_FPS, loop: false, poses: rest, order: REST_MERGE.order },
];

/** Frame index at which each strike lands. */
export const STRIKE_FRAME = { stab1: 1, stab2: 1, cross: 2 } as const;

export interface RogueFrame {
  key: string; // e.g. "walk_left_3"
  anim: RogueAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawRogueFrame(dir: Dir, pose: Pose): PixelCanvas {
  const c = new PixelCanvas(ROGUE_W, ROGUE_H).offset(BODY_X, BODY_Y);
  // The pirouette's frames are filed under `down` but drawn from wherever the turn has got to.
  const d = pose.turn ?? dir;
  if (d === 'down') drawDown(c, pose);
  else if (d === 'up') drawUp(c, pose);
  else drawSide(c, pose);
  if (pose.swirl !== undefined) swirl(c, pose);
  return d === 'right' ? c.mirrored() : c;
}

/**
 * The blades' light whirling round the dancer as he turns: a comet of sparks
 * on a flat ring about his chest, its head at `swirl` of the way round, the
 * near half in front of him and the far half dimmed behind.
 */
function swirl(c: PixelCanvas, p: Pose): void {
  const lit = S.lit ?? [255, 255, 255];
  const y0 = CH - p.lift + p.breath;
  for (let i = 0; i < SWIRL_TRAIL; i++) {
    const t = (p.swirl! - i * 0.07) * Math.PI * 2;
    const near = Math.sin(t) > 0;
    const k = (1 - i / SWIRL_TRAIL) * (near ? 1 : 0.45);
    c.spark(12 + Math.cos(t) * SWIRL_RX, y0 + Math.sin(t) * SWIRL_RY, lit, k);
  }
}


export function buildRogueFrames(look: RogueLook = ROGUE_LOOK): RogueFrame[] {
  S = look;
  const out: RogueFrame[] = [];
  for (const a of ROGUE_ANIMS) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, index) => {
        out.push({ key: `${a.name}_${dir}_${index}`, anim: a.name, dir, canvas: drawRogueFrame(dir, pose) });
      });
    }
  }
  S = ROGUE_LOOK;
  return out;
}

// ---------------------------------------------------------------------------
// Icons and smoke

/** The colours of a rogue's icons: the blades, their hilts, and the smoke or shadow of the special. */
export interface DaggerColors {
  blade: [string, string, string];
  hilt: [string, string];
  guard: string;
  /** Smoke (or shadow) from light to dark, and the glint or glow. */
  smoke: [string, string, string];
  glint: string;
  ink: string;
  /** Moonflower petals drifting round the icon (Nightbloom's), light and shade. */
  petal?: [string, string];
}

export const ROGUE_DAGGERS: DaggerColors = {
  blade: ['#f4f8ff', '#cbd7ec', '#6f7fa0'],
  hilt: ['#583a36', '#2c1c1c'],
  guard: '#8f9db8',
  smoke: ['#9a98ac', '#5e5c72', '#34323f'],
  glint: '#ff6a5a',
  ink: '#0b0910',
};

export const DANCER_DAGGERS: DaggerColors = {
  blade: ['#f8f2ff', '#c4a4ff', '#6a3ad0'],
  hilt: ['#3c3258', '#1a1428'],
  guard: '#f4cf6a',
  smoke: ['#a47cff', '#5a34a8', '#2a1658'],
  glint: '#e8d8ff',
  ink: '#07040f',
};

export const CORSAIR_DAGGERS: DaggerColors = {
  blade: ['#f4f8ff', '#cbd7ec', '#6f7fa0'],
  hilt: ['#2c1c1c', '#140c0c'],
  guard: '#f4cf6a',
  smoke: ['#b0a48e', '#6e6452', '#3a3428'],
  glint: '#ffe08a',
  ink: '#0b0910',
};

export const KITSUNE_DAGGERS: DaggerColors = {
  blade: ['#f4fbff', '#9ad0ff', '#3a6ad8'],
  hilt: ['#5e1e26', '#2e0c10'],
  guard: '#f4cf6a',
  smoke: ['#8ac8ff', '#3a6ad8', '#1a2a70'],
  glint: '#e0f4ff',
  ink: '#050a1c',
};

export const NIGHTBLOOM_DAGGERS: DaggerColors = {
  blade: ['#ffffff', '#d4ccfa', '#6a5ec8'],
  hilt: ['#342c74', '#18143a'],
  guard: '#eef2fa',
  smoke: ['#7a70d0', '#3a3090', '#1a1448'],
  glint: '#fff0be',
  ink: '#060414',
  petal: ['#ffffff', '#b4bce0'],
};

/** Each look's icons: its dagger colours, and whether its special is the dance (a blink) or the shadowstep. */
export const ROGUE_ICONS: Record<string, { daggers: DaggerColors; dance: boolean }> = {
  rogue: { daggers: ROGUE_DAGGERS, dance: false },
  rogue_dancer: { daggers: DANCER_DAGGERS, dance: true },
  rogue_corsair: { daggers: CORSAIR_DAGGERS, dance: false },
  rogue_kitsune: { daggers: KITSUNE_DAGGERS, dance: true },
  rogue_nightbloom: { daggers: NIGHTBLOOM_DAGGERS, dance: true },
};

function painter(): { px: Uint8ClampedArray; put: (x: number, y: number, c: string) => void; outline: (c: string) => void } {
  const N = 16;
  const px = new Uint8ClampedArray(N * N * 4);
  const put = (x: number, y: number, c: string) => {
    if (x < 0 || y < 0 || x >= N || y >= N) return;
    const n = parseInt(c.slice(1), 16);
    const i = (y * N + x) * 4;
    px[i] = n >> 16;
    px[i + 1] = (n >> 8) & 255;
    px[i + 2] = n & 255;
    px[i + 3] = 255;
  };
  const outline = (c: string) => {
    const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < N && y < N && px[(y * N + x) * 4 + 3] === 255;
    const out: [number, number][] = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!filled(x, y) && (filled(x + 1, y) || filled(x - 1, y) || filled(x, y + 1) || filled(x, y - 1))) out.push([x, y]);
    for (const [x, y] of out) put(x, y, c);
  };
  return { px, put, outline };
}

/** One dagger for an icon, hilt at (x, y), pointing along (ux, uy) (a diagonal). */
function iconDagger(put: (x: number, y: number, c: string) => void, k: DaggerColors, x: number, y: number, ux: number, uy: number, len: number): void {
  // Hilt and pommel.
  put(x - ux, y - uy, k.hilt[1]);
  put(x, y, k.hilt[0]);
  put(x + ux, y + uy, k.hilt[1]);
  // The guard, square across the blade.
  put(x + ux * 2 - uy, y + uy * 2 + ux, k.guard);
  put(x + ux * 2, y + uy * 2, k.guard);
  put(x + ux * 2 + uy, y + uy * 2 - ux, k.guard);
  // The blade: a lit edge beside a darker spine, narrowing to the point.
  for (let i = 3; i < 3 + len; i++) {
    const bx = x + ux * i;
    const by = y + uy * i;
    put(bx, by, k.blade[i === 2 + len ? 0 : 1]);
    if (i < 1 + len) put(bx + (uy === ux ? -1 : 0), by + (uy === ux ? 0 : 1), k.blade[2]);
  }
}

/** 16x16 icon for the attack: two daggers crossed point-up, a glint at the crossing. */
export function daggersIcon(k: DaggerColors = ROGUE_DAGGERS): Uint8ClampedArray {
  const { px, put, outline } = painter();
  iconDagger(put, k, 3, 13, 1, -1, 8);
  iconDagger(put, k, 12, 13, -1, -1, 8);
  outline(k.ink);
  if (k.petal) {
    // A moonflower blooming where the blades cross, and a petal falling.
    for (const [x, y] of [[7, 5], [6, 6], [8, 6], [7, 7]] as const) put(x, y, k.petal[0]);
    put(7, 6, k.glint);
    petals(put, k.petal, [[2, 3], [13, 4]]);
    return px;
  }
  put(7, 7, k.glint);
  put(8, 7, k.glint);
  put(7, 6, '#ffffff');
  return px;
}

/** Little two-pixel petals, light over shade, at each spot. */
function petals(put: (x: number, y: number, c: string) => void, k: [string, string], at: [number, number][]): void {
  for (const [x, y] of at) {
    put(x, y, k[0]);
    put(x + 1, y + 1, k[1]);
  }
}

/** 16x16 icon for the special: a puff of smoke, a dagger darting out of it and a streak behind. */
export function shadowstepIcon(k: DaggerColors = ROGUE_DAGGERS, dance = false): Uint8ClampedArray {
  const { px, put, outline } = painter();
  // The cloud: three lumps, lit from the upper left.
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const lumps = [[5, 10, 3.6], [8.5, 8.5, 3.2], [3.5, 7, 2.4]] as const;
      let inside = false;
      let lit = 0;
      for (const [cx, cy, r] of lumps) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d <= r) {
          inside = true;
          lit = Math.max(lit, (cx - (x + 0.5) + cy - (y + 0.5)) / r);
        }
      }
      if (inside) put(x, y, lit > 0.45 ? k.smoke[0] : lit > -0.4 ? k.smoke[1] : k.smoke[2]);
    }
  }
  outline(k.ink);
  // The dagger leaping out to the upper right.
  iconDagger(put, k, 8, 7, 1, -1, 5);
  // Speed lines.
  for (const [x, y] of [[12, 9], [13, 8], [11, 11], [12, 10]] as const) put(x, y, k.smoke[1]);
  if (dance) {
    // The dancer's echo: a second, ghostly blade.
    for (let i = 0; i < 4; i++) put(2 + i, 4 - Math.floor(i / 2), k.blade[2]);
  }
  if (k.petal) petals(put, k.petal, [[1, 1], [12, 12], [5, 14]]);
  put(14, 1, k.glint);
  return px;
}

/** A soft puff of smoke for the shadowstep, `size` px square: grey, lighter on top, dithered at the edge. */
export function smokeCanvas(size: number, tone: [number, number, number][]): Uint8ClampedArray {
  const px = new Uint8ClampedArray(size * size * 4);
  const m = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - m) / m;
      const dy = (y + 0.5 - m) / m;
      // Three overlapping lumps make it cloudy rather than round.
      const d = Math.min(Math.hypot(dx + 0.25, dy + 0.1) / 0.72, Math.hypot(dx - 0.28, dy + 0.05) / 0.7, Math.hypot(dx, dy - 0.3) / 0.62, Math.hypot(dx * 0.9, dy + 0.35) / 0.55);
      if (d > 1) continue;
      // Ragged at the edge: every other pixel of the outer ring.
      if (d > 0.82 && (x + y) % 2 === 0) continue;
      const lit = -dy * 0.6 - dx * 0.3;
      const c = lit > 0.25 ? tone[0] : lit > -0.2 ? tone[1] : tone[2];
      const i = (y * size + x) * 4;
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
      px[i + 3] = 255;
    }
  }
  return px;
}

/**
 * One of Nightbloom's moonflower petals, `size` px square, for her shadow's
 * effects: a pale teardrop lit at its tip and lilac at its base.
 */
export function petalCanvas(size = 5): Uint8ClampedArray {
  const px = new Uint8ClampedArray(size * size * 4);
  const rows = ['.##..', '####.', '.###.', '..##.', '...#.'];
  const tones = [hex('#ffffff'), hex('#e4e8fa'), hex('#b4bce0'), hex('#8a84c8')];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (rows[y]?.[x] !== '#') continue;
      const [r, g, b] = tones[Math.min(3, Math.floor((x + y) / 2))];
      px.set([r, g, b, 255], (y * size + x) * 4);
    }
  }
  return px;
}
