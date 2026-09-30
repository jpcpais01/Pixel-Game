// The alchemist, drawn procedurally from a small rig like the fighter.
//
// A plague doctor turned poisoner: a black wide-brimmed hat over a bone-white
// beaked mask with goggle lenses glowing green, a short mantle over a long
// plum greatcoat, a bandolier of glowing vials across the chest, gloves and
// boots of black leather. A flask of poison is always in the throwing hand.
//
// The body keeps to the 24x32 box; frames are larger so the throwing arm can
// wind up over the hat. Drawing functions work in body-box coordinates. Hands
// are posed in the alchemist's own terms (forward, out to the side, height)
// and placed for each view, so one set of keyframes serves every direction.
// The flasks he throws are drawn here too, as small spinning sprites.
//
// The hex witch is his other look on the same rig: a crooked pointed hat, a
// pale green face with a hooked nose and long silver hair, a tattered teal
// robe under an aubergine shawl, bony green hands and a violet brew.
//
// Chemtech is his gameplay subtype on the same rig: a steel helmet with a
// brass brow band and a glass chem tube on top, a black gas mask with round
// acid lenses, a respirator snout and twin filters, rusted copper pauldrons,
// a charcoal rubber coat under a leather apron, a pressure tank on the back
// and chartreuse chem in metal canisters instead of glass flasks.
//
// The bone shaman is the plague doctor's other skin: a ram's skull for a mask
// with spirit-fire in its sockets, great curled horns, a crown of raven
// feathers, black braids, a hide robe under a feather mantle, a necklace of
// teeth, and gourds of glowing teal juju instead of flasks.
//
// Cryotech is Chemtech's skin: a white insulated suit, a glass bubble helmet
// over a hood and a glowing ice visor, frosted steel pauldrons and tank, a
// quilted blue front and canisters of freezing blue.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB } from './pixel';
import { BEAK, BOOT, BRASS, CHEM_BREW, CHEM_COAT, CHEM_COPPER, CHEM_CORE, CHEM_HOT, CHEM_LENS, CHEM_MID, CHEM_RUBBER, CHEM_STEEL, GLASS, GOLD, HEX_BREW, HEX_CORE, HEX_EYE, HEX_HOT, HEX_MID, LEATHER, LENS, MANTLE, PLAGUE_COAT, PLAGUE_HAT, TOXIN, TOX_CORE, TOX_HOT, TOX_MID, TROUSER, WITCH_HAIR, WITCH_ROBE, WITCH_SHAWL, WITCH_SKIN, WOOD } from './palette';
import { DIRS, type Dir } from './wizard';

export const ALCH_W = 48;
export const ALCH_H = 50;
const BODY_X = 12;
const BODY_Y = 12;
/** Sprite origin in the frame: body centre, just under the feet. */
export const ALCH_ORIGIN_X = BODY_X + 12;
export const ALCH_ORIGIN_Y = BODY_Y + 31;
/** Height above the feet a flask leaves the hand at. */
export const RELEASE_H = 22;
/** The idle moment's pace, and how far a puff of chem vapour drifts and rises per step. */
const REST_FPS = 8;
const PUFF_DRIFT = -1.6;
const PUFF_RISE = 2.3;

/** A hand, in the alchemist's terms: `f` forward, `s` out to its own side, `h` up from the chest. */
export interface Hand {
  f: number;
  s: number;
  h: number;
}

export interface Pose {
  /** Whole body raised (walk passing frames). */
  lift: number;
  /** Upper body lowered (crouching into a throw). */
  breath: number;
  /** Foot offsets. Side view: forward (+) / back (-). Front/back: lift. */
  footA: number;
  footB: number;
  /** Upper body shifted forward (side view), in pixels. */
  lean: number;
  /** Throwing hand (screen left from the front and back, the near arm from the side) and the off hand. */
  a: Hand;
  b: Hand;
  /** What the throwing hand holds: 0 nothing, 1 a flask, 2 the great flask. */
  flask: 0 | 1 | 2;
  /** 0..1 how hard the flask boils. */
  boil: number;
  /** Coat hem swinging behind (side view) or to one side, in pixels. */
  sway: number;
  /** Lenses dimmed for a moment. */
  blink?: boolean;
  /** The head nudged from the body (a sniff, a nod, a cock to one side); front view only. */
  headX?: number;
  headY?: number;
  /** 1..3: a puff of chem vapour escaping the canister's valve and spreading as it rises. */
  puff?: number;
}

/** One look for the alchemist: its texture key, its cloth and its brew. */
export interface AlchemistLook {
  key: string;
  coat: Material;
  mantle: Material;
  hat: Material;
  /** The mask, or the witch's face. */
  face: Material;
  /** Goggle lenses, or eyes. */
  eye: Material;
  gloves: Material;
  /** The hat band. */
  band: Material;
  brew: Material;
  core: RGB;
  hot: RGB;
  mid: RGB;
  /** The hex witch: pointed hat, face and nose, long hair, tattered hem. */
  witch: boolean;
  hair?: Material;
  /** Chemtech: helmet, gas mask, pressure tank, apron and canisters. */
  chem?: boolean;
  /** The bone shaman: a horned skull, a feather crown, braids, teeth and gourds (drawn on the plague rig). */
  shaman?: boolean;
  /** Cryotech: a glass bubble helmet over a hood and visor, and an insulated front (drawn on the chem rig). */
  cryo?: boolean;
  /** Chemtech's apron, when not leather. */
  apron?: Material;
  /** Animation speeds that differ from the usual ones. */
  fps?: Partial<Record<AlchemistAnim, number>>;
}

export const PLAGUE_LOOK: AlchemistLook = {
  key: 'alchemist',
  coat: PLAGUE_COAT,
  mantle: MANTLE,
  hat: PLAGUE_HAT,
  face: BEAK,
  eye: LENS,
  gloves: BOOT,
  band: PLAGUE_COAT,
  brew: TOXIN,
  core: TOX_CORE,
  hot: TOX_HOT,
  mid: TOX_MID,
  witch: false,
};

export const WITCH_LOOK: AlchemistLook = {
  key: 'alchemist_witch',
  coat: WITCH_ROBE,
  mantle: WITCH_SHAWL,
  hat: PLAGUE_HAT,
  face: WITCH_SKIN,
  eye: HEX_EYE,
  gloves: WITCH_SKIN,
  band: WITCH_SHAWL,
  brew: HEX_BREW,
  core: HEX_CORE,
  hot: HEX_HOT,
  mid: HEX_MID,
  witch: true,
  hair: WITCH_HAIR,
};

export const CHEM_LOOK: AlchemistLook = {
  key: 'alchemist_chem',
  coat: CHEM_COAT,
  mantle: CHEM_COPPER,
  hat: CHEM_STEEL,
  face: CHEM_RUBBER,
  eye: CHEM_LENS,
  gloves: BOOT,
  band: BRASS,
  brew: CHEM_BREW,
  core: CHEM_CORE,
  hot: CHEM_HOT,
  mid: CHEM_MID,
  witch: false,
  chem: true,
  // A quicker, flatter lob: canisters fly more often.
  fps: { throw: 23 },
};

const ramp = (...c: string[]): RGB[] => c.map(hex);

// The bone shaman's materials.
const BONE: Material = { ramp: ramp('#56483a', '#928066', '#ccba96', '#eee4ca', '#fffaee'), outline: hex('#1c140c'), outlineLit: hex('#34281c') };
const HORN: Material = { ramp: ramp('#20180f', '#403024', '#665040', '#927c64', '#bcaa8e'), outline: hex('#0c0806') };
const HIDE: Material = { ramp: ramp('#221308', '#3e2413', '#623c20', '#885832', '#ae7c4e'), outline: hex('#0e0804'), outlineLit: hex('#1e1008') };
const RAVEN: Material = { ramp: ramp('#08080e', '#141828', '#222a44', '#364668', '#5a7494'), outline: hex('#030308'), outlineLit: hex('#10121e'), shine: true };
const RED_FEATHER: Material = { ramp: ramp('#420808', '#80140e', '#c02a1a', '#ee5a36'), outline: hex('#180404') };
const SHAMAN_SKIN: Material = { ramp: ramp('#2a140c', '#4a2616', '#6e3e24', '#945e3a', '#b8845a'), outline: hex('#120804') };
const BRAID: Material = { ramp: ramp('#08070a', '#141218', '#221e28', '#363040'), outline: hex('#030204') };
const SPIRIT_EYE: Material = { ramp: ramp('#0c4a3e', '#1a9a7e', '#5af0c8', '#d8fff0'), outline: hex('#04140f'), emissive: 0.9, noAO: true };
const SPIRIT_BREW: Material = { ramp: ramp('#0a5a4a', '#1ab090', '#5af0c8', '#e0fff4'), outline: hex('#04180f'), emissive: 0.8, noAO: true };
const GOURD: Material = { ramp: ramp('#4a2a0e', '#7e4c1a', '#b07a2e', '#d8a852', '#f0d08a'), outline: hex('#1c0e04'), shine: true };

// Cryotech's.
const ICE_SUIT: Material = { ramp: ramp('#46566e', '#7688a6', '#b0c0d8', '#e0ecf6', '#ffffff'), outline: hex('#141c2c'), outlineLit: hex('#26324a') };
const ICE_PANEL: Material = { ramp: ramp('#10264a', '#1c4078', '#2c5ea8', '#4884d0', '#80b4f0'), outline: hex('#08142a') };
const FROST_STEEL: Material = { ramp: ramp('#2a3850', '#4a6282', '#7894b6', '#aec6de', '#e8f4ff'), outline: hex('#0e1422'), shine: true };
const SILVER_BAND: Material = { ramp: ramp('#384050', '#687284', '#a2acbc', '#dae2ec', '#ffffff'), outline: hex('#141820'), shine: true };
const HOOD: Material = { ramp: ramp('#363c46', '#5e6674', '#949caa', '#c8ced8'), outline: hex('#12161c') };
const CRYO_LENS: Material = { ramp: ramp('#1c4a8a', '#3a8ae0', '#8ad0ff', '#e0f6ff'), outline: hex('#0a1a30'), emissive: 0.9, noAO: true };
const CRYO_BREW: Material = { ramp: ramp('#1c4aa0', '#3a88e8', '#8ad4ff', '#e6faff'), outline: hex('#0a1a36'), emissive: 0.8, noAO: true };
const DOME: Material = { ramp: ramp('#56789a', '#86acca', '#c0dcf0', '#f2fcff'), outline: hex('#1a2a3a'), emissive: 0.12, shine: true, noAO: true };

export const SHAMAN_LOOK: AlchemistLook = {
  key: 'alchemist_shaman',
  coat: HIDE,
  mantle: RAVEN,
  hat: RAVEN,
  face: BONE,
  eye: SPIRIT_EYE,
  gloves: SHAMAN_SKIN,
  band: HORN,
  brew: SPIRIT_BREW,
  core: hex('#e0fff4'),
  hot: hex('#8affd8'),
  mid: hex('#2ad8a8'),
  witch: false,
  hair: BRAID,
  shaman: true,
};

export const CRYO_LOOK: AlchemistLook = {
  ...CHEM_LOOK,
  key: 'alchemist_cryo',
  coat: ICE_SUIT,
  mantle: FROST_STEEL,
  hat: FROST_STEEL,
  face: HOOD,
  eye: CRYO_LENS,
  band: SILVER_BAND,
  brew: CRYO_BREW,
  core: hex('#e6faff'),
  hot: hex('#9ad8ff'),
  mid: hex('#4aa8f0'),
  cryo: true,
  apron: ICE_PANEL,
};

export const ALCHEMIST_LOOKS = [PLAGUE_LOOK, WITCH_LOOK, CHEM_LOOK, SHAMAN_LOOK, CRYO_LOOK];

/** The look being drawn; set by buildAlchemistFrames. */
let S: AlchemistLook = PLAGUE_LOOK;

const H = (f: number, s: number, h: number): Hand => ({ f, s, h });

type View = 'down' | 'up' | 'side';

/** The chest row in body coordinates, the height hands are posed from. */
const CH = 18;

interface Placed {
  x: number;
  y: number;
  /** Drawn behind the body. */
  behind: boolean;
}

/** Where a hand lands on screen in each view. `hx` is the upper body's centre (side view). */
function place(view: View, arm: 'a' | 'b', q: Hand, U: number, hx: number): Placed {
  const side = arm === 'a' ? -1 : 1;
  if (view === 'down') return { x: 12 + side * q.s, y: CH + U - q.h + q.f * 0.7, behind: q.f < -1 };
  if (view === 'up') return { x: 12 + side * q.s, y: CH + U - q.h - q.f * 0.8, behind: q.f > 1 };
  // Facing left; the far arm sits a touch higher and behind the body.
  const far = arm === 'b';
  return { x: hx - 1 - q.f * 1.05 + (far ? 0.8 : 0), y: CH + U - q.h + (far ? -0.6 : 0.3), behind: far };
}

// ---------------------------------------------------------------------------
// Parts

/** A flask of poison held at (x, y): a round glass belly of glowing green, a neck and a cork. */
function heldFlask(c: PixelCanvas, x: number, y: number, size: 1 | 2, boil: number, bias: number, seed: number): void {
  if (S.chem) {
    heldCanister(c, x, y, size, boil, bias, seed);
    return;
  }
  if (S.shaman) {
    heldGourd(c, x, y, size, boil, bias, seed);
    return;
  }
  const r = size === 2 ? 2.4 : 1.75;
  const by = y - r + 0.2;
  c.part();
  c.ellipse(x, by, r, r, GLASS, { bias });
  c.part();
  c.ellipse(x, by + 0.45, r - 0.35, r - 0.55, S.brew, { bias: bias + (boil > 0.6 ? 1 : 0) });
  c.part();
  const neckTop = by - r - (size === 2 ? 1.2 : 0.6);
  c.line(x, by - r + 0.4, x, neckTop, GLASS, () => cyl(0.2, 0.3), { bias });
  c.px(x, neckTop - 1, WOOD, sphere(-0.2, -0.6));
  if (size === 2) c.px(x - 1, neckTop - 1, WOOD, sphere(-0.6, -0.5));
  // The poison's light, and bubbles rising off it as it boils.
  const k = 0.3 + boil * 0.5;
  c.spark(x, by, S.hot, k * 0.6);
  c.spark(x - r, by, S.mid, k * 0.35);
  c.spark(x + r, by, S.mid, k * 0.35);
  c.spark(x, by + r, S.mid, k * 0.3);
  if (boil > 0) {
    for (let i = 0; i < 3; i++) {
      const up = ((seed * 3 + i * 5) % 7) + 1;
      c.spark(x + ((i + seed) % 3) - 1, neckTop - 1 - up * boil, i === 0 ? S.core : S.hot, 0.55 * boil);
    }
  }
}

/** The shaman's gourd held at (x, y): a fat belly and a small head, a glyph of juju glowing on it, a feather in its stopper. */
function heldGourd(c: PixelCanvas, x: number, y: number, size: 1 | 2, boil: number, bias: number, seed: number): void {
  const r = size === 2 ? 2.3 : 1.65;
  const by = y - r + 0.2;
  const hy = by - r * 1.05;
  c.part();
  c.ellipse(x, by, r, r * 0.95, GOURD, { bias });
  c.part();
  c.ellipse(x, hy, r * 0.55, r * 0.55, GOURD, { bias: bias + 1 });
  c.part();
  const top = Math.round(hy - r * 0.55) - 1;
  c.px(x, top, RED_FEATHER, sphere(-0.2, -0.6));
  if (size === 2) c.px(x + 1, top - 1, RED_FEATHER, sphere(0.3, -0.6));
  // The glyph painted round its belly, glowing with what's inside.
  c.part();
  c.px(x, by, S.brew, sphere(0, 0), { bias });
  if (size === 2) {
    c.px(x - 1, by + 1, S.brew, sphere(-0.3, 0.2), { bias });
    c.px(x + 1, by + 1, S.brew, sphere(0.3, 0.2), { bias });
  }
  const k = 0.3 + boil * 0.5;
  c.spark(x, by, S.hot, k * 0.7);
  c.spark(x - r, by, S.mid, k * 0.25);
  c.spark(x + r, by, S.mid, k * 0.25);
  if (boil > 0) {
    // Wisps of spirit curling up off the stopper.
    for (let i = 0; i < 3; i++) {
      const up = ((seed * 3 + i * 5) % 7) + 1;
      c.spark(x + ((i + seed) % 3) - 1, top - 1 - up * boil, i === 0 ? S.core : S.hot, 0.55 * boil);
    }
  }
}

/** A chem canister held at (x, y): a steel cylinder with brass caps, a valve, and a window of glowing chem. */
function heldCanister(c: PixelCanvas, x: number, y: number, size: 1 | 2, boil: number, bias: number, seed: number): void {
  const hw = size === 2 ? 2.1 : 1.4;
  const bot = Math.round(y);
  const top = bot - (size === 2 ? 6 : 4);
  c.part();
  c.shape(top, bot, () => [x - hw, x + hw], S.hat, (_x, _y, t) => cyl(t, 0.1), { bias });
  c.part();
  c.shape(top + 1, bot - 1, () => [x - hw * 0.5, x + hw * 0.5], S.brew, (_x, _y, t) => cyl(t, 0), { bias: bias + (boil > 0.6 ? 1 : 0) });
  c.part();
  c.shape(top, top, () => [x - hw, x + hw], BRASS, (_x, _y, t) => cyl(t, -0.5), { bias });
  c.shape(bot, bot, () => [x - hw, x + hw], BRASS, (_x, _y, t) => cyl(t, 0.5), { bias });
  c.px(x, top - 1, BRASS, sphere(-0.2, -0.7));
  // The chem's light through the window, and vapour hissing off the valve as it boils.
  const k = 0.3 + boil * 0.5;
  const my = (top + bot) / 2;
  c.spark(x, my, S.hot, k * 0.6);
  c.spark(x - hw - 0.5, my, S.mid, k * 0.3);
  c.spark(x + hw + 0.5, my, S.mid, k * 0.3);
  if (boil > 0) {
    for (let i = 0; i < 3; i++) {
      const up = ((seed * 3 + i * 5) % 7) + 1;
      c.spark(x + ((i + seed) % 3) - 1, top - 1 - up * boil, i === 0 ? S.core : S.hot, 0.55 * boil);
    }
  }
}

/**
 * A sleeved arm from the shoulder, bent at the elbow (towards `hint`), ending
 * in a black glove, with the flask in it when it's the throwing hand.
 */
function arm(c: PixelCanvas, sx: number, sy: number, p: Placed, reach: number, hint: [number, number], hold: { size: 0 | 1 | 2; boil: number; seed: number }, bias = 0): void {
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
  c.capsule(sx, sy, ex, ey, 1.75, 1.5, S.coat, { bias });
  c.part();
  c.capsule(ex, ey, fx, fy, 1.5, 1.35, S.coat, { bias });
  if (hold.size) heldFlask(c, fx, fy - 0.6, hold.size, hold.boil, bias, hold.seed);
  c.part();
  if (S.witch || S.shaman) c.ellipse(fx, fy, 1.15, 1.1, S.gloves, { bias });
  else c.ellipse(fx, fy, 1.35, 1.25, S.gloves, { bias: bias + 1 });
}

function leg(c: PixelCanvas, hx: number, hy: number, fx: number, fy: number, bias = 0): void {
  c.part();
  c.capsule(hx, hy, fx, fy, 1.5, 1.3, TROUSER, { bias });
}

/** A tall black boot, the toe turned towards the viewer or forward. */
function boot(c: PixelCanvas, x: number, y: number, side = false, bias = 0): void {
  c.part();
  if (side) c.ellipse(x, y, 2.2, 1.2, BOOT, { flatten: 0.8, bias });
  else c.ellipse(x, y, 1.6, 1.3, BOOT, { flatten: 0.8, bias });
}

/** A vial on the bandolier: a pixel of glass over a pixel of poison. */
function vial(c: PixelCanvas, x: number, y: number): void {
  c.px(x, y - 1, GLASS, sphere(-0.3, -0.4));
  c.px(x, y, S.brew, sphere(0, 0.2));
  c.spark(x, y, S.mid, 0.3);
}

function lenses(c: PixelCanvas, pts: [number, number][], blink: boolean | undefined): void {
  c.part();
  for (const [x, y] of pts) {
    if (S.witch && blink) {
      // Her eyelids: a line of skin.
      c.px(x, y, S.face, sphere(0, -0.2), { bias: -1 });
      continue;
    }
    c.px(x, y, S.eye, sphere(-0.3, 0.3), blink ? { bias: -2, glow: 0.35 } : {});
    if (!blink) c.spark(x, y, S.hot, S.witch ? 0.6 : 0.35);
  }
}

/**
 * The hat: a broad brim with the crown rising out of it, a band and a brass
 * buckle. The witch's crown rises to a tall point that bends over backwards.
 */
function hat(c: PixelCanvas, cx: number, U: number, view: View): void {
  if (S.chem) {
    helmet(c, cx, U, view);
    return;
  }
  if (S.shaman) {
    horns(c, cx, U, view);
    return;
  }
  const brimY = 9.4 + U;
  c.part();
  if (view === 'side') {
    c.ellipse(cx, brimY, 6.3, 1.45, S.hat, { normal: (_x, _y, dx, dy) => sphere(dx * 0.6, dy * 0.4 - 0.55, 1) });
  } else {
    c.ellipse(cx, brimY, 6.6, 1.95, S.hat, { normal: (_x, _y, dx, dy) => sphere(dx * 0.6, dy * 0.45 - 0.5, 1) });
  }
  // The brim's front edge catches the light.
  const lip = Math.round(brimY + (view === 'side' ? 0.6 : 1.2));
  for (let x = Math.round(cx - (view === 'side' ? 4 : 5)); x <= Math.round(cx + (view === 'side' ? 3 : 4)); x++) c.shade(x, lip, 1);
  c.part();
  const off = view === 'side' ? 0.6 : 0;
  if (S.witch) {
    // Tall and crooked: it narrows to a point, the tip slumping over to the back
    // (away from the viewer from the side, to her left from the front).
    const top = -3 + U;
    const bend = view === 'up' ? -1 : 1;
    c.shape(top, 8 + U, (y) => {
      const u = (y - top) / (8 + U - top);
      const hw = 0.45 + 2.85 * Math.pow(u, 1.15);
      const lean = bend * (1 - u) * (1 - u) * 4.4;
      return [cx + off + lean - hw, cx + off + lean + hw];
    }, S.hat, (_x, _y, t, u) => sphere(t * 0.9, u * 0.6 - 0.7, 1));
    // A dent where the crown folds over.
    c.shade(Math.round(cx + off + bend * 1.4), 1 + U, -1);
    c.shade(Math.round(cx + off + bend * 0.6), 2 + U, 1);
  } else {
    const crown = [2.3, 2.9, 3.1, 3.2, 3.3];
    c.shape(4 + U, 8 + U, (y) => {
      const hw = crown[y - 4 - U];
      return [cx + off - hw, cx + off + hw];
    }, S.hat, (_x, _y, t, u) => sphere(t * 0.9, u * 0.9 - 0.8, 1));
  }
  c.part();
  c.shape(8 + U, 8 + U, () => [cx + off - 3.3, cx + off + 3.3], S.band, (_x, _y, t) => cyl(t, 0.2), { bias: 1 });
  if (view === 'down') c.px(cx + 1, 8 + U, GOLD, sphere(0.2, -0.3));
  if (view === 'side') c.px(cx - 2, 8 + U, GOLD, sphere(-0.4, -0.3));
}

/** Chemtech's steel helmet: a riveted dome, a brass brow band, and a glass tube of chem standing on top. */
function helmet(c: PixelCanvas, cx: number, U: number, view: View): void {
  if (S.cryo) {
    dome(c, cx, U, view);
    return;
  }
  const x = cx + (view === 'side' ? 0.6 : 0);
  c.part();
  c.ellipse(x, 8 + U, 3.9, 2.9, S.hat, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.35, 1) });
  // Rivets round the dome, and a seam over the crown.
  for (const [dx, dy] of [[-3, 8], [3, 8]] as const) c.shade(Math.round(x + dx), dy + U, 1);
  if (view !== 'side') for (let y = 6; y <= 9; y++) c.shade(Math.round(x), y + U, view === 'up' ? -1 : 1);
  c.part();
  c.shape(10 + U, 10 + U, () => [x - 3.9, x + 3.9], S.band, (_x, _y, t) => cyl(t, 0.1));
  // From the side, a short visor juts over the lenses.
  if (view === 'side') c.px(Math.round(x - 4.4), 10 + U, S.band, sphere(-0.7, 0.2));
  // The chem tube: a cap, glass and glowing chem, set to one side of the crown.
  c.part();
  const tx = Math.round(x + (view === 'side' ? 1.6 : 2));
  c.px(tx, 3 + U, S.band, sphere(0, -0.7));
  c.px(tx, 4 + U, GLASS, sphere(-0.3, -0.5));
  c.px(tx, 5 + U, S.brew, sphere(0, 0.1));
  c.spark(tx, 5 + U, S.mid, 0.45);
  c.spark(tx, 4 + U, S.hot, 0.2);
}

/** Chemtech from the front: a black gas mask, big round acid lenses, a respirator snout and a filter on each cheek. */
function chemMask(c: PixelCanvas, cx: number, U: number, blink: boolean | undefined): void {
  c.part();
  c.ellipse(cx, 12 + U, 3.0, 2.4, S.face);
  // Twin filters, jutting out past the cheeks.
  c.part();
  c.ellipse(cx - 3.3, 14.2 + U, 1.3, 1.25, S.mantle);
  c.ellipse(cx + 3.3, 14.2 + U, 1.3, 1.25, S.mantle, { bias: -1 });
  c.px(cx - 4, 14 + U, S.band, sphere(-0.3, 0));
  c.px(cx + 3, 14 + U, S.band, sphere(0.3, 0));
  // The respirator snout, with a brass grille.
  c.part();
  c.ellipse(cx, 14 + U, 1.6, 1.3, S.face, { bias: 1 });
  c.px(cx - 1, 14 + U, S.band, sphere(-0.3, 0.3));
  c.px(cx, 14 + U, S.band, sphere(0.3, 0.3), { bias: -1 });
  lenses(c, [[9, 11 + U], [10, 11 + U], [9, 12 + U], [10, 12 + U], [13, 11 + U], [14, 11 + U], [13, 12 + U], [14, 12 + U]], blink);
}

/** Chemtech's pressure tank, from behind: a steel cylinder with brass caps and a window of chem down the middle. */
function tankBack(c: PixelCanvas, cx: number, U: number): void {
  c.part();
  c.shape(15 + U, 22 + U, () => [cx - 2.6, cx + 2.6], S.hat, (_x, _y, t, u) => sphere(t * 0.95, u * 0.5 - 0.3, 1));
  c.part();
  c.shape(16 + U, 21 + U, () => [cx - 1, cx + 1], S.brew, (_x, _y, t) => cyl(t, 0));
  c.spark(cx, 18 + U, S.hot, 0.45);
  c.part();
  c.shape(14 + U, 14 + U, () => [cx - 2.1, cx + 2.1], S.band, (_x, _y, t) => cyl(t, -0.5));
  c.shape(23 + U, 23 + U, () => [cx - 2.1, cx + 2.1], S.band, (_x, _y, t) => cyl(t, 0.5));
  // Hoses from the valve up over the shoulders to the mask.
  c.part();
  c.capsule(cx - 1.4, 14.2 + U, cx - 3.8, 12.6 + U, 0.55, 0.5, S.face);
  c.capsule(cx + 1.4, 14.2 + U, cx + 3.8, 12.6 + U, 0.55, 0.5, S.face);
}

/** A ragged hem: every other pixel of the bottom row torn away. */
function tatter(c: PixelCanvas, y: number, x0: number, x1: number): void {
  for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) if ((x & 1) === 0 && c.filled(x, y) && c.filled(x, y - 1)) c.erase(x, y);
}

/** Long silver hair falling from under the hat, rows y0..y1 between l and r. */
function hair(c: PixelCanvas, y0: number, y1: number, l: (u: number) => number, r: (u: number) => number): void {
  if (!S.hair) return;
  c.part();
  c.shape(y0, y1, (y) => {
    const u = (y - y0) / Math.max(1, y1 - y0);
    return [l(u), r(u)];
  }, S.hair, (x, _y, t, u) => sphere(t * 0.8, u * 0.5 - 0.3 + (x & 1 ? 0.15 : -0.15), 1));
}

/** Shoulder mantle, flaring from the collar over the tops of the arms. */
function mantle(c: PixelCanvas, cx: number, U: number, l: number, r: number): void {
  const top = 13 + U;
  c.part();
  c.shape(top, top + 4, (y) => {
    const u = (y - top) / 4;
    const k = Math.sqrt(u) * 0.8 + 0.2;
    return [cx - l * k, cx + r * k];
  }, S.mantle, (_x, _y, t, u) => sphere(t * 0.95, u - 0.6, 1));
  if (S.chem) {
    // Pauldron rivets, and the plates' lower rim in shadow.
    c.px(Math.round(cx - l * 0.7), top + 2, S.band, sphere(-0.4, -0.4));
    c.px(Math.round(cx + r * 0.7) - 1, top + 2, S.band, sphere(0.4, -0.4));
    for (let x = Math.floor(cx - l); x <= Math.ceil(cx + r); x++) if (c.filled(x, top + 4)) c.shade(x, top + 4, -1);
    if (S.cryo) {
      // Frost crusted on the plates.
      c.part();
      for (const [x, y] of [[cx - l * 0.55, top + 1], [cx - l * 0.8, top + 3], [cx + r * 0.55 - 1, top + 1], [cx + r * 0.8 - 1, top + 3]] as const) c.px(Math.round(x), y, DOME, sphere(0, -0.5), { glow: 0.3 });
    }
  }
  if (S.witch || S.shaman) {
    // The shawl's ragged edge.
    const y = top + 4;
    for (let x = Math.floor(cx - l); x <= Math.ceil(cx + r); x++) if ((x & 1) === 1 && c.filled(x, y)) c.shade(x, y, -1);
  }
}

/** The witch from the front: hair falling past her shoulders, a pale green face, a hooked nose and glowing eyes. */
function witchFace(c: PixelCanvas, cx: number, U: number, blink: boolean | undefined): void {
  hair(c, 10 + U, 17 + U, (u) => cx - 3.6 - u * 0.9, (u) => cx - 1.6 - u * 0.4);
  hair(c, 10 + U, 17 + U, (u) => cx + 1.6 + u * 0.4, (u) => cx + 3.6 + u * 0.9);
  c.part();
  c.ellipse(cx, 12 + U, 2.7, 2.4, S.face);
  // The nose, long and pointed, its tip catching the light.
  c.part();
  c.shape(12 + U, 14 + U, (y) => {
    const hw = 1.0 - (y - 12 - U) * 0.25;
    return [cx - hw, cx + hw];
  }, S.face, (_x, _y, t, u) => sphere(t * 0.8, 0.6 - u * 0.5, 1));
  c.shade(cx - 1, 12 + U, 1);
  c.shade(cx, 14 + U, 1);
  // A thin, knowing mouth under it.
  c.shade(cx - 2, 14 + U, -2);
  c.shade(cx + 1, 14 + U, -2);
  lenses(c, [[10, 11 + U], [13, 11 + U]], blink);
}

/**
 * The shaman's crown of raven feathers fanning up behind his head, the middle
 * ones tipped red. From the side they sweep back.
 */
function feathers(c: PixelCanvas, cx: number, U: number, view: View): void {
  const quills: [number, number, number, number, Material][] =
    view === 'side'
      ? [
          [cx + 0.4, 9, cx - 0.6, 3.4, RED_FEATHER],
          [cx + 1.2, 9, cx + 1.8, 3, RAVEN],
          [cx + 1.8, 9.4, cx + 4, 4, RED_FEATHER],
          [cx + 2.2, 10, cx + 5.4, 5.8, RAVEN],
        ]
      : [
          [cx - 2.2, 9.6, cx - 5, 5.2, RAVEN],
          [cx - 1.2, 9.2, cx - 2.8, 3.4, RED_FEATHER],
          [cx, 9, cx, 2.6, RAVEN],
          [cx + 1.2, 9.2, cx + 2.8, 3.4, RED_FEATHER],
          [cx + 2.2, 9.6, cx + 5, 5.2, RAVEN],
        ];
  for (const [x0, y0, x1, y1, tip] of quills) {
    c.part();
    c.capsule(x0, y0 + U, x1, y1 + U, 0.55, 0.85, RAVEN, { bias: view === 'up' ? 0 : -1 });
    c.part();
    c.px(x1, y1 + U - 0.4, tip, sphere(0, -0.7), { bias: 1 });
  }
}

/** Great ram's horns curling out of the skull's temples, ridged along their length. */
function horns(c: PixelCanvas, cx: number, U: number, view: View): void {
  const curl = (pts: [number, number][], bias = 0) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const r0 = 1.3 - (i / (pts.length - 1)) * 0.8;
      const r1 = 1.3 - ((i + 1) / (pts.length - 1)) * 0.8;
      c.part();
      c.capsule(pts[i][0], pts[i][1] + U, pts[i + 1][0], pts[i + 1][1] + U, r0, r1, HORN, { bias });
      if (i > 0) c.shade(pts[i][0], pts[i][1] + U, -1);
    }
  };
  if (view === 'side') {
    curl([[cx - 0.6, 9.8], [cx + 1.8, 9.2], [cx + 3.2, 10.8], [cx + 2.9, 13], [cx + 1.6, 13.6], [cx + 0.9, 12.6]]);
    return;
  }
  const side = (k: number): [number, number][] => [
    [cx + k * 2.4, 10.2],
    [cx + k * 4.4, 9.2],
    [cx + k * 5.9, 10.4],
    [cx + k * 5.9, 12.5],
    [cx + k * 4.7, 13.3],
  ];
  curl(side(-1));
  curl(side(1), view === 'down' ? -1 : 0);
}

/** A braid of black hair from y0 down to y1, drifting `dx` sideways, a bone bead tied at its end. */
function braid(c: PixelCanvas, x: number, y0: number, y1: number, dx: number): void {
  c.part();
  c.capsule(x, y0, x + dx, y1, 0.75, 0.6, BRAID);
  for (let y = Math.ceil(y0) + 1; y < y1; y += 2) c.shade(x + dx * ((y - y0) / (y1 - y0)), y, -1);
  c.part();
  c.px(x + dx, y1 + 1, BONE, sphere(0, 0.2));
}

/** The shaman from the front: braids to the chest, a ram's skull over his face with spirit-fire in its sockets. */
function shamanFace(c: PixelCanvas, cx: number, U: number, blink: boolean | undefined): void {
  braid(c, cx - 3.2, 12 + U, 18 + U, -0.6);
  braid(c, cx + 3.2, 12 + U, 18 + U, 0.6);
  c.part();
  c.ellipse(cx, 11.6 + U, 3.0, 2.6, BONE);
  // The snout, narrowing down over the collar, and its teeth.
  c.part();
  c.shape(13 + U, 16 + U, (y) => {
    const hw = [2.0, 1.75, 1.45, 1.05][y - 13 - U];
    return [cx - hw, cx + hw];
  }, BONE, (_x, _y, t, u) => sphere(t * 0.8, 0.3 + u * 0.4, 1));
  c.shade(cx - 1, 14 + U, -2);
  c.shade(cx, 14 + U, -2);
  c.shade(cx - 1, 16 + U, -1);
  c.shade(cx + 1, 16 + U, -1);
  // A crack over the brow.
  c.shade(cx + 1, 9 + U, -1);
  c.shade(cx + 2, 10 + U, -1);
  // Deep sockets, and the fire burning in them.
  for (const [x, y] of [[9, 11], [10, 12], [13, 12], [14, 11]] as const) c.shade(x, y + U, -2);
  lenses(c, [[10, 11 + U], [13, 11 + U]], blink);
}

/** A necklace of teeth hanging below the mantle. */
function necklace(c: PixelCanvas, pts: [number, number][]): void {
  c.part();
  pts.forEach(([x, y], i) => c.px(x, y, BONE, sphere(i % 2 ? 0.3 : -0.3, 0.2), { bias: i % 2 ? -1 : 1 }));
}

/**
 * Cryotech's bubble helmet: a ring of glass round the head, the light
 * glinting on it, seated in a steel collar with a valve on the crown.
 */
function dome(c: PixelCanvas, cx: number, U: number, view: View): void {
  const x = cx + (view === 'side' ? -0.4 : 0);
  const y = 11.4 + U;
  const r = 4.3;
  c.part();
  for (let py = Math.floor(y - r - 1); py <= Math.floor(y + 3.4); py++) {
    for (let px = Math.floor(x - r - 1); px <= Math.ceil(x + r + 1); px++) {
      const dx = px + 0.5 - x;
      const dy = py + 0.5 - y;
      const d = Math.hypot(dx, dy);
      if (d < r - 0.5 || d > r + 0.5) continue;
      c.px(px, py, DOME, sphere((dx / d) * 0.8, (dy / d) * 0.8, 1), { bias: dx + dy < -2 ? 1 : 0 });
    }
  }
  c.part();
  const hw = view === 'side' ? 3.2 : 3.6;
  c.shape(15 + U, 15 + U, () => [x - hw, x + hw], S.band, (_x, _y, t) => cyl(t, 0.3));
  c.px(x, Math.round(y - r - 1), S.band, sphere(0, -0.7));
  // Light on the glass.
  c.spark(x - 2.2, y - 2.6, [255, 255, 255], 0.55);
  c.spark(x - 3.0, y - 1.4, [220, 244, 255], 0.35);
  if (view !== 'up') c.spark(x + 2.6, y + 1.8, S.mid, 0.25);
}

/** Cryotech from the front, inside the bubble: an insulated hood, a band of glowing ice visor, a small respirator. */
function cryoFace(c: PixelCanvas, cx: number, U: number, blink: boolean | undefined): void {
  c.part();
  c.ellipse(cx, 12 + U, 2.9, 2.6, S.face);
  c.part();
  c.shape(13 + U, 14 + U, () => [cx - 1.2, cx + 1.2], S.mantle, (_x, _y, t, u) => sphere(t * 0.8, u * 0.6, 1));
  c.px(cx - 1, 14 + U, S.band, sphere(-0.3, 0.3));
  lenses(c, [[9, 11 + U], [10, 11 + U], [11, 11 + U], [12, 11 + U], [13, 11 + U], [14, 11 + U]], blink);
}

/**
 * A puff of chem vapour off a canister's valve at (x, y): a knot of light
 * that rises, drifts off to one side and thins out over `k` = 1..3.
 */
function puff(c: PixelCanvas, x: number, y: number, k: number): void {
  const px = x + PUFF_DRIFT * k;
  const py = y - PUFF_RISE * k;
  const r = 0.6 + k * 0.55;
  const a = 2.4 - k * 0.5;
  for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
    for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
      const d = Math.hypot(dx, dy * 1.2) / r;
      if (d > 1) continue;
      // Ragged at the edge as it spreads: every other rim pixel gone.
      if (k > 1 && d > 0.7 && ((dx + dy + k) & 1)) continue;
      c.spark(px + dx, py + dy, d < 0.45 ? S.core : d < 0.8 ? S.hot : S.mid, a * (1 - d * 0.55));
    }
  }
  // A wisp still trailing back to the valve.
  for (let i = 1; i < k + 1; i++) c.spark(x + (px - x) * (i / (k + 1)), y + (py - y) * (i / (k + 1)), S.hot, 0.45);
}

// ---------------------------------------------------------------------------
// Directions

const REACH_FRONT = 4.4;
const REACH_SIDE = 5.2;

/** The greatcoat's outline: broad at the chest, nipped at the belt, flaring to the hem. */
function coatWidth(y: number, top: number, waist: number, hem: number, chest: number): number {
  if (y <= waist) {
    const u = (y + 0.5 - top) / (waist - top);
    return chest - 0.5 * u * u;
  }
  const u = (y + 0.5 - waist) / (hem - waist);
  return chest - 0.5 + 1.4 * u;
}

function drawDown(c: PixelCanvas, p: Pose, seed: number): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('down', 'a', p.a, U, cx);
  const fb = place('down', 'b', p.b, U, cx);
  const shA = { x: 7.4, y: 16.4 + U };
  const shB = { x: 16.6, y: 16.4 + U };
  const hold = { size: p.flask, boil: p.boil, seed };
  const armA = () => arm(c, shA.x, shA.y, fa, REACH_FRONT, [-0.4, 1], hold, fa.behind ? -1 : 0);
  const armB = () => arm(c, shB.x, shB.y, fb, REACH_FRONT, [0.4, 1], { size: 0, boil: 0, seed }, fb.behind ? -1 : 0);
  // Everything above the collar, drawn nudged by the pose's head offset.
  const head = (draw: () => void) => {
    c.offset(BODY_X + (p.headX ?? 0), BODY_Y + (p.headY ?? 0));
    draw();
    c.offset(BODY_X, BODY_Y);
  };
  if (fa.behind) armA();
  if (fb.behind) armB();

  // Legs under the hem.
  leg(c, 10.2, 25.5 + L, 10, 28.4 - p.footA);
  leg(c, 13.8, 25.5 + L, 14, 28.4 - p.footB);
  boot(c, 10, 29.6 - p.footA);
  boot(c, 14, 29.6 - p.footB);

  // The greatcoat, its front parted below the belt.
  const top = 15 + U;
  const waist = 22 + U;
  const hem = 27 + L;
  c.part();
  c.shape(top, hem, (y) => {
    const hw = coatWidth(y, top, waist, hem, 4.7);
    const sw = y > waist ? ((y - waist) / (hem - waist)) * p.sway : 0;
    return [cx - hw + sw, cx + hw + sw];
  }, S.coat, (_x, y, t) => sphere(t * 0.9, y <= waist ? (y - top) / (waist - top) * 0.8 - 0.35 : 0.2, 1));
  for (let y = waist + 1; y <= hem; y++) c.shade(cx + Math.round(((y - waist) / (hem - waist)) * p.sway), y, -2);
  for (let y = top + 2; y < waist; y++) c.shade(cx, y, -1);
  if (S.witch || S.shaman) tatter(c, hem, cx - 6, cx + 6);
  if (S.chem) {
    // A heavy leather apron down the front, riveted at the corners.
    c.part();
    c.shape(top + 3, hem, (y) => {
      const u = (y - top - 3) / (hem - top - 3);
      const hw = 2.2 + u * 0.9;
      const sw = y > waist ? ((y - waist) / (hem - waist)) * p.sway : 0;
      return [cx - hw + sw, cx + hw + sw];
    }, S.apron ?? LEATHER, (_x, _y, t, u) => sphere(t * 0.8, u * 0.4 - 0.15, 1));
    c.px(cx - 3, hem - 1, S.band, sphere(-0.3, 0));
    c.px(cx + 2, hem - 1, S.band, sphere(0.3, 0));
    // Cryotech's front is quilted: a seam down it and across it every few rows.
    if (S.cryo) for (let y = top + 4; y < hem - 1; y++) for (let x = cx - 2; x <= cx + 1; x++) if ((y - top) % 3 === 0 || x === cx) c.shade(x, y, -1);
  }
  // Brass buttons down the front, where the beak doesn't cover them.
  c.part();
  if (!S.witch && !S.chem && !S.shaman) for (const y of [19, 21]) c.px(cx - 2, y + U, GOLD, sphere(-0.3, -0.4));
  // Belt and buckle.
  c.part();
  c.shape(waist, waist, () => [cx - 4.3, cx + 4.3], LEATHER, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(cx, waist, GOLD, sphere(0, -0.3));
  c.px(cx - 1, waist, GOLD, sphere(-0.4, -0.3), { bias: -1 });
  // The bandolier, shoulder to hip, with its vials.
  c.part();
  c.capsule(7.8, 15.6 + U, 16.2, 22.4 + U, 0.6, 0.6, LEATHER);
  for (const t of [0.42, 0.6, 0.78]) vial(c, Math.round(7.8 + 8.4 * t), Math.round(15.6 + 6.8 * t + U) - 1);

  mantle(c, cx, U, 5.9, 5.9);

  if (S.witch) {
    // A pendant on a cord: a brass crescent round a drop of the brew.
    c.part();
    c.px(cx - 1, 18 + U, GOLD, sphere(-0.5, -0.2));
    c.px(cx - 1, 19 + U, GOLD, sphere(-0.4, 0.4));
    c.px(cx, 19 + U, S.brew, sphere(0.2, 0.2));
    c.spark(cx, 19 + U, S.mid, 0.35);
    head(() => {
      witchFace(c, cx, U, p.blink);
      hat(c, cx, U, 'down');
    });
    if (!fa.behind) armA();
    if (!fb.behind) armB();
    return;
  }

  if (S.shaman) {
    necklace(c, [[8, 17 + U], [9, 18 + U], [10, 18 + U], [11, 19 + U], [12, 19 + U], [13, 18 + U], [14, 18 + U], [15, 17 + U], [10, 19 + U], [13, 19 + U]]);
    head(() => {
      feathers(c, cx, U, 'down');
      shamanFace(c, cx, U, p.blink);
      hat(c, cx, U, 'down');
    });
    if (!fa.behind) armA();
    if (!fb.behind) armB();
    return;
  }

  if (S.chem) {
    head(() => {
      if (S.cryo) cryoFace(c, cx, U, p.blink);
      else chemMask(c, cx, U, p.blink);
      hat(c, cx, U, 'down');
    });
    if (!fa.behind) armA();
    if (!fb.behind) armB();
    if (p.puff) puff(c, fa.x, Math.round(fa.y - 0.6) - 5, p.puff);
    return;
  }

  // The masked head under the brim; the beak juts out towards us over the collar.
  head(() => {
    c.part();
    c.ellipse(cx, 12 + U, 3.0, 2.4, BEAK);
    c.part();
    c.shape(12 + U, 16 + U, (y) => {
      const hw = 1.4 - (y - 12 - U) * 0.26;
      return [cx - hw, cx + hw];
    }, BEAK, (_x, _y, t, u) => sphere(t * 0.8, 0.5 - u * 0.6, 1));
    c.shade(cx, 14 + U, -1);
    c.shade(cx - 1, 13 + U, 1);
    lenses(c, [[9, 11 + U], [10, 11 + U], [13, 11 + U], [14, 11 + U]], p.blink);
    hat(c, cx, U, 'down');
  });

  if (!fa.behind) armA();
  if (!fb.behind) armB();
}

function drawUp(c: PixelCanvas, p: Pose, seed: number): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('up', 'a', p.a, U, cx);
  const fb = place('up', 'b', p.b, U, cx);
  const hold = { size: p.flask, boil: p.boil, seed };
  const armA = () => arm(c, 7.4, 16.4 + U, fa, REACH_FRONT, [-0.5, 0.8], hold, fa.behind ? -1 : 0);
  const armB = () => arm(c, 16.6, 16.4 + U, fb, REACH_FRONT, [0.5, 0.8], { size: 0, boil: 0, seed }, fb.behind ? -1 : 0);
  if (fa.behind) armA();
  if (fb.behind) armB();

  leg(c, 10.2, 25.5 + L, 10, 28.4 - p.footB);
  leg(c, 13.8, 25.5 + L, 14, 28.4 - p.footA);
  boot(c, 10, 29.6 - p.footB);
  boot(c, 14, 29.6 - p.footA);

  // The coat from behind: a seam down the back to a vent at the hem.
  const top = 15 + U;
  const waist = 22 + U;
  const hem = 27 + L;
  c.part();
  c.shape(top, hem, (y) => {
    const hw = coatWidth(y, top, waist, hem, 4.7);
    const sw = y > waist ? ((y - waist) / (hem - waist)) * p.sway : 0;
    return [cx - hw + sw, cx + hw + sw];
  }, S.coat, (_x, y, t) => sphere(t * 0.9, y <= waist ? (y - top) / (waist - top) * 0.8 - 0.35 : 0.2, 1));
  for (let y = top + 3; y <= hem; y++) c.shade(cx + (y > waist ? Math.round(((y - waist) / (hem - waist)) * p.sway) : 0), y, y > hem - 3 ? -2 : -1);
  if (S.witch || S.shaman) tatter(c, hem, cx - 6, cx + 6);
  c.part();
  c.shape(waist, waist, () => [cx - 4.3, cx + 4.3], LEATHER, (_x, _y, t) => cyl(t, 0));
  // The bandolier crossing the back, and a satchel at the hip.
  c.part();
  c.capsule(16.2, 15.6 + U, 8.2, 22.4 + U, 0.6, 0.6, LEATHER);
  c.part();
  c.shape(22 + U, 25 + U, () => [6.2, 9.8], LEATHER, (_x, _y, t, u) => sphere(t * 0.9, u * 0.8 - 0.4, 1));
  c.part();
  c.shape(22 + U, 23 + U, () => [6.0, 10.0], LEATHER, (_x, _y, t) => cyl(t, 0.4), { bias: 1 });
  c.px(8, 23 + U, GOLD, sphere(0, -0.3));

  mantle(c, cx, U, 5.9, 5.9);
  if (S.witch) {
    // Her hair down her back, over the shawl, ending in ragged points.
    c.part();
    c.ellipse(cx, 12 + U, 3.2, 2.6, S.hair!, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 1) });
    hair(c, 12 + U, 19 + U, (u) => cx - 3.3 + u * 0.5, (u) => cx + 3.3 - u * 0.5);
    tatter(c, 19 + U, cx - 3, cx + 3);
    for (const x of [cx - 1, cx + 1]) for (let y = 13; y <= 18; y++) c.shade(x, y + U, -1);
  } else if (S.shaman) {
    // Black hair bound in braids down his back, the skull's thong across it, then the feathers and horns.
    c.part();
    c.ellipse(cx, 12 + U, 3.2, 2.6, BRAID, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 1) });
    for (let x = cx - 3; x <= cx + 2; x++) c.px(x, 11 + U, HIDE, sphere(0, -0.2), { bias: x === cx - 3 || x === cx + 2 ? -1 : 0 });
    braid(c, cx - 1.6, 13 + U, 20 + U, -0.4);
    braid(c, cx + 1.6, 13 + U, 20 + U, 0.4);
    feathers(c, cx, U, 'up');
  } else if (S.chem) {
    // The back of the mask's rubber hood, its straps, and the tank over it all.
    c.part();
    c.ellipse(cx, 12 + U, 3.2, 2.6, S.face, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 1) });
    for (let x = cx - 3; x <= cx + 2; x++) c.shade(x, 12 + U, 1);
    tankBack(c, cx, U);
  } else {
    // The hood behind the mask, then the hat over it.
    c.part();
    c.ellipse(cx, 12 + U, 3.2, 2.6, S.hat, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 1), bias: -1 });
  }
  hat(c, cx, U, 'up');

  if (!fa.behind) armA();
  if (!fb.behind) armB();
}

/** Facing left. Right-facing frames are mirrored from these. */
function drawSide(c: PixelCanvas, p: Pose, seed: number): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const hx = cx - p.lean; // upper body centre
  const fa = place('side', 'a', p.a, U, hx);
  const fb = place('side', 'b', p.b, U, hx);

  // Far arm, behind everything.
  arm(c, hx + 1.2, 16.6 + U, fb, REACH_SIDE, [0.3, 1], { size: 0, boil: 0, seed }, -1);

  // Legs: back leg in shade first, then the front leg.
  const lift = (f: number) => Math.max(0, f) * 0.35;
  leg(c, cx + 0.8, 25.5 + L, cx + 1 - p.footB, 28.4 - lift(p.footB), -1);
  boot(c, cx + 0.4 - p.footB, 29.7 - lift(p.footB), true, -1);
  leg(c, cx - 0.6, 25.5 + L, cx - 0.4 - p.footA, 28.4 - lift(p.footA));
  boot(c, cx - 1.2 - p.footA, 29.7 - lift(p.footA), true);

  if (S.chem) {
    // The pressure tank on his back, peeking out behind the coat.
    c.part();
    c.shape(14 + U, 22 + U, () => [hx + 2.2, hx + 6.2], S.hat, (_x, _y, t, u) => sphere(t * 0.9, u * 0.5 - 0.3, 1), { bias: -1 });
    c.part();
    for (let y = 16; y <= 20; y++) c.px(Math.round(hx + 5), y + U, S.brew, sphere(0.5, 0));
    c.spark(hx + 5, 18 + U, S.hot, 0.35);
    c.part();
    c.shape(13 + U, 13 + U, () => [hx + 2.6, hx + 5.8], S.band, (_x, _y, t) => cyl(t, -0.5));
    c.shape(23 + U, 23 + U, () => [hx + 2.6, hx + 5.8], S.band, (_x, _y, t) => cyl(t, 0.5));
  }

  // The greatcoat in profile, its tails swinging out behind.
  const top = 15 + U;
  const waist = 22 + U;
  const hem = 27 + L;
  c.part();
  c.shape(top, hem, (y) => {
    const u = y <= waist ? 0 : (y - waist) / (hem - waist);
    const shift = y <= waist ? hx : hx + (cx - hx) * u;
    const hw = coatWidth(y, top, waist, hem, 3.2);
    return [shift - hw - 0.2, shift + hw + 0.3 + u * p.sway];
  }, S.coat, (_x, y, t) => sphere(t * 0.9 - 0.1, y <= waist ? (y - top) / (waist - top) * 0.8 - 0.35 : 0.2, 1));
  // The fold where the front panel meets the side.
  for (let y = waist + 1; y <= hem; y++) c.shade(Math.round(hx + (cx - hx) * ((y - waist) / (hem - waist)) - 1.5), y, -1);
  if (S.witch || S.shaman) tatter(c, hem, cx - 5, cx + 6);
  c.part();
  c.shape(waist, waist, () => [hx - 3.1, hx + 3.2], LEATHER, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(Math.round(hx - 3.1), waist, GOLD, sphere(-0.5, -0.3));
  // The bandolier runs down the near side, vials along it.
  c.part();
  c.capsule(hx + 1.6, 15.4 + U, hx - 2.2, 22.2 + U, 0.6, 0.6, LEATHER);
  for (const t of [0.45, 0.72]) vial(c, Math.round(hx + 1.6 - 3.8 * t), Math.round(15.4 + 6.8 * t + U) - 1);

  mantle(c, hx, U, 4.4, 4.2);

  if (S.witch) {
    // Her hair streaming down her back, then her face in profile: a long
    // hooked nose, a jutting chin and one glowing eye under the brim.
    hair(c, 10 + U, 18 + U, (u) => hx + 0.2 + u * 0.6, (u) => hx + 3.3 + u * (1 + p.sway * 0.5));
    tatter(c, 18 + U, hx, hx + 6);
    c.part();
    c.ellipse(hx + 1.4, 12 + U, 2.0, 2.4, S.hair!, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.2, dy * 0.8, 1) });
    c.part();
    c.ellipse(hx - 0.6, 12.2 + U, 2.4, 2.3, S.face);
    c.part();
    c.capsule(hx - 2.4, 12.2 + U, hx - 4.3, 12.9 + U, 0.85, 0.6, S.face);
    c.capsule(hx - 4.3, 12.9 + U, hx - 4.8, 14.0 + U, 0.6, 0.4, S.face);
    c.px(hx - 2.6, 14 + U, S.face, sphere(-0.6, 0.4));
    c.shade(hx - 3, 12 + U, 1);
    c.shade(hx - 2, 13 + U, -2);
    lenses(c, [[hx - 2, 11 + U]], p.blink);
    hat(c, hx, U, 'side');
    arm(c, hx + 0.2, 16.8 + U, fa, REACH_SIDE, [0.3, 1], { size: p.flask, boil: p.boil, seed });
    return;
  }

  if (S.shaman) {
    // The feathers sweeping back, braids down his back, then the skull in
    // profile: a blunt snout, fire in the socket, and a horn curled round his ear.
    feathers(c, hx, U, 'side');
    braid(c, hx + 2.4, 12 + U, 19 + U, 0.8 + p.sway * 0.4);
    c.part();
    c.ellipse(hx + 1.3, 12 + U, 1.9, 2.3, BRAID, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.2, dy * 0.8, 1) });
    c.part();
    c.ellipse(hx - 0.4, 11.8 + U, 2.6, 2.4, BONE);
    c.part();
    c.capsule(hx - 2.2, 12.6 + U, hx - 4.8, 14.0 + U, 1.35, 0.95, BONE);
    c.shade(hx - 4, 13 + U, -2);
    c.shade(hx - 4, 15 + U, -1);
    c.shade(hx - 3, 15 + U, -1);
    c.shade(hx - 3, 11 + U, -2);
    necklace(c, [[hx - 3, 17 + U], [hx - 3, 18 + U], [hx - 2, 18 + U], [hx - 1, 18 + U]]);
    lenses(c, [[hx - 2, 11 + U]], p.blink);
    hat(c, hx, U, 'side');
    arm(c, hx + 0.2, 16.8 + U, fa, REACH_SIDE, [0.3, 1], { size: p.flask, boil: p.boil, seed });
    return;
  }

  if (S.chem) {
    // A leather apron over the front of the coat.
    c.part();
    c.shape(waist + 1, hem, (y) => {
      const u = (y - waist) / (hem - waist);
      const x0 = hx + (cx - hx) * u - 3.4;
      return [x0, x0 + 2];
    }, S.apron ?? LEATHER, (_x, _y, t) => sphere(t * 0.8 - 0.2, 0.1, 1));
    if (S.cryo) {
      // Inside the bubble: the hood, a band of ice visor, a small respirator
      // and its hose back to the tank.
      c.part();
      c.ellipse(hx - 0.2, 12 + U, 2.8, 2.5, S.face);
      c.part();
      c.px(hx - 3, 14 + U, S.mantle, sphere(-0.5, 0.3));
      c.px(hx - 2, 14 + U, S.mantle, sphere(0, 0.3));
      c.part();
      c.capsule(hx - 2.2, 15.2 + U, hx + 0.4, 16.2 + U, 0.55, 0.55, S.face);
      c.capsule(hx + 0.4, 16.2 + U, hx + 2.8, 14.4 + U, 0.55, 0.55, S.face);
      lenses(c, [[hx - 3, 11 + U], [hx - 2, 11 + U], [hx - 1, 11 + U]], p.blink);
      hat(c, hx, U, 'side');
      arm(c, hx + 0.2, 16.8 + U, fa, REACH_SIDE, [0.3, 1], { size: p.flask, boil: p.boil, seed });
      return;
    }
    // The mask in profile: a rubber hood, the snout thrust forward with a
    // filter on its end, and a hose from under it back to the tank.
    c.part();
    c.ellipse(hx - 0.2, 12 + U, 2.8, 2.4, S.face);
    c.part();
    c.capsule(hx - 2.2, 13.4 + U, hx - 3.9, 14.1 + U, 1.35, 1.1, S.face, { bias: 1 });
    c.part();
    c.ellipse(hx - 4.8, 14.2 + U, 1.1, 1.45, S.mantle);
    c.px(Math.round(hx - 5.2), 14 + U, S.band, sphere(-0.6, 0));
    c.part();
    c.capsule(hx - 3.2, 15.4 + U, hx - 0.4, 16.4 + U, 0.55, 0.55, S.face);
    c.capsule(hx - 0.4, 16.4 + U, hx + 2.8, 14.4 + U, 0.55, 0.55, S.face);
    lenses(c, [[hx - 2, 11 + U], [hx - 2, 12 + U], [hx - 1, 11 + U]], p.blink);
    hat(c, hx, U, 'side');
    arm(c, hx + 0.2, 16.8 + U, fa, REACH_SIDE, [0.3, 1], { size: p.flask, boil: p.boil, seed });
    return;
  }

  // Head: the mask in profile, the long beak curving down to a point.
  c.part();
  c.ellipse(hx - 0.2, 12 + U, 2.8, 2.4, BEAK);
  c.part();
  c.ellipse(hx + 1.3, 12 + U, 1.9, 2.3, S.hat, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.2, dy * 0.8, 1) });
  c.part();
  c.capsule(hx - 2.3, 12.4 + U, hx - 5.2, 13.3 + U, 1.35, 0.95, BEAK);
  c.capsule(hx - 5.2, 13.3 + U, hx - 7.3, 14.9 + U, 0.95, 0.45, BEAK);
  c.shade(hx - 4, 13 + U, 1);
  c.shade(hx - 3, 14 + U, -1);
  lenses(c, [[hx - 2, 11 + U]], p.blink);
  hat(c, hx, U, 'side');

  // Near shoulder and arm.
  arm(c, hx + 0.2, 16.8 + U, fa, REACH_SIDE, [0.3, 1], { size: p.flask, boil: p.boil, seed });
}

// ---------------------------------------------------------------------------
// Animations

/** The flask held out before him, off hand at his side. */
const HOLD_A = H(2.6, 3.0, -0.5);
const HOLD_B = H(0.6, 4.4, -3.6);

const base = (view: View): Pose => ({
  lift: 0,
  breath: 0,
  footA: view === 'side' ? 1 : 0,
  footB: view === 'side' ? -1 : 0,
  lean: 0,
  a: { ...HOLD_A },
  b: { ...HOLD_B },
  flask: 1,
  boil: 0,
  sway: 0,
});

/** Standing, swirling the flask and watching it glow. */
function idle(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = (f / N) * Math.PI * 2;
    const p = base(view);
    p.breath = Math.sin(ph) > 0.5 ? 1 : 0;
    p.a.s += Math.cos(ph) * 0.5;
    p.a.h += Math.sin(ph) * 0.5;
    p.sway = Math.sin(ph - 1) * 0.4;
    p.boil = 0.25;
    p.blink = f === 4;
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
    if (view === 'side') {
      p.footA = Math.round(s * 2.2);
      p.footB = -p.footA;
      p.lean = 1;
      p.sway = 1 + Math.abs(s) * 0.8;
    } else {
      p.footA = s > 0.3 ? 1 : 0;
      p.footB = s < -0.3 ? 1 : 0;
      p.sway = s * 0.7;
    }
    // The flask stays steady; the off hand swings.
    p.a = H(2.2 + s * 0.4, 3.2, -1 + p.lift * 0.4);
    p.b = H(0.6 - s * 1.6, 4.4, -3.4 + p.lift * 0.4);
    frames.push(p);
  }
  return frames;
}

interface Key {
  a?: Hand;
  b?: Hand;
  lean?: number;
  breath?: number;
  step?: number;
  flask?: 0 | 1 | 2;
  boil?: number;
}

/** An action as keyframes; anything left out stays at rest. `step` plants the front foot forward. */
function action(keys: Key[]) {
  return (view: View): Pose[] =>
    keys.map((k) => {
      const p = base(view);
      if (k.a) p.a = { ...k.a };
      if (k.b) p.b = { ...k.b };
      p.breath = k.breath ?? 0;
      p.flask = k.flask ?? 0;
      p.boil = k.boil ?? 0;
      const step = k.step ?? 0;
      if (view === 'side') {
        p.lean = k.lean ?? 0;
        p.footA = 1 + step;
        p.footB = -1 - Math.round(step * 0.5);
        p.sway = Math.max(0, (k.lean ?? 0) * 0.8);
      } else {
        p.footA = step > 0 ? 1 : 0;
        p.sway = (k.lean ?? 0) * -0.4;
      }
      return p;
    });
}

/** The lob: flask drawn back beside the hat, whipped over the shoulder and let go. */
const throwing = action([
  { a: H(-1.2, 4.4, 3), b: H(2.6, 3.0, 0.5), lean: -1, breath: 1, flask: 1, boil: 0.3 },
  { a: H(-2.8, 4.6, 6), b: H(3.2, 2.6, 1), lean: -1, breath: 1, flask: 1, boil: 0.4 },
  { a: H(2.5, 3.6, 7.5), b: H(1.6, 3.6, -0.5), lean: 1, step: 1, flask: 1, boil: 0.4 },
  { a: H(8, 2.2, 3), b: H(0.2, 4.2, -2.5), lean: 2, step: 1 },
  { a: H(6.5, 1.8, 0), b: H(0.4, 4.4, -3), lean: 1, step: 1 },
  { a: H(3.2, 2.6, -1), lean: 0 },
]);

/** The special: the great flask shaken to a boil, heaved overhead and hurled. */
const brew = action([
  { a: H(2.2, 1.6, 0.5), b: H(2.4, 1.2, -1.5), flask: 2, boil: 0.3 },
  { a: H(2.6, 1.2, 2.5), b: H(2.6, 1.0, 0.5), flask: 2, boil: 0.6, breath: 1 },
  { a: H(2.2, 2.0, 0), b: H(2.4, 1.6, -2), flask: 2, boil: 0.8 },
  { a: H(0.4, 1.8, 9.5), b: H(0.6, 1.2, 8), flask: 2, boil: 1 },
  { a: H(-1.6, 2.6, 11), b: H(-0.4, 1.8, 9), flask: 2, boil: 1, lean: -1 },
  { a: H(6.5, 1.8, 8), b: H(2, 3.6, 2), lean: 2, step: 1 },
  { a: H(7, 1.6, 3.5), b: H(0.6, 4.2, -1.5), lean: 1, step: 1 },
  { a: H(3.2, 2.6, -1), lean: 0 },
]);

// ---------------------------------------------------------------------------
// The idle moment (`rest`), facing the viewer only

/** A pose from the stand (idle frame 0) with the given changes. */
const from = (k: Partial<Pose>): Pose => ({ ...idle('down')[0], ...k });

/**
 * The plague doctor (and his witch and shaman skins): he raises the flask to
 * the light, cocks his head at it and shakes it till it boils and glows, then
 * brings it under the beak and wafts the fumes up with his other hand, two
 * sniffs, and savours it with his eyes shut before settling back.
 */
const PLAGUE_REST: Pose[] = [
  from({}),
  from({ breath: 1, a: H(2.4, 3.3, -1.5), boil: 0.3, sway: -0.1 }),
  from({ a: H(1.0, 6.4, 4.6), b: H(0.6, 4.4, -3.2), boil: 0.35, headX: -1, sway: 0.2 }),
  from({ a: H(0.8, 5.6, 10.5), b: H(0.6, 4.4, -3.0), boil: 0.5, headX: -1, sway: 0.1 }),
  from({ a: H(0.8, 6.4, 10), b: H(0.6, 4.4, -3.0), boil: 0.8, headX: -1, sway: -0.2 }),
  from({ a: H(0.8, 5.0, 11), b: H(0.6, 4.4, -3.0), boil: 1, headX: -1, sway: 0.2 }),
  from({ a: H(0.8, 5.6, 10.6), b: H(0.6, 4.4, -3.2), boil: 1, headX: -1 }),
  from({ a: H(2.0, 3.6, 4), b: H(1.4, 3.4, -1.5), boil: 0.7, sway: -0.2 }),
  from({ a: H(2.8, 1.6, 0.5), b: H(2.6, 1.0, 0.2), boil: 0.6, headY: 1, headX: -1 }),
  from({ a: H(2.8, 1.6, 0.5), b: H(2.4, 0.4, 2.4), boil: 0.7, headY: 1, headX: -1, breath: 1 }),
  from({ a: H(2.6, 2.2, 0.2), b: H(1.4, 3.2, -1.5), boil: 0.5, lift: 1, blink: true }),
  from({ a: H(2.6, 3.4, -0.4), boil: 0.35, breath: 1, sway: 0.3 }),
];

/**
 * Chemtech (and Cryotech): he lifts the canister and taps its window twice
 * with a finger, it sputters and spits a puff of vapour, he flinches, watches
 * it drift off, and gives it a satisfied nod.
 */
const CHEM_REST: Pose[] = [
  from({}),
  from({ a: H(2.4, 2.4, -2.0), b: H(1.6, 3.0, -1.8), boil: 0.25, headX: -1, headY: 1 }),
  from({ a: H(2.4, 2.0, -2.3), b: H(2.4, 1.6, 0.9), boil: 0.1, headX: -1, headY: 1 }),
  from({ a: H(2.4, 2.0, -2.6), b: H(2.4, 0.2, 0.2), boil: 0, headX: -1, headY: 1 }),
  from({ a: H(2.4, 2.2, -1.6), b: H(1.8, 2.6, 0.6), boil: 1, puff: 1, headY: -1, lift: 1 }),
  from({ a: H(2.4, 2.0, -2.0), b: H(1.4, 3.2, -1.2), boil: 0.5, puff: 2, headX: -1 }),
  from({ a: H(2.4, 2.0, -2.2), b: H(1.0, 3.8, -2.4), boil: 0.7, puff: 3, headX: -1, headY: -1 }),
  from({ a: H(2.4, 2.2, -2.4), b: H(0.8, 4.2, -3.2), boil: 0.6, headY: 1 }),
  from({ a: H(2.4, 2.2, -2.2), b: H(0.6, 4.4, -3.4), boil: 0.6 }),
  from({ a: H(2.6, 3.2, -1.2), boil: 0.4, breath: 1, sway: 0.2 }),
  from({ a: H(2.4, 2.2, -2.2), b: H(0.6, 4.4, -3.4), boil: 0.6, blink: true }),
];

/** Which of each type's poses plays at each step: the same length, so one order serves both. */
const PLAGUE_STEPS = [0, 1, 2, 3, 4, 5, 4, 5, 4, 5, 6, 6, 6, 7, 8, 9, 8, 9, 8, 10, 10, 10, 11, 0];
const CHEM_STEPS = [0, 1, 1, 2, 3, 2, 3, 3, 4, 4, 5, 6, 6, 6, 7, 8, 7, 8, 8, 10, 8, 9, 9, 0];

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

const REST_MERGE = mergeSteps([PLAGUE_STEPS, CHEM_STEPS]);

function rest(view: View): Pose[] {
  if (view !== 'down') return [];
  return S.chem ? REST_MERGE.picks[1].map((i) => CHEM_REST[i]) : REST_MERGE.picks[0].map((i) => PLAGUE_REST[i]);
}

// ---------------------------------------------------------------------------
// Frame generation

export type AlchemistAnim = 'idle' | 'walk' | 'throw' | 'brew' | 'rest';

export interface AlchemistAnimDef {
  name: AlchemistAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => Pose[];
  /** Frame indices to play in sequence, when some are held or repeated. */
  order?: readonly number[];
}

export const ALCHEMIST_ANIMS: AlchemistAnimDef[] = [
  { name: 'idle', fps: 7, loop: true, poses: idle },
  { name: 'walk', fps: 10, loop: true, poses: walk },
  { name: 'throw', fps: 18, loop: false, poses: throwing },
  { name: 'brew', fps: 12, loop: false, poses: brew },
  { name: 'rest', fps: REST_FPS, loop: false, poses: rest, order: REST_MERGE.order },
];

/** Frame index at which each throw lets go of its flask. */
export const RELEASE_FRAME = { throw: 3, brew: 5 } as const;

export interface AlchemistFrame {
  key: string; // e.g. "walk_left_3"
  anim: AlchemistAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawAlchemistFrame(dir: Dir, pose: Pose, seed: number): PixelCanvas {
  const c = new PixelCanvas(ALCH_W, ALCH_H).offset(BODY_X, BODY_Y);
  if (dir === 'down') drawDown(c, pose, seed);
  else if (dir === 'up') drawUp(c, pose, seed);
  else drawSide(c, pose, seed);
  return dir === 'right' ? c.mirrored() : c;
}

export function buildAlchemistFrames(look: AlchemistLook = PLAGUE_LOOK): AlchemistFrame[] {
  S = look;
  const out: AlchemistFrame[] = [];
  for (const a of ALCHEMIST_ANIMS) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, index) => {
        out.push({ key: `${a.name}_${dir}_${index}`, anim: a.name, dir, canvas: drawAlchemistFrame(dir, pose, index) });
      });
    }
  }
  S = PLAGUE_LOOK;
  return out;
}

// ---------------------------------------------------------------------------
// Flasks in flight

export const FLASK_FRAMES = 8;
export const FLASK_SIZE = 11;
export const BIG_FLASK_SIZE = 15;

/** A flask tumbling end over end: frame `i` of FLASK_FRAMES, turned i/FLASK_FRAMES of a circle. */
export function flaskFrame(i: number, big: boolean, look: AlchemistLook = PLAGUE_LOOK): PixelCanvas {
  if (look.chem) return canisterFrame(i, big, look);
  if (look.shaman) return gourdFrame(i, big, look);
  const S = big ? BIG_FLASK_SIZE : FLASK_SIZE;
  const c = new PixelCanvas(S, S);
  const a = (i / FLASK_FRAMES) * Math.PI * 2 - Math.PI / 2;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const r = big ? 2.9 : 2.0;
  const neck = big ? 2.2 : 1.5;
  const m = S / 2;
  // The belly sits off-centre so the whole bottle turns about its middle.
  const bx = m - ux * neck * 0.6;
  const by = m - uy * neck * 0.6;
  c.part();
  c.ellipse(bx, by, r, r, GLASS);
  c.part();
  // The liquid sloshes to the far side of the turn.
  c.ellipse(bx - ux * 0.3, by - uy * 0.3 + 0.2, r - 0.45, r - 0.5, look.brew);
  c.part();
  c.capsule(bx + ux * (r - 0.3), by + uy * (r - 0.3), bx + ux * (r + neck), by + uy * (r + neck), 0.65, 0.6, GLASS);
  c.part();
  c.ellipse(bx + ux * (r + neck + 0.9), by + uy * (r + neck + 0.9), big ? 1.1 : 0.8, big ? 1.1 : 0.8, WOOD);
  c.spark(bx, by, look.hot, big ? 0.7 : 0.5);
  if (big) {
    const cols: RGB[] = [look.hot, look.mid];
    for (let k = 0; k < 6; k++) {
      const t = (k / 6) * Math.PI * 2 + i * 0.6;
      c.spark(bx + Math.cos(t) * (r + 1.2), by + Math.sin(t) * (r + 1.2), cols[k % 2], 0.4);
    }
  }
  return c;
}

/** A chem canister tumbling end over end: steel, brass caps, a glowing band of chem round its middle. */
function canisterFrame(i: number, big: boolean, look: AlchemistLook): PixelCanvas {
  const S = big ? BIG_FLASK_SIZE : FLASK_SIZE;
  const c = new PixelCanvas(S, S);
  const a = (i / FLASK_FRAMES) * Math.PI * 2 - Math.PI / 2;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const len = big ? 3.3 : 2.4;
  const r = big ? 2.0 : 1.45;
  const m = S / 2;
  c.part();
  c.capsule(m - ux * len, m - uy * len, m + ux * len, m + uy * len, r, r, look.hat);
  c.part();
  c.capsule(m - ux * len * 0.4, m - uy * len * 0.4, m + ux * len * 0.4, m + uy * len * 0.4, r * 0.75, r * 0.75, look.brew);
  c.part();
  c.px(m + ux * (len + r * 0.6), m + uy * (len + r * 0.6), look.band, sphere(ux * 0.6, uy * 0.6 - 0.3));
  c.px(m - ux * (len + r * 0.5), m - uy * (len + r * 0.5), look.band, sphere(-ux * 0.6, -uy * 0.6 - 0.3));
  c.spark(m, m, look.hot, big ? 0.7 : 0.5);
  if (big) {
    const cols: RGB[] = [look.hot, look.mid];
    for (let k = 0; k < 6; k++) {
      const t = (k / 6) * Math.PI * 2 + i * 0.6;
      c.spark(m + Math.cos(t) * (r + 2), m + Math.sin(t) * (r + 2), cols[k % 2], 0.35);
    }
  }
  return c;
}

/** The shaman's gourd tumbling: a fat belly and a small head, its glyph glowing, a red feather in the stopper. */
function gourdFrame(i: number, big: boolean, look: AlchemistLook): PixelCanvas {
  const S = big ? BIG_FLASK_SIZE : FLASK_SIZE;
  const c = new PixelCanvas(S, S);
  const a = (i / FLASK_FRAMES) * Math.PI * 2 - Math.PI / 2;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const r = big ? 2.8 : 1.9;
  const m = S / 2;
  const bx = m - ux * r * 0.45;
  const by = m - uy * r * 0.45;
  c.part();
  c.ellipse(bx, by, r, r, GOURD);
  c.part();
  c.ellipse(bx + ux * r * 1.3, by + uy * r * 1.3, r * 0.58, r * 0.58, GOURD);
  c.part();
  c.px(bx + ux * r * 2.1, by + uy * r * 2.1, RED_FEATHER, sphere(ux * 0.5, uy * 0.5 - 0.3));
  c.part();
  c.px(bx, by, look.brew, sphere(0, 0));
  if (big) {
    c.px(bx - uy, by + ux, look.brew, sphere(0, 0));
    c.px(bx + uy, by - ux, look.brew, sphere(0, 0));
  }
  c.spark(bx, by, look.hot, big ? 0.7 : 0.5);
  if (big) {
    const cols: RGB[] = [look.hot, look.mid];
    for (let k = 0; k < 6; k++) {
      const t = (k / 6) * Math.PI * 2 + i * 0.6;
      c.spark(bx + Math.cos(t) * (r + 1.2), by + Math.sin(t) * (r + 1.2), cols[k % 2], 0.4);
    }
  }
  return c;
}
