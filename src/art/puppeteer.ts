// The puppeteer, drawn procedurally from a small rig like the bard's.
//
// The marionettist: a lanky showman in a long plum tailcoat with gold
// piping and swallowtails, a pinstriped waistcoat and an ivory cravat, white
// gloves, a tall top hat with a feather, and a white half-mask over the eyes.
// In his right hand he works a wooden control cross, glowing strings running
// down from its ends to his puppet (drawn apart, below).
//
// The stringweaver is the puppeteer's other type on the same rig: slight and
// hooded, in a long robe with wide sleeves and silver embroidery (a web
// stitched across the back), silver hair spilling from the hood and eyes
// glowing in its shadow. A cradle of shining thread runs between her
// fingers, and a spool of it hangs at her hip.
//
// Each type has skins: the marionettist's Porcelain (black and white, a
// porcelain mask with a blue tear, ice-blue strings) and Toymaker (an old
// toymaker in a green frock coat, a tricorne and an eyepatch, working a
// nutcracker soldier); the stringweaver's Red thread (a black robe lined in
// crimson, red threads of fate) and Arachne (a spider queen in black chitin,
// four spider legs arching from her back, many eyes, acid-green silk).
//
// Also here: the marionettist's puppet, a wooden knight marionette with a
// tin helm, a red plume, a painted smile and a tin sword (or a cracked
// porcelain doll in the Porcelain look), and the ability icons.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB } from './pixel';
import { BOOT, EYE, GOLD, SILVER, SKIN } from './palette';
import { iconPainter } from './effects';
import { sheet, type MonsterSheet } from './monsters';
import { DIRS, type Dir } from './wizard';

export const PUPPETEER_W = 48;
export const PUPPETEER_H = 50;
const BODY_X = 12;
const BODY_Y = 12;
/** Sprite origin in the frame: body centre, just under the feet. */
export const PUPPETEER_ORIGIN_X = BODY_X + 12;
export const PUPPETEER_ORIGIN_Y = BODY_Y + 31;

const ramp = (...c: string[]): RGB[] => c.map(hex);
const INK = hex('#120e1f');

// ---------------------------------------------------------------------------
// Looks

/** One look for the puppeteer: its texture key, its type, its cloth and the light of its strings. */
export interface PuppeteerLook {
  key: string;
  /** The stringweaver (robe, hood, thread cradle) rather than the marionettist (coat, hat, control cross). */
  weaver: boolean;
  coat: Material;
  /** Piping, buttons and clasps. */
  trim: Material;
  /** The waistcoat (marionettist) or the robe's lining (stringweaver). */
  under: Material;
  /** The waistcoat's pinstripes or harlequin diamonds. */
  stripe: Material;
  pants: Material;
  hair: Material;
  mask: Material;
  hat: Material;
  plume: Material;
  /** A painted tear under the mask's eye, if any. */
  tear?: Material;
  /** A tricorne hat instead of the top hat, an eyepatch instead of the half-mask, and a white moustache and queue. */
  toymaker?: boolean;
  /** Four spider legs arching from her back, extra eyes, and an hourglass on her back instead of the web. */
  spider?: { leg: Material; mark: Material };
  /**
   * Luna Moth: no hood but long hair with feathery antennae rising from it,
   * a moth-fur collar, and a luna moth's wings (fore and hind, the hind
   * trailing long tails) spread behind her.
   */
  moth?: MothParts;
  /** The strings' light, brightest first. */
  light: [RGB, RGB, RGB, RGB];
}

export const GLOVE: Material = { ramp: ramp('#6a6878', '#a8a6b6', '#dcdae6', '#fbfaff'), outline: hex('#1c1a24') };
export const CRAVAT: Material = { ramp: ramp('#6a6258', '#a89e8a', '#d8d0bc', '#f6f0e0'), outline: hex('#221c18') };
export const CROSS: Material = { ramp: ramp('#2e1406', '#5a2c10', '#8a4a1c', '#b87030'), outline: hex('#1a0c06') };
const PALE: Material = { ramp: ramp('#6a4a58', '#a8828e', '#dcbcc0', '#f6e2e0'), outline: hex('#2a1a22') };
const SPOOL: Material = { ramp: ramp('#2a1810', '#4a2e1c', '#6e4a2c', '#906a42'), outline: hex('#140a06') };

export const CARNIVAL_LOOK: PuppeteerLook = {
  key: 'puppeteer',
  weaver: false,
  coat: { ramp: ramp('#1e0c1e', '#3a1638', '#5a2254', '#7e3472', '#a04e90'), outline: INK, outlineLit: hex('#240c22') },
  trim: GOLD,
  under: { ramp: ramp('#100c14', '#1e1824', '#2e2638', '#40364c'), outline: INK },
  stripe: GOLD,
  pants: { ramp: ramp('#100e16', '#1e1a26', '#2e2a3a', '#423c52'), outline: INK },
  hair: { ramp: ramp('#140c10', '#2a1820', '#40262e', '#583440'), outline: hex('#0a0608') },
  mask: { ramp: ramp('#8a8698', '#c8c4d0', '#ece8f0', '#ffffff'), outline: hex('#2a2634'), shine: true },
  hat: { ramp: ramp('#0e0a12', '#1c1422', '#2e2238', '#44344e', '#5e4a6a'), outline: hex('#08060a'), shine: true },
  plume: { ramp: ramp('#4a0a12', '#7a1420', '#b8243a', '#e84a5a'), outline: hex('#24040a') },
  light: [hex('#fff8e0'), hex('#ffe08a'), hex('#ffb040'), hex('#b86a1e')],
};

export const PORCELAIN_LOOK: PuppeteerLook = {
  key: 'puppeteer_porcelain',
  weaver: false,
  coat: { ramp: ramp('#0a0a10', '#16161f', '#24242f', '#363644', '#4c4c5e'), outline: hex('#050508'), outlineLit: hex('#0c0c14') },
  trim: SILVER,
  under: { ramp: ramp('#7a7a8e', '#b4b4c8', '#dcdcec', '#f8f8ff'), outline: hex('#1c1c28') },
  stripe: { ramp: ramp('#08080c', '#12121a', '#1e1e28'), outline: hex('#050508'), noOutline: true },
  pants: { ramp: ramp('#0a0a10', '#16161f', '#24242f', '#363644'), outline: hex('#050508') },
  hair: { ramp: ramp('#6a6a80', '#9a9ab0', '#c8c8dc', '#f0f0ff'), outline: hex('#2a2a38') },
  mask: { ramp: ramp('#8e96a8', '#c8d0de', '#eef2fa', '#ffffff'), outline: hex('#28303e'), shine: true },
  hat: { ramp: ramp('#08080c', '#12121a', '#1e1e28', '#2e2e3c', '#444456'), outline: hex('#040406'), shine: true },
  plume: { ramp: ramp('#123a6a', '#1e5aa0', '#3a8ad8', '#7ac0ff'), outline: hex('#081a34') },
  tear: { ramp: ramp('#1e5aa0', '#3a8ad8', '#7ac0ff'), outline: hex('#081a34'), noOutline: true },
  light: [hex('#f2fbff'), hex('#b8ecff'), hex('#5ec8ff'), hex('#2a6ad8')],
};

export const SILK_LOOK: PuppeteerLook = {
  key: 'weaver',
  weaver: true,
  coat: { ramp: ramp('#1c0e32', '#301a54', '#4a2878', '#6a3c9e', '#8c58c0'), outline: INK, outlineLit: hex('#1a0c30') },
  trim: SILVER,
  under: { ramp: ramp('#2a1a44', '#44306a', '#6a4e96', '#9478c0'), outline: INK },
  stripe: SILVER,
  pants: { ramp: ramp('#100a1c', '#1e1430', '#2e2046', '#40305e'), outline: INK },
  hair: { ramp: ramp('#5a5a72', '#8a8aa4', '#bcbcd4', '#ececff'), outline: hex('#242434'), outlineLit: hex('#3a3a50') },
  mask: PALE,
  hat: SPOOL,
  plume: { ramp: ramp('#5a3ab0', '#a878ff', '#dcc0ff'), outline: hex('#24124e'), noOutline: true },
  light: [hex('#fbf4ff'), hex('#dcc0ff'), hex('#a878ff'), hex('#5a3ab0')],
};

export const CRIMSON_LOOK: PuppeteerLook = {
  key: 'weaver_crimson',
  weaver: true,
  coat: { ramp: ramp('#0a080c', '#16121a', '#241e2a', '#342c3c', '#463c50'), outline: hex('#050406'), outlineLit: hex('#0e0a10') },
  trim: { ramp: ramp('#3a0610', '#6a0c1c', '#9a1426', '#c8243a', '#ff5a6a'), outline: hex('#1a0206'), shine: true },
  under: { ramp: ramp('#3a0610', '#6a0c1c', '#9a1426', '#c8243a'), outline: hex('#1a0206') },
  stripe: { ramp: ramp('#6a0c1c', '#c8243a', '#ff5a6a'), outline: hex('#1a0206') },
  pants: { ramp: ramp('#0a080c', '#16121a', '#241e2a', '#342c3c'), outline: hex('#050406') },
  hair: { ramp: ramp('#0e0a10', '#1e1620', '#302432', '#443648'), outline: hex('#050406') },
  mask: PALE,
  hat: SPOOL,
  plume: { ramp: ramp('#8a0f1f', '#ff3a4a', '#ff9aa0'), outline: hex('#3a0610'), noOutline: true },
  light: [hex('#fff0f0'), hex('#ff9aa0'), hex('#ff3a4a'), hex('#8a0f1f')],
};

export const TOYMAKER_LOOK: PuppeteerLook = {
  key: 'puppeteer_toymaker',
  weaver: false,
  coat: { ramp: ramp('#0a1a10', '#143020', '#1e4a30', '#2c6a44', '#428e5c'), outline: hex('#06100a'), outlineLit: hex('#0a1a10') },
  trim: GOLD,
  under: { ramp: ramp('#3a0a10', '#6a1420', '#a02230', '#d04048'), outline: hex('#1a0408') },
  stripe: { ramp: ramp('#4a0a14', '#7a1422'), outline: hex('#1a0408'), noOutline: true },
  pants: { ramp: ramp('#140e0a', '#241a14', '#3a2a20', '#523c2e'), outline: hex('#0a0604') },
  hair: { ramp: ramp('#6a6878', '#a8a6b6', '#dcdae6', '#fbfaff'), outline: hex('#2a2834') },
  mask: { ramp: ramp('#050408', '#100c14', '#1e1824'), outline: hex('#050408') },
  hat: { ramp: ramp('#0a0806', '#16120e', '#241e18', '#342c24', '#4a3e32'), outline: hex('#050403'), shine: true },
  plume: { ramp: ramp('#4a0a12', '#7a1420', '#b8243a', '#e84a5a'), outline: hex('#24040a') },
  light: [hex('#fffaf0'), hex('#ffd890'), hex('#ff5a4a'), hex('#9a1a28')],
  toymaker: true,
};

export const ARACHNE_LOOK: PuppeteerLook = {
  key: 'weaver_arachne',
  weaver: true,
  coat: { ramp: ramp('#08070a', '#141118', '#221c26', '#322a38', '#463c4e'), outline: hex('#030204'), outlineLit: hex('#0c0a10') },
  trim: { ramp: ramp('#1a2a06', '#3e6a10', '#6aa81e', '#a8e040', '#e0ff8a'), outline: hex('#0a1402'), shine: true },
  under: { ramp: ramp('#0a1a0a', '#14301a', '#1e4a28', '#2c6a38'), outline: hex('#040a04') },
  stripe: { ramp: ramp('#4a7a10', '#a8e040', '#e0ff9a'), outline: hex('#0a1402') },
  pants: { ramp: ramp('#08070a', '#141118', '#221c26', '#322a38'), outline: hex('#030204') },
  hair: { ramp: ramp('#5a5448', '#8e8672', '#c0b89c', '#ece4c8'), outline: hex('#1e1a14') },
  mask: PALE,
  hat: SPOOL,
  plume: { ramp: ramp('#4a7a10', '#a8e040', '#e0ff9a'), outline: hex('#1a2a06'), noOutline: true },
  light: [hex('#fbffe8'), hex('#e0ff9a'), hex('#a8e040'), hex('#4a7a10')],
  spider: {
    leg: { ramp: ramp('#060508', '#141018', '#2a2230', '#44384e', '#5e5070'), outline: hex('#020203'), shine: true },
    mark: { ramp: ramp('#6a0a10', '#c81e28', '#ff4a4a'), outline: hex('#2a0206'), emissive: 0.4 },
  },
};

/** The luna moth's own materials: its wings, their edges and eyes, her collar, antennae and lips. */
export interface MothParts {
  wing: Material;
  /** The wings' leading edge, a thin dusky mauve line as on a real luna moth. */
  costa: Material;
  /** The wings' outer margin, glowing softly. */
  edge: Material;
  /** The eye spots on all four wings. */
  eye: Material;
  fur: Material;
  feeler: Material;
  lip: Material;
}

/**
 * Luna Moth, the stringweaver's skin: a moth-woman of the moonlit woods. A
 * cream silk gown open over a mint underskirt, a collar of white moth fur,
 * long silvery-white hair with two feathery antennae rising from it, and
 * pale mint wings behind her, eye-spotted, edged in a soft glow, the hind
 * pair trailing long tails to her heels. Her silk shines moonlit green.
 */
export const LUNA_LOOK: PuppeteerLook = {
  key: 'weaver_luna',
  weaver: true,
  coat: { ramp: ramp('#5e5844', '#948c70', '#c4bc9e', '#e6e0c8', '#faf6e8'), outline: hex('#26221a'), outlineLit: hex('#3a3628') },
  trim: { ramp: ramp('#56646a', '#8ea0a4', '#c4d4d4', '#ecf8f4', '#ffffff'), outline: hex('#1c2428'), shine: true },
  under: { ramp: ramp('#3e6a58', '#6aa088', '#9cceb4', '#c8ecd8'), outline: hex('#183028') },
  stripe: { ramp: ramp('#5ab088', '#a8ecc8', '#e8fff2'), outline: hex('#183028'), emissive: 0.5, noAO: true },
  pants: { ramp: ramp('#5e5844', '#948c70', '#c4bc9e', '#e6e0c8'), outline: hex('#26221a') },
  hair: { ramp: ramp('#6a7484', '#a0aabb', '#ccd4e0', '#eef2f8', '#ffffff'), outline: hex('#283040'), outlineLit: hex('#3c4454'), shine: true },
  mask: PALE,
  hat: { ramp: ramp('#7a6e58', '#b0a488', '#dcd2b8', '#f6f0de'), outline: hex('#2a2418') },
  plume: { ramp: ramp('#3e8a78', '#8ee0b8', '#e8fff2'), outline: hex('#183028'), noOutline: true },
  light: [hex('#f6fff8'), hex('#c8f5dc'), hex('#8ee0b8'), hex('#3e8a78')],
  moth: {
    wing: { ramp: ramp('#3e7462', '#64a48a', '#90cead', '#bce8cc', '#e0faea'), outline: hex('#1a3a30'), outlineLit: hex('#2c5446'), emissive: 0.08 },
    costa: { ramp: ramp('#4a2a44', '#74466a', '#a06a8e'), outline: hex('#24121e') },
    edge: { ramp: ramp('#7ccca6', '#a8e8c8', '#d0f6e2'), outline: hex('#1a3a30'), emissive: 0.45, noAO: true },
    eye: { ramp: ramp('#8a5a20', '#d09a40', '#f6d878'), outline: hex('#3a2410'), emissive: 0.3, noAO: true },
    fur: { ramp: ramp('#8a8678', '#c0bcac', '#e6e2d6', '#fbfaf4', '#ffffff'), outline: hex('#2e2c24'), outlineLit: hex('#444034') },
    feeler: { ramp: ramp('#8a7a50', '#b8a470', '#e0d09c', '#f8eec8'), outline: hex('#2a2010'), emissive: 0.2, noOutline: true },
    lip: { ramp: ramp('#a8586a', '#d07e8c'), outline: hex('#5a2430'), noOutline: true, noAO: true },
  },
};

export const PUPPETEER_LOOKS = [CARNIVAL_LOOK, PORCELAIN_LOOK, SILK_LOOK, CRIMSON_LOOK, TOYMAKER_LOOK, ARACHNE_LOOK, LUNA_LOOK];

/** The look being drawn; set by buildPuppeteerFrames. */
let S: PuppeteerLook = CARNIVAL_LOOK;

// ---------------------------------------------------------------------------
// The rig

/** A hand, in the puppeteer's terms: `f` forward, `s` out to its own side, `h` up from the chest. */
export interface Hand {
  f: number;
  s: number;
  h: number;
}

const H = (f: number, s: number, h: number): Hand => ({ f, s, h });

export interface Pose {
  lift: number;
  breath: number;
  footA: number;
  footB: number;
  lean: number;
  /** The working hand (the control cross, or the thread-casting hand) and the other. */
  a: Hand;
  b: Hand;
  /** The control cross tipped towards the aim, in radians. */
  tilt: number;
  /** 0..1: the strings or the threads lit. */
  glow: number;
  /** The thread cradle between her hands, 0..1 (the weaver). */
  cradle: number;
  /** The coat's tails or the robe swinging, in pixels. */
  sway: number;
  tick: number;
  blink?: boolean;
  /** The little dancer hanging from the free hand's fingers (the marionettist's idle moment). */
  mini?: Mini;
  /** The cat's cradle strung between her hands (the weaver's idle moment). */
  figure?: Figure;
}

/**
 * The marionettist's pocket dancer, a doll a few pixels tall on three
 * threads. Arms: -1 hanging, 0 out, 1 up. `kick` swings one leg out to that
 * side; `limp` lets it dangle, head lolled, as it first comes out.
 */
interface Mini {
  hop?: number;
  armL?: number;
  armR?: number;
  kick?: number;
  bow?: boolean;
  limp?: boolean;
}

/** The cat's cradle: `shape` 0 the plain cradle, 1 the diamond, 2 the eye; or `snap` 1..2, the threads broken and flying. */
interface Figure {
  shape: number;
  k: number;
  snap?: number;
  /** A finger picking a strand at the middle. */
  pick?: boolean;
}

type View = 'down' | 'up' | 'side';

/** The chest row in body coordinates, the height hands are posed from. */
const CH = 18;

interface Placed {
  x: number;
  y: number;
  behind: boolean;
}

function place(view: View, arm: 'a' | 'b', q: Hand, U: number, hx: number): Placed {
  const side = arm === 'a' ? -1 : 1;
  if (view === 'down') return { x: 12 + side * q.s, y: CH + U - q.h + q.f * 0.7, behind: q.f < -1 };
  if (view === 'up') return { x: 12 + side * q.s, y: CH + U - q.h - q.f * 0.8, behind: q.f > 1 };
  // Facing left: `a` works out in front; `b` is the far arm, a touch higher.
  const far = arm === 'b';
  return { x: hx - 1 - q.f * 1.05 + (far ? 0.8 : 0), y: CH + U - q.h + (far ? -0.6 : 0.3), behind: far && q.f < 1 };
}

function elbow(sx: number, sy: number, fx: number, fy: number, reach: number, hint: [number, number]): [number, number] {
  const dx = fx - sx;
  const dy = fy - sy;
  const d = Math.hypot(dx, dy) || 0.01;
  let ex = sx + dx / 2;
  let ey = sy + dy / 2;
  if (d < reach * 2) {
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
  return [ex, ey];
}

/** A little light: a cross of it, the arms growing with `k`. */
function glowAt(c: PixelCanvas, x: number, y: number, k: number): void {
  if (k <= 0) return;
  const [core, hot, mid] = S.light;
  c.spark(x, y, core, k);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.spark(x + dx, y + dy, hot, 0.6 * k);
  if (k > 0.6) for (const [dx, dy] of [[2, 0], [-2, 0], [0, -2], [0, 2]]) c.spark(x + dx, y + dy, mid, 0.35 * k);
}

/** A thin line of light. */
function thread(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, a: number, col = S.light[1]): void {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) c.spark(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), col, a);
}

/**
 * An arm: the coat's sleeve (or the robe's wide one) to the elbow and wrist,
 * then a white-gloved hand with a lace cuff, or a pale bare one.
 */
function arm(c: PixelCanvas, sx: number, sy: number, p: Placed, reach: number, hint: [number, number], bias = 0): void {
  const [ex, ey] = elbow(sx, sy, p.x, p.y, reach, hint);
  const wx = ex + (p.x - ex) * 0.78;
  const wy = ey + (p.y - ey) * 0.78;
  c.part();
  c.capsule(sx, sy, ex, ey, 1.8, 1.5, S.coat, { bias });
  c.part();
  if (S.weaver) {
    // The sleeve flares wide at the wrist, its lining showing.
    c.capsule(ex, ey, wx, wy, 1.5, 2.1, S.coat, { bias });
    c.part();
    c.px(wx, wy + 1, S.under, sphere(0, 0.4), { bias });
    c.px(wx + 1, wy + 1, S.trim, sphere(0.3, 0.4), { bias });
    c.part();
    c.ellipse(p.x, p.y, 1.1, 1.1, PALE, { bias });
  } else {
    c.capsule(ex, ey, wx, wy, 1.4, 1.3, S.coat, { bias });
    c.part();
    c.px(wx, wy, S.trim, sphere(0, -0.2), { bias });
    c.part();
    c.ellipse(wx + (p.x - wx) * 0.4, wy + (p.y - wy) * 0.4, 1.3, 1.1, CRAVAT, { bias });
    c.part();
    c.ellipse(p.x, p.y, 1.2, 1.15, GLOVE, { bias });
  }
}

/**
 * The control cross in the hand: a wooden bar with gold caps and a shorter
 * one across it, tipped by `tilt`, the strings' first few pixels dangling
 * from its ends and glowing. Returns nothing; the world draws the rest of the
 * strings down to the puppet from the hand.
 */
function controlCross(c: PixelCanvas, view: View, x: number, y: number, tilt: number, glow: number, bias = 0): void {
  const cs = Math.cos(tilt);
  const sn = Math.sin(tilt);
  const half = view === 'side' ? 2.6 : 4;
  // The main bar, across the view.
  const ax = x - cs * half;
  const ay = y - 1.4 - sn * half * 0.6;
  const bx = x + cs * half;
  const by = y - 1.4 + sn * half * 0.6;
  c.part();
  c.line(ax, ay, bx, by, CROSS, () => sphere(0, -0.5), { bias });
  c.line(ax, ay + 1, bx, by + 1, CROSS, () => sphere(0, 0.4), { bias: bias - 1 });
  c.part();
  c.px(ax, ay, S.trim, sphere(-0.4, -0.4), { bias });
  c.px(bx, by, S.trim, sphere(0.4, -0.4), { bias });
  // The short bar, running towards and away from the viewer.
  c.part();
  c.line(x, y - 3.2, x, y + 0.6, CROSS, () => sphere(0.3, -0.2), { bias });
  c.px(x, y - 3.4, S.trim, sphere(0, -0.6), { bias });
  // Strings dropping from the ends.
  const k = 0.45 + 0.55 * glow;
  const [core, hot, mid] = S.light;
  for (const [sx, sy] of [[ax, ay + 1], [bx, by + 1], [x, y + 1.4]] as const) {
    c.spark(sx, sy + 1, core, k);
    c.spark(sx, sy + 2, hot, k * 0.8);
    c.spark(sx, sy + 3, mid, k * 0.5);
  }
  if (glow > 0.5) glowAt(c, x, y - 1.4, (glow - 0.5) * 1.4);
}

/** The thread cradle: three shining strands crossing between the hands. */
function cradle(c: PixelCanvas, fa: Placed, fb: Placed, k: number, tick: number): void {
  if (k <= 0) return;
  const [core, hot, mid] = S.light;
  const wob = [0, 0.5, 0, -0.5][tick % 4];
  thread(c, fa.x, fa.y - 0.6, fb.x, fb.y + 0.6 + wob, 0.8 * k, hot);
  thread(c, fa.x, fa.y + 0.6, fb.x, fb.y - 0.6 - wob, 0.7 * k, mid);
  const mx = (fa.x + fb.x) / 2;
  const my = (fa.y + fb.y) / 2;
  c.spark(mx, my, core, k);
}

function legs(c: PixelCanvas, view: View, L: number, p: Pose): void {
  const lift = (f: number) => Math.max(0, f) * 0.35;
  const shoe = (x: number, y: number, side: boolean, bias = 0) => {
    c.part();
    c.ellipse(x, y, side ? 2.1 : 1.5, 1.15, BOOT, { flatten: 0.8, bias });
    if (!S.weaver) {
      c.part();
      c.px(side ? x - 1 : x, y - 1, S.trim, sphere(0, -0.5), { bias });
    }
  };
  const leg = (hx: number, hy: number, fx: number, fy: number, bias = 0) => {
    c.part();
    c.capsule(hx, hy, fx, fy, 1.45, 1.15, S.pants, { bias });
  };
  if (view === 'side') {
    const cx = 12;
    leg(cx + 0.8, 24.5 + L, cx + 1 - p.footB, 28.4 - lift(p.footB), -1);
    shoe(cx + 0.4 - p.footB, 29.7 - lift(p.footB), true, -1);
    leg(cx - 0.6, 24.5 + L, cx - 0.4 - p.footA, 28.4 - lift(p.footA));
    shoe(cx - 1.2 - p.footA, 29.7 - lift(p.footA), true);
    return;
  }
  const [fa, fb] = view === 'down' ? [p.footA, p.footB] : [p.footB, p.footA];
  leg(10.4, 24.5 + L, 10.2, 28.4 - fa);
  leg(13.6, 24.5 + L, 13.8, 28.4 - fb);
  shoe(10.2, 29.6 - fa, false);
  shoe(13.8, 29.6 - fb, false);
}

function eyes(c: PixelCanvas, pts: [number, number][], blink: boolean | undefined, glow = false): void {
  c.part();
  for (const [x, y] of pts) {
    if (blink) c.px(x, y, glow ? S.hair : SKIN, sphere(0, -0.3), { bias: -1 });
    else {
      c.px(x, y, EYE);
      if (glow) {
        c.spark(x, y, S.light[0], 0.95);
        c.spark(x + 0.5, y, S.light[2], 0.3);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Heads

/** The showman's head from the front: face, half-mask, dark hair, top hat and feather. */
function showmanHead(c: PixelCanvas, cx: number, U: number, p: Pose, back: boolean): void {
  c.part();
  c.ellipse(cx, 12.3 + U, 3.2, 3.0, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8, 1) });
  if (!back) {
    c.part();
    c.ellipse(cx - 0.1, 12.9 + U, 2.6, 2.5, SKIN);
    if (S.toymaker) {
      toymakerFace(c, cx, U, p);
      topHat(c, cx, U, p.tick, 'front');
      return;
    }
    // The half-mask: a white band over the eyes, peaked at the brow.
    c.part();
    c.shape(Math.round(11 + U), Math.round(12 + U), () => [cx - 3.1, cx + 3.1], S.mask, (_x, _y, t, u) => sphere(t * 0.9, u * 0.8 - 0.4, 1));
    c.px(cx - 3, 13 + U, S.mask, sphere(-0.7, 0.4));
    c.px(cx + 2, 13 + U, S.mask, sphere(0.7, 0.4));
    eyes(c, [[cx - 2, 12 + U], [cx + 1, 12 + U]], p.blink);
    if (S.tear) {
      c.part();
      c.px(cx - 2, 13 + U, S.tear, sphere(0, 0.2));
    } else {
      c.part();
      c.px(cx - 3, 11 + U, S.trim, sphere(-0.5, -0.4));
      c.px(cx + 2, 11 + U, S.trim, sphere(0.5, -0.4));
    }
    // A thin, knowing smile.
    c.shade(cx - 1, 14 + U, -1);
    c.shade(cx, 14 + U, -1);
    c.shade(cx + 1, 14 + U, -2);
  } else if (S.toymaker) {
    // The queue: white hair tied back with a red ribbon.
    c.part();
    c.capsule(cx, 13 + U, cx + 0.3, 17 + U, 1.1, 0.6, S.hair);
    c.part();
    c.px(cx - 1, 14 + U, S.plume, sphere(-0.4, 0));
    c.px(cx, 14 + U, S.plume, sphere(0.4, 0));
  }
  topHat(c, cx, U, p.tick, 'front');
}

/** The toymaker's face from the front: an eyepatch on its strap, one bright eye, bushy white brows and moustache. */
function toymakerFace(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  eyes(c, [[cx + 1, 12 + U]], p.blink);
  c.part();
  c.px(cx - 3, 12 + U, S.mask, sphere(-0.4, 0));
  c.px(cx - 2, 12 + U, S.mask, sphere(0.2, 0));
  c.px(cx - 2, 13 + U, S.mask, sphere(0, 0.5), { bias: -1 });
  for (let x = cx - 1; x <= cx + 2; x++) c.px(x, 11 + U - (x > cx ? 0 : 0), S.mask, sphere(0, -0.3), { bias: -1 });
  c.part();
  c.px(cx + 1, 11 + U, S.hair, sphere(0, -0.6));
  c.px(cx + 2, 11 + U, S.hair, sphere(0.4, -0.6));
  // A white moustache, curled at the ends.
  c.part();
  for (let x = cx - 2; x <= cx + 1; x++) c.px(x, 14 + U, S.hair, sphere((x - cx + 0.5) * 0.4, 0.2));
  c.px(cx - 3, 13 + U, S.hair, sphere(-0.6, -0.3));
  c.px(cx + 2, 13 + U, S.hair, sphere(0.6, -0.3));
}

/**
 * A black tricorne: a low crown and a brim turned up on three sides, gold
 * lace along its edge, one corner pointing forward and a red cockade.
 */
function tricorne(c: PixelCanvas, cx: number, U: number, view: 'front' | 'side'): void {
  c.part();
  c.shape(Math.round(5 + U), Math.round(8 + U), () => [cx - 2.6, cx + 2.6], S.hat, (_x, _y, t) => cyl(t, 0.1));
  c.part();
  if (view === 'front') {
    const rows: [number, number][][] = [
      [[-4.9, -3.1], [3.1, 4.9]],
      [[-5.1, 5.1]],
      [[-4.5, 4.5]],
      [[-2.3, 2.3]],
    ];
    rows.forEach((segs, i) => {
      const y = Math.round(7 + U) + i;
      for (const [l, r] of segs) c.shape(y, y, () => [cx + l, cx + r], S.hat, (_x, _y, t) => sphere(t * 0.9, -0.4 + i * 0.3, 1));
    });
    c.part();
    for (const [x, y] of [[-5, 1], [-4, 0], [4, 0], [4, 1], [-4, 2], [3, 2], [-2, 3], [-1, 3], [0, 3], [1, 3]]) c.px(cx + x, Math.round(7 + U) + y, S.trim, sphere(x * 0.1, 0.3));
    c.part();
    c.px(cx - 3, Math.round(8 + U), S.plume, sphere(-0.3, -0.3));
    c.px(cx - 2, Math.round(8 + U), S.plume, sphere(0.2, -0.3));
    return;
  }
  // In profile: the front corner jutting forward, the back one up behind.
  const rows: [number, number][][] = [
    [[-4.9, -3.3], [3.1, 4.7]],
    [[-5.0, 4.8]],
    [[-4.2, 2.6]],
  ];
  rows.forEach((segs, i) => {
    const y = Math.round(7 + U) + i;
    for (const [l, r] of segs) c.shape(y, y, () => [cx + l, cx + r], S.hat, (_x, _y, t) => sphere(t * 0.9 - 0.2, -0.4 + i * 0.3, 1));
  });
  c.part();
  for (const [x, y] of [[-5, 1], [-5, 0], [4, 0], [4, 1], [-4, 2], [-3, 2], [2, 2]]) c.px(cx + x, Math.round(7 + U) + y, S.trim, sphere(x * 0.1, 0.3));
  c.part();
  c.px(cx + 1, Math.round(7 + U), S.plume, sphere(0.3, -0.3));
}

/** A tall top hat: a wide brim, the crown, a band and a feather tucked into it. */
function topHat(c: PixelCanvas, cx: number, U: number, t: number, view: 'front' | 'side'): void {
  if (S.toymaker) {
    tricorne(c, cx, U, view);
    return;
  }
  const side = view === 'side';
  c.part();
  c.ellipse(cx + (side ? 0.3 : 0), 9.6 + U, side ? 4.4 : 4.7, 1.3, S.hat, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.4 - 0.7, 1) });
  for (let x = cx - 2; x <= cx + 2; x++) c.shade(x, 10.6 + U, -1);
  c.part();
  const top = Math.round(3.4 + U);
  const bot = Math.round(9 + U);
  c.shape(top, bot, (y) => {
    const flare = y === top ? 0.2 : 0;
    const hw = (side ? 2.5 : 2.8) + flare;
    return [cx - hw, cx + hw];
  }, S.hat, (_x, _y, tt) => cyl(tt, 0.1));
  c.part();
  c.shape(bot - 1, bot - 1, () => [cx - (side ? 2.5 : 2.8), cx + (side ? 2.5 : 2.8)], S.trim, (_x, _y, tt) => cyl(tt, 0.3));
  // The feather sweeps up and back from the band.
  const flick = [0, 0.4, 0.6, 0.3, 0, -0.2][t % 6];
  c.part();
  for (let i = 0; i <= 8; i++) {
    const k = i / 8;
    const x = cx + 2.4 + k * 3.2;
    const y = bot - 1.5 - k * 5.4 + k * k * 1.6 + (k > 0.6 ? flick : 0);
    c.px(x, y, S.plume, sphere(0.3, -0.5 + k), { bias: k > 0.8 ? -1 : 0 });
    if (k < 0.75) c.px(x + 1, y, S.plume, sphere(0.6, 0.3), { bias: -1 });
  }
}

/** The weaver's hooded head from the front: silver hair spilling out, eyes glowing in the hood's shadow. */
function hoodDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  c.part();
  c.ellipse(cx, 12 + U, 4.3, 4.3, S.coat, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  // The hood's point, drooping to one side.
  c.part();
  c.capsule(cx + 0.5, 8.4 + U, cx + 2.4, 7.2 + U, 1.4, 0.6, S.coat);
  c.part();
  c.ellipse(cx, 13 + U, 2.8, 2.7, S.under, { normal: () => sphere(0, 0.4, 1), bias: -2 });
  c.part();
  c.ellipse(cx, 13.4 + U, 2.2, 2.2, PALE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.6 + 0.2, 1), bias: -1 });
  // Silver hair framing the face and falling past the hood.
  c.part();
  c.shape(Math.round(11 + U), Math.round(11 + U), () => [cx - 2.6, cx + 2.6], S.hair, (_x, _y, t) => sphere(t * 0.8, -0.4, 1));
  c.capsule(cx - 2.6, 12 + U, cx - 3.0, 17.6 + U, 0.9, 0.7, S.hair);
  c.capsule(cx + 2.6, 12 + U, cx + 3.0, 17.6 + U, 0.9, 0.7, S.hair);
  eyes(c, S.spider ? [[cx - 1, 13 + U], [cx + 1, 13 + U], [cx - 2, 12 + U], [cx + 2, 12 + U]] : [[cx - 1, 13 + U], [cx + 1, 13 + U]], p.blink, true);
  // The hood's rim, stitched in silver.
  c.part();
  for (const [x, y] of [[cx - 3, 10], [cx - 1, 9], [cx + 1, 9], [cx + 2, 10]]) c.px(x, y + U, S.trim, sphere(0, -0.5));
}

/**
 * Arachne's spider legs: two jointed pairs arching up from her back and down
 * to sharp points, twitching with `tick`. `side` draws one side's pair (-1
 * left, 1 right); `far` draws them a touch behind and darker.
 */
function spiderLegs(c: PixelCanvas, x0: number, y0: number, side: number, tick: number, bias = 0): void {
  if (!S.spider) return;
  const L = S.spider.leg;
  const tw = [0, -0.5, 0, 0.5][tick % 4];
  const pairs: [number, number, number, number][] = [
    [5.2, -9.6 + tw, 8.6, -3.4],
    [8.0, -3.4 - tw, 10.2, 4.8],
  ];
  c.part();
  for (const [kx, ky, tx, ty] of pairs) {
    const ex = x0 + side * kx;
    const ey = y0 + ky;
    c.capsule(x0 + side * 1.2, y0, ex, ey, 0.9, 0.75, L, { bias });
    c.capsule(ex, ey, x0 + side * tx, y0 + ty, 0.75, 0.35, L, { bias });
  }
  c.part();
  for (const [kx, ky] of pairs) c.px(x0 + side * kx, y0 + ky, S.trim, sphere(side * 0.4, -0.5), { bias });
}

// ---------------------------------------------------------------------------
// Luna Moth: wings, head and collar

/** Luna's skin: moonlit, paler and cooler than the hooded weavers' in their shadow. */
const FAIR: Material = { ramp: ramp('#8a6e74', '#c4a4a6', '#ecd4cc', '#fcece4'), outline: hex('#3a2228') };

/** Is (x, y) inside the polygon (even-odd)? */
function inPoly(pts: [number, number][], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * The luna moth's wings, one side's pair, in the wing's own frame: x out from
 * the root along the body's side, y down. The forewing sweeps up and out to a
 * blunt point; the hindwing rounds below it and runs into a long tail, which
 * curls in at its end.
 */
const FOREWING: [number, number][] = [[0, 0], [2.4, -4.6], [6.4, -8.2], [11.4, -9.8], [12.4, -7.6], [10.8, -3.6], [7.2, -0.4], [3, 1.4]];
const HINDWING: [number, number][] = [[0, 1], [4.4, 0.2], [8.4, 1.6], [9.2, 4.2], [7.6, 6.8], [5.2, 7.4], [1.8, 4.8]];
const TAIL: [number, number][] = [[6.2, 6], [7.6, 9.4], [8.2, 12], [7.2, 14.4]];
/** How far from the root the margin starts to glow. */
const EDGE_FROM = 6.5;

/** How open her wings are this frame: a slow breathing flutter, folding a little as she rises. */
const flapOf = (p: Pose): number => 0.88 + 0.12 * Math.cos(p.tick * 1.05) - p.lift * 0.08;

/**
 * One side's wings (`s` -1 left, 1 right) from the root (rx, ry), squeezed
 * across by `kx` (narrower seen from the side), opened by `flap`: closing,
 * they narrow and their tips rise. Mint, with a mauve leading edge, an eye
 * spot on each wing, veins running out from the root, and a margin of soft
 * light all round the outside.
 */
function mothWing(c: PixelCanvas, rx: number, ry: number, s: number, kx: number, flap: number, bias = 0): void {
  const M = S.moth;
  if (!M) return;
  const at = (q: readonly [number, number]): [number, number] => [rx + s * q[0] * kx * flap, ry + q[1] - (1 - flap) * q[0] * 0.55];
  const fore = FOREWING.map(at);
  const hind = HINDWING.map(at);
  const inFore = (x: number, y: number) => inPoly(fore, x + 0.5, y + 0.5);
  const inHind = (x: number, y: number) => inPoly(hind, x + 0.5, y + 0.5);
  const xs = [...fore, ...hind].map((q) => q[0]);
  const ys = [...fore, ...hind].map((q) => q[1]);
  const x0 = Math.floor(Math.min(...xs));
  const x1 = Math.ceil(Math.max(...xs));
  const y0 = Math.floor(Math.min(...ys));
  const y1 = Math.ceil(Math.max(...ys));
  const reach = (x: number, y: number) => Math.hypot((x + 0.5 - rx) / kx, y + 0.5 - ry);
  // A gentle cup: each wing bulges towards the viewer about its middle.
  const [fx, fy] = at([6.4, -4.4]);
  const [hx, hy] = at([5.2, 3.6]);
  const fill = (inside: (x: number, y: number) => boolean, mx: number, my: number, r: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (inside(x, y)) c.px(x, y, M.wing, sphere(((x + 0.5 - mx) / r) * 0.55, ((y + 0.5 - my) / r) * 0.55), { bias });
    }
  };
  c.part();
  fill(inHind, hx, hy, 5);
  // The tail: tapering, then swelling a little to a curled paddle at its end.
  const tail = TAIL.map(at);
  for (let i = 1; i < tail.length; i++) c.capsule(tail[i - 1][0], tail[i - 1][1], tail[i][0], tail[i][1], 1.4 - i * 0.25, 1.15 - i * 0.2, M.wing, { bias });
  const [tx, ty] = tail[tail.length - 1];
  c.ellipse(tx, ty, 1.1, 1.2, M.wing, { bias });
  c.part();
  fill(inFore, fx, fy, 6);
  // The margins: mauve along the forewing's leading edge, soft light round the outside.
  c.part();
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const f = inFore(x, y);
    const h = !f && inHind(x, y);
    if (!f && !h) continue;
    const open = (qx: number, qy: number) => !inFore(qx, qy) && !inHind(qx, qy);
    if (f && !inFore(x, y - 1) && reach(x, y) > 2 && reach(x, y) < 11.5) c.px(x, y, M.costa, sphere(0, -0.6), { bias });
    else if (reach(x, y) > EDGE_FROM && (open(x + s, y) || open(x, y + 1) || (f && open(x, y - 1)))) c.px(x, y, M.edge, sphere(s * 0.4, 0.2), { bias });
  }
  // The tail's tip glows too.
  c.px(tx + s * 0.6, ty + 0.6, M.edge, sphere(s * 0.4, 0.4), { bias });
  // Veins out from the root.
  for (const q of [[9.6, -6.6], [9.6, -2.6], [7.6, 3.4]] as const) {
    const [vx, vy] = at(q);
    const n = 8;
    for (let i = 2; i < n; i++) c.shade(rx + ((vx - rx) * i) / n, ry + ((vy - ry) * i) / n, -1);
  }
  // Eye spots: a ringed one on the forewing, a smaller one on the hind.
  c.part();
  const [ex, ey] = at([6.6, -4.8]);
  c.px(ex, ey, M.eye, sphere(0, -0.3), { bias });
  c.px(ex - s, ey, M.costa, sphere(0, 0), { bias });
  c.px(ex, ey + 1, M.eye, sphere(0, 0.4), { bias: bias - 1 });
  const [gx, gy] = at([5.4, 3.4]);
  c.px(gx, gy, M.eye, sphere(0, 0), { bias });
  c.spark(ex, ey, S.light[1], 0.35);
}

/** Both wings spread behind (or, from behind, over) her back. */
function mothWings(c: PixelCanvas, cx: number, ry: number, flap: number, bias = 0): void {
  mothWing(c, cx - 1.5, ry, -1, 1, flap, bias);
  mothWing(c, cx + 1.5, ry, 1, 1, flap, bias);
}

/**
 * A feathery antenna rising from (x0, y0) and arching out to its side `s`,
 * swaying with `tick`: a fine shaft, short barbs combed off its outer side,
 * and a glint of light at its tip.
 */
function feeler(c: PixelCanvas, x0: number, y0: number, s: number, tick: number, lean = 0, bias = 0): void {
  const M = S.moth;
  if (!M) return;
  const sway = [0, 0.4, 0.6, 0.4, 0, -0.3][tick % 6];
  const pts: [number, number][] = [];
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    // Up from the crown, then arching out and over at the tip.
    pts.push([x0 + s * (u * 1.2 + u * u * 3.2) + lean * u + sway * u * u * s, y0 - u * 5.6 + u * u * 1.6]);
  }
  c.part();
  let last = '';
  for (const [x, y] of pts) {
    const k = `${Math.floor(x)},${Math.floor(y)}`;
    if (k === last) continue;
    last = k;
    c.px(x, y, M.feeler, sphere(s * 0.3, -0.4), { bias });
  }
  // The feathering: a faint fringe of light along the outer half.
  for (let i = 3; i < n; i += 2) c.spark(pts[i][0] + s, pts[i][1] + 1, S.light[2], 0.4);
  const [tx, ty] = pts[n];
  c.spark(tx, ty, S.light[1], 0.7);
}

/** Her head from the front: a soft face framed by long silver-white hair, the antennae rising from it. */
function mothHeadDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const M = S.moth!;
  // The hair behind her head, and the long locks falling past her shoulders.
  c.part();
  c.ellipse(cx, 12 + U, 3.7, 3.8, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  c.part();
  c.capsule(cx - 3.0, 12.4 + U, cx - 3.6 + p.sway * 0.2, 19.6 + U, 1.4, 1.0, S.hair);
  c.capsule(cx + 3.0, 12.4 + U, cx + 3.6 + p.sway * 0.2, 19.6 + U, 1.4, 1.0, S.hair);
  c.shade(cx - 4, 17 + U, -1);
  c.shade(cx + 3, 17 + U, -1);
  // The face.
  c.part();
  c.ellipse(cx, 13.2 + U, 2.5, 2.6, FAIR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.6 + 0.1, 1) });
  // A side-swept fringe, parted off the middle.
  c.part();
  c.shape(Math.round(10 + U), Math.round(11 + U), () => [cx - 2.8, cx + 2.8], S.hair, (_x, _y, t, u) => sphere(t * 0.8, u * 0.5 - 0.5, 1));
  c.px(cx - 3, 12 + U, S.hair, sphere(-0.6, 0));
  c.px(cx + 2, 12 + U, S.hair, sphere(0.6, 0));
  c.erase(cx - 1, 11 + U);
  c.px(cx - 1, 11 + U, FAIR, sphere(0, -0.3));
  c.shade(cx + 1, 11 + U, 1);
  eyes(c, [[cx - 2, 13 + U], [cx + 1, 13 + U]], p.blink);
  if (!p.blink) {
    c.spark(cx - 2, 13 + U, S.light[2], 0.25);
    c.spark(cx + 1, 13 + U, S.light[2], 0.25);
  }
  // Rose lips, a touch of blush.
  c.part();
  c.px(cx - 1, 15 + U, M.lip, sphere(0, 0.3));
  // The antennae, rising from the crown.
  feeler(c, cx - 1.6, 8.6 + U, -1, p.tick);
  feeler(c, cx + 0.6, 8.6 + U, 1, p.tick + 3);
}

/**
 * The gown's embroidery, from the front: a trail of little moonsilk leaves
 * down each edge of the opening, and the hem scalloped like a wing's margin.
 */
function mothGown(c: PixelCanvas, cx: number, waist: number, hem: number): void {
  c.part();
  for (let y = waist + 2; y < hem; y += 2) {
    const w = (y - waist) * 0.28 + 1.4;
    for (const s of [-1, 1]) {
      const x = Math.round(cx + s * w + (s > 0 ? 0 : -1));
      if (c.filled(x, y)) c.px(x, y, S.stripe, sphere(s * 0.3, 0), { glow: 0.25 });
    }
  }
  for (let x = cx - 6; x <= cx + 6; x += 2) if (c.filled(x, hem - 1)) c.shade(x, hem - 1, -1);
}

/**
 * Her back: the wings spread over it from the shoulder blades, the fur
 * collar, and her hair falling long between the wings to her waist, the
 * antennae rising over her crown.
 */
function mothBack(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  mothWings(c, cx, 16.5 + U, flapOf(p));
  furCollar(c, cx, 15.6 + U, 3.9, true);
  c.part();
  c.ellipse(cx, 12 + U, 3.7, 3.8, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  c.part();
  c.shape(Math.round(14 + U), Math.round(22 + U), (y) => {
    const u = (y - 14 - U) / 8;
    const hw = 3.2 - u * 1.2;
    const s = u * u * p.sway * 0.6;
    return [cx - hw + s, cx + hw + s];
  }, S.hair, (_x, _y, t, u) => sphere(t * 0.8, u * 0.5 - 0.1, 1));
  // Strands down it, and the tips parting at the end.
  for (let y = 15; y <= 21; y++) {
    c.shade(cx - 1, y + U, -1);
    if (y > 17) c.shade(cx + 1, y + U, -1);
  }
  c.erase(cx, Math.round(22 + U));
  c.shade(cx - 1, 11 + U, 1);
  feeler(c, cx - 1.6, 8.6 + U, -1, p.tick);
  feeler(c, cx + 0.6, 8.6 + U, 1, p.tick + 3);
}

/** Her head in profile, facing left: the face, the hair falling long down her back, the antennae sweeping up and back. */
function mothHeadSide(c: PixelCanvas, hx: number, U: number, p: Pose): void {
  const M = S.moth!;
  furCollar(c, hx - 0.2, 15.8 + U, 3.0);
  c.part();
  c.ellipse(hx + 0.6, 12 + U, 3.3, 3.7, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.2, dy * 0.8 - 0.2, 1) });
  c.part();
  c.shape(Math.round(13 + U), Math.round(21 + U), (y) => {
    const u = (y - 13 - U) / 8;
    const back = hx + 3.6 + u * (0.8 + p.sway * 0.5);
    return [back - 3.2 + u * 0.8, back];
  }, S.hair, (_x, _y, t, u) => sphere(t * 0.8 + 0.2, u * 0.5 - 0.1, 1));
  for (let y = 14; y <= 20; y++) c.shade(hx + 2 + Math.round((y - 14) * 0.15), y + U, -1);
  c.part();
  c.ellipse(hx - 1.6, 13.2 + U, 2.0, 2.5, FAIR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8 - 0.3, dy * 0.6 + 0.1, 1) });
  c.px(hx - 4, 13 + U, FAIR, sphere(-0.8, 0));
  // The fringe over her brow, a lock before her ear.
  c.part();
  c.shape(Math.round(10 + U), Math.round(11 + U), () => [hx - 3.6, hx + 0.4], S.hair, (_x, _y, t, u) => sphere(t * 0.8 - 0.2, u * 0.5 - 0.5, 1));
  c.capsule(hx - 0.2, 12 + U, hx - 0.4, 17 + U, 0.8, 0.6, S.hair);
  eyes(c, [[hx - 3, 13 + U]], p.blink);
  if (!p.blink) c.spark(hx - 3, 13 + U, S.light[2], 0.25);
  c.part();
  c.px(hx - 3, 15 + U, M.lip, sphere(-0.3, 0.3));
  feeler(c, hx - 1.4, 8.8 + U, -1, p.tick, 0.4);
  feeler(c, hx + 0.6, 8.6 + U, 1, p.tick + 3, -0.6, -1);
}

/** Her collar of white moth fur, fluffed in soft scallops round her shoulders. */
function furCollar(c: PixelCanvas, x: number, y: number, rx: number, back = false): void {
  const M = S.moth!;
  c.part();
  c.ellipse(x, y, rx, 1.7, M.fur, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.6 - 0.4, 1) });
  // Tufts along its lower edge.
  for (let i = -Math.floor(rx); i <= Math.floor(rx); i += 2) c.px(x + i, y + 1.7, M.fur, sphere(i / rx, 0.5), { bias: -1 });
  if (!back) c.shade(x, y + 1, -1);
}

// ---------------------------------------------------------------------------
// The idle moment's props

/** The puppet look the marionettist's own look works (so the pocket dancer matches it). */
const miniLook = (): PuppetLook => (S.toymaker ? NUTCRACKER_LOOK : S.tear ? PORCELAIN_DOLL_LOOK : GALLANT_LOOK);

/** How far below the fingers the dancer's head hangs, in pixels. */
const MINI_DROP = 6;

/**
 * The pocket dancer, drawn pixel by pixel below the fingers at (hx, hy): a
 * plumed helm (or the nutcracker's shako), a head, a tabard, stick arms and
 * legs, and three shining threads from the fingers to its head and hands.
 * It hangs clear of his coat, so its outline reads against the ground.
 */
function miniDancer(c: PixelCanvas, hx: number, hy: number, m: Mini): void {
  const P = miniLook();
  const x = Math.round(hx);
  const top = Math.round(hy + MINI_DROP - (m.hop ?? 0));
  const bow = m.bow ? 1 : 0;
  const hx0 = x - 1 + (m.limp ? 1 : 0);
  const armL = m.limp ? -1 : (m.armL ?? -1);
  const armR = m.limp ? -1 : (m.armR ?? -1);
  // Arms first (behind the body): hanging, out, or up, from the shoulders.
  const armPx = (sx: number, side: number, a: number): [number, number][] =>
    a < 0 ? [[sx, top + 4], [sx, top + 5]] : a === 0 ? [[sx + side, top + 3], [sx + side * 2, top + 3]] : [[sx, top + 2], [sx + side, top + 1]];
  const la = armPx(x - 2, -1, bow ? -1 : armL);
  const ra = armPx(x + 2, 1, bow ? -1 : armR);
  c.part();
  for (const [ax, ay] of [...la, ...ra]) c.px(ax, ay + bow, P.wood, sphere(0, -0.2));
  // Legs, the kicking one swung out sideways.
  const kick = m.limp ? 0 : (m.kick ?? 0);
  const shako = P.shako;
  c.part();
  for (const side of [-1, 1]) {
    const lx = x + (side < 0 ? -1 : 1);
    const legs: [number, number][] = kick === side ? [[lx + side, top + 6], [lx + side * 2, top + 6]] : [[lx, top + 6], [lx, top + 7]];
    for (const [ax, ay] of legs) c.px(ax, ay, shako?.legs ?? P.wood, sphere(side * 0.3, 0));
    const [fx, fy] = legs[1];
    c.px(fx, fy, BOOT, sphere(0, 0.3));
  }
  // The tabard, a trim at its belt, and the joint of the neck.
  c.part();
  c.shape(top + 3 + bow, top + 5, () => [x - 1, x + 2], P.tabard, (_x, _y, t, u) => sphere(t * 0.8, u * 0.6 - 0.2, 1));
  c.part();
  c.px(x, top + 5, P.trim, sphere(0, 0));
  // The head (bowed forward: a row lower, the helm tipped to show its crown).
  c.part();
  c.shape(top + 1 + bow, top + 2 + bow, () => [hx0, hx0 + 3], P.head, (_x, _y, t, u) => sphere(t * 0.8, u * 0.6 - 0.3, 1));
  c.part();
  if (shako) {
    c.shape(top - 1 + bow, top + bow, () => [hx0, hx0 + 3], P.helm, (_x, _y, t) => cyl(t, 0.2));
    c.px(hx0 + 1, top - 2 + bow, P.plume, sphere(0, -0.6));
  } else {
    c.shape(top + bow, top + bow, () => [hx0, hx0 + 3], P.helm, (_x, _y, t) => cyl(t, 0.3));
    c.px(hx0 + 2, top - 1 + bow, P.plume, sphere(0.5, -0.5));
  }
  if (!m.bow && !m.limp) c.px(hx0 + 1, top + 2, P.cheek, sphere(0, 0));
  // The threads: fingers to the head and to each hand.
  const [, hot, mid] = S.light;
  thread(c, hx, hy + 1, hx0 + 1, top - (shako ? 3 : 1) + bow, 0.5, hot);
  thread(c, hx - 1, hy + 1, la[la.length - 1][0], la[la.length - 1][1] + bow - 1, 0.35, mid);
  thread(c, hx + 1, hy + 1, ra[ra.length - 1][0], ra[ra.length - 1][1] + bow - 1, 0.35, mid);
}

/**
 * The cat's cradle strung between her hands, in shining thread: the plain
 * cradle (two strands and their cross), the diamond, and the eye (two
 * diamonds meeting in the middle). Snapped, the strands whip back into her
 * fingers and bright bits of them fly out and fade.
 */
function cradleFigure(c: PixelCanvas, L: Placed, R: Placed, f: Figure): void {
  const [core, hot, mid, deep] = S.light;
  const mx = (L.x + R.x) / 2;
  const my = (L.y + R.y) / 2;
  const k = f.k;
  const line = (pts: [number, number][], a: number, col = hot) => {
    for (let i = 1; i < pts.length; i++) thread(c, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], a, col);
  };
  if (f.snap) {
    const s = f.snap;
    const fade = s > 1 ? 0.45 : 1;
    // Loose ends curling back into each hand.
    for (const [h, d] of [[L, 1], [R, -1]] as const) {
      line([[h.x, h.y], [h.x + d * 1.5, h.y - 1.5 * s], [h.x + d * (1 + s), h.y - 2.5 * s]], 0.6 * fade, mid);
      line([[h.x, h.y], [h.x + d * 1.5, h.y + 1.2 * s]], 0.5 * fade, mid);
    }
    // Bits of light flying out from where the figure was, and falling.
    const bits: [number, number][] = [[-3, -2], [2, -3], [4, 0], [-4, 1], [0, 2], [3, 2], [-1, -3]];
    bits.forEach(([dx, dy], i) => {
      const r = s > 1 ? 1.7 : 1;
      c.spark(mx + dx * r, my + dy * r + (s > 1 ? 1 : 0), i % 3 === 0 ? core : i % 3 === 1 ? hot : mid, (i % 2 ? 1 : 0.8) * fade);
    });
    if (s === 1) glowAt(c, mx, my, 1);
    return;
  }
  const lt: [number, number] = [L.x, L.y - 1];
  const lb: [number, number] = [L.x, L.y + 1];
  const rt: [number, number] = [R.x, R.y - 1];
  const rb: [number, number] = [R.x, R.y + 1];
  if (f.shape === 0) {
    line([lt, rt], 0.8 * k);
    line([lb, rb], 0.8 * k);
    line([lt, rb], 0.55 * k, mid);
    line([lb, rt], 0.55 * k, mid);
  } else if (f.shape === 1) {
    line([[L.x, L.y], [mx, my - 3], [R.x, R.y], [mx, my + 3], [L.x, L.y]], 0.85 * k);
    line([[L.x, L.y], [R.x, R.y]], 0.5 * k, mid);
  } else {
    line([[L.x, L.y], [mx - 2, my - 3], [mx, my], [mx + 2, my - 3], [R.x, R.y]], 0.85 * k);
    line([[L.x, L.y], [mx - 2, my + 3], [mx, my], [mx + 2, my + 3], [R.x, R.y]], 0.85 * k);
    line([[mx - 2, my - 3], [mx + 2, my - 3]], 0.5 * k, mid);
    line([[mx - 2, my + 3], [mx + 2, my + 3]], 0.5 * k, mid);
    c.spark(mx, my, core, k);
  }
  // Knots of light where the strands cross, and at her fingers.
  c.spark(L.x, L.y, core, 0.6 * k);
  c.spark(R.x, R.y, core, 0.6 * k);
  if (f.shape < 2) c.spark(mx, my, core, 0.7 * k);
  if (f.pick) {
    glowAt(c, mx, my, 0.6 * k);
    c.spark(mx, my - 1, deep, 0.5);
  }
}

// ---------------------------------------------------------------------------
// Views

const REACH_FRONT = 4.5;
const REACH_SIDE = 5.2;

function drawDown(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('down', 'a', p.a, U, cx);
  const fb = place('down', 'b', p.b, U, cx);
  const w = S.weaver;
  const armA = () => arm(c, 7.3, 16.3 + U, fa, REACH_FRONT, [-0.6, 1], fa.behind ? -1 : 0);
  const armB = () => arm(c, 16.7, 16.3 + U, fb, REACH_FRONT, [0.6, 1], fb.behind ? -1 : 0);
  const top = 15 + U;
  const waist = 22 + U;

  if (!w) {
    // The coat's swallowtails, hanging behind the legs.
    c.part();
    c.shape(waist, Math.round(27.5 + L), (y) => {
      const u = (y - waist) / (27.5 + L - waist);
      return [cx - 4.8 - u * 0.4 + u * p.sway, cx + 4.8 + u * 0.4 + u * p.sway];
    }, S.coat, (_x, _y, t) => sphere(t * 0.9, 0.3, 1), { bias: -1 });
    for (let y = waist + 2; y <= 27 + L; y++) c.erase(cx, y);
  }
  mothWings(c, cx, 16.5 + U, flapOf(p));
  if (fa.behind) armA();
  if (fb.behind) armB();
  spiderLegs(c, cx - 1, 17 + U, -1, p.tick, -1);
  spiderLegs(c, cx + 1, 17 + U, 1, p.tick, -1);

  legs(c, 'down', L, p);

  if (w) {
    // The robe falls to the ankles, flaring, open over its lining.
    const hem = Math.round(28 + L);
    c.part();
    c.shape(top, hem, (y) => {
      const u = (y + 0.5 - top) / (hem - top);
      const hw = y <= waist ? 4.3 - 0.4 * u : 4.0 + (y - waist) * 0.42;
      const s = y > waist ? (y - waist) * 0.12 * p.sway : 0;
      return [cx - hw + s, cx + hw + s];
    }, S.coat, (_x, y, t) => sphere(t * 0.9, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.3, 1));
    c.part();
    for (let y = waist + 1; y <= hem; y++) {
      const hw = (y - waist) * 0.28;
      c.shape(y, y, () => [cx - hw - 0.2, cx + hw + 0.2], S.under, (_x, _y, t) => sphere(t * 0.5, 0.4, 1));
    }
    for (let x = cx - 5; x <= cx + 6; x++) if (c.filled(x, hem)) c.px(x, hem, S.trim, sphere(0, 0.4));
    // A sash, and the spool of thread at her hip.
    c.part();
    c.shape(waist, waist, () => [cx - 4, cx + 4], S.under, (_x, _y, t) => cyl(t, 0));
    c.part();
    c.shape(Math.round(waist + 1), Math.round(waist + 3), () => [cx + 3, cx + 5.2], SPOOL, (_x, _y, t) => cyl(t, 0.2));
    c.part();
    c.shape(Math.round(waist + 1.5), Math.round(waist + 2.5), () => [cx + 3.4, cx + 4.8], S.stripe, (_x, _y, t) => cyl(t, 0.2), { glow: 0.5 });
    if (S.moth) {
      mothGown(c, cx, waist, hem);
      furCollar(c, cx, 15.6 + U, 3.9);
      mothHeadDown(c, cx, U, p);
    } else {
      // A silver clasp at the throat.
      c.part();
      c.px(cx, 15.5 + U, S.trim, sphere(0, -0.5));
      hoodDown(c, cx, U, p);
    }
  } else {
    // The coat, open over the waistcoat; piping down the lapels.
    c.part();
    c.shape(top, waist, (y) => {
      const u = (y + 0.5 - top) / (waist - top);
      const hw = 4.6 - 0.6 * u * u;
      return [cx - hw, cx + hw];
    }, S.coat, (_x, y, t) => sphere(t * 0.9, ((y - top) / (waist - top)) * 0.8 - 0.35, 1));
    c.part();
    c.shape(Math.round(top + 1), Math.round(waist + 1), (y) => {
      const u = (y - top - 1) / (waist - top);
      const hw = 1.3 + u * 0.9;
      return [cx - hw, cx + hw];
    }, S.under, (_x, _y, t) => sphere(t * 0.6, 0.1, 1));
    // Pinstripes (or harlequin diamonds) and brass buttons.
    c.part();
    for (let y = Math.round(top + 2); y <= waist + 1; y++) {
      const off = S.tear ? ((y & 1) === 0 ? 0 : 1) : 0;
      for (const x of [cx - 2 + off, cx + 1 - off]) if (c.filled(x, y)) c.px(x, y, S.stripe, sphere(0, 0));
    }
    c.part();
    for (const y of [top + 3, top + 5]) c.px(cx, y, S.trim, sphere(0, -0.4));
    for (let y = Math.round(top + 1); y <= waist; y++) {
      const u = (y - top - 1) / (waist - top);
      const hw = 1.3 + u * 0.9;
      c.px(Math.floor(cx - hw - 1), y, S.trim, sphere(-0.4, 0));
      c.px(Math.ceil(cx + hw), y, S.trim, sphere(0.4, 0));
    }
    // The cravat's ruffle at the throat.
    c.part();
    c.ellipse(cx, 16 + U, 1.9, 1.5, CRAVAT, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.6 - 0.2, 1) });
    c.shade(cx, 16 + U, -1);
    showmanHead(c, cx, U, p, false);
  }

  if (w) cradle(c, fa, fb, p.cradle, p.tick);
  if (w && p.figure) cradleFigure(c, fa, fb, p.figure);
  if (!fb.behind) armB();
  if (!fa.behind) armA();
  if (!w) controlCross(c, 'down', fa.x, fa.y - 0.6, p.tilt, p.glow, fa.behind ? -1 : 0);
  else if (p.glow > 0) glowAt(c, fa.x, fa.y, p.glow);
  if (w && p.cradle > 0) {
    c.spark(fa.x, fa.y, S.light[0], 0.5 * p.cradle);
    c.spark(fb.x, fb.y, S.light[0], 0.5 * p.cradle);
  }
  if (!w && p.mini) miniDancer(c, fb.x, fb.y, p.mini);
}

function drawUp(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('up', 'a', p.a, U, cx);
  const fb = place('up', 'b', p.b, U, cx);
  const w = S.weaver;
  const armA = () => arm(c, 7.3, 16.3 + U, fa, REACH_FRONT, [-0.6, 0.8], fa.behind ? -1 : 0);
  const armB = () => arm(c, 16.7, 16.3 + U, fb, REACH_FRONT, [0.6, 0.8], fb.behind ? -1 : 0);
  const top = 15 + U;
  const waist = 22 + U;

  if (w) cradle(c, fa, fb, p.cradle * 0.6, p.tick);
  if (fa.behind) {
    armA();
    if (!w) controlCross(c, 'up', fa.x, fa.y - 0.6, p.tilt, p.glow, -1);
  }
  if (fb.behind) armB();

  legs(c, 'up', L, p);

  if (w) {
    const hem = Math.round(28 + L);
    c.part();
    c.shape(top, hem, (y) => {
      const hw = y <= waist ? 4.3 - 0.4 * ((y + 0.5 - top) / (waist - top)) : 4.0 + (y - waist) * 0.42;
      const s = y > waist ? (y - waist) * 0.12 * p.sway : 0;
      return [cx - hw + s, cx + hw + s];
    }, S.coat, (_x, _y, t, u) => sphere(t * 0.9, u * 0.6 - 0.3, 1));
    for (let x = cx - 5; x <= cx + 6; x++) if (c.filled(x, hem)) c.px(x, hem, S.trim, sphere(0, 0.4));
    if (S.moth) {
      c.part();
      c.shape(waist, waist, () => [cx - 4, cx + 4], S.under, (_x, _y, t) => cyl(t, 0));
      mothBack(c, cx, U, p);
    } else {
      // A web stitched in silver across her back (Arachne: a red hourglass).
      c.part();
      const wy = 19.5 + U;
      if (S.spider) {
        for (const [y, x0, x1] of [[0, 10, 13], [1, 11, 12], [2, 11, 12], [3, 10, 13]]) for (let x = x0; x <= x1; x++) c.px(x, Math.round(18 + U) + y, S.spider.mark, sphere(0, 0));
      } else for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + 0.26;
        for (let r = 1; r <= 3.4; r += 0.7) c.px(Math.round(cx + Math.cos(a) * r), Math.round(wy + Math.sin(a) * r * 0.8), S.under, sphere(0, 0));
      }
      if (!S.spider) for (const r of [1.8, 3.2]) {
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2;
          if (k % 2 === 0) c.px(Math.round(cx + Math.cos(a) * r), Math.round(wy + Math.sin(a) * r * 0.8), S.trim, sphere(0, 0), { bias: -1 });
        }
      }
      c.part();
      c.shape(waist, waist, () => [cx - 4, cx + 4], S.under, (_x, _y, t) => cyl(t, 0));
      // The back of the hood, its point hanging down between the shoulders.
      c.part();
      c.ellipse(cx, 12 + U, 4.3, 4.3, S.coat, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8, 1) });
      c.part();
      c.capsule(cx, 14 + U, cx + 0.4, 17.6 + U, 1.4, 0.5, S.coat);
      c.shade(cx - 1, 12 + U, -1);
      c.shade(cx - 1, 13 + U, -1);
      c.part();
      c.capsule(cx - 3.6, 13 + U, cx - 3.8, 17 + U, 0.7, 0.5, S.hair);
      c.capsule(cx + 3.6, 13 + U, cx + 3.8, 17 + U, 0.7, 0.5, S.hair);
      spiderLegs(c, cx - 1, 17 + U, -1, p.tick);
      spiderLegs(c, cx + 1, 17 + U, 1, p.tick);
    }
  } else {
    c.part();
    c.shape(top, Math.round(27.5 + L), (y) => {
      if (y <= waist) {
        const hw = 4.6 - 0.6 * ((y + 0.5 - top) / (waist - top)) ** 2;
        return [cx - hw, cx + hw];
      }
      const u = (y - waist) / (27.5 + L - waist);
      return [cx - 4.2 - u * 0.4 + u * p.sway, cx + 4.2 + u * 0.4 + u * p.sway];
    }, S.coat, (_x, _y, t, u) => sphere(t * 0.9, u * 0.6 - 0.3, 1));
    // The split between the tails, two buttons over it.
    for (let y = waist + 1; y <= 27 + L; y++) c.erase(cx + Math.round(((y - waist) / 6) * p.sway), y);
    for (let y = top + 1; y <= waist; y++) c.shade(cx, y, -1);
    c.part();
    c.px(cx - 2, waist, S.trim, sphere(0, -0.3));
    c.px(cx + 1, waist, S.trim, sphere(0, -0.3));
    c.part();
    c.ellipse(cx, 16.2 + U, 3.4, 1.1, S.coat, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.5 - 0.6, 1) });
    showmanHead(c, cx, U, p, true);
  }

  if (!fb.behind) armB();
  if (!fa.behind) {
    armA();
    if (!w) controlCross(c, 'up', fa.x, fa.y - 0.6, p.tilt, p.glow);
  }
  if (w && p.glow > 0) glowAt(c, fa.x, fa.y, p.glow * 0.7);
}

/** Facing left. Right-facing frames are mirrored from these. */
function drawSide(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const hx = cx - p.lean;
  const fa = place('side', 'a', p.a, U, hx);
  const fb = place('side', 'b', p.b, U, hx);
  const w = S.weaver;
  const top = 15 + U;
  const waist = 22 + U;

  // Luna's wings behind everything, the far pair a touch higher and in shade.
  if (S.moth) {
    const flap = flapOf(p);
    mothWing(c, hx + 3.4, 15.4 + U, 1, 0.62, flap, -1);
    mothWing(c, hx + 2.2, 16.6 + U, 1, 0.78, flap);
  }
  // The far arm first.
  const armB = (bias: number) => arm(c, hx + 1.2, 16.4 + U, fb, REACH_SIDE, [0.3, 1], bias);
  if (fb.behind) armB(-1);
  spiderLegs(c, hx + 1.2, 16.5 + U, 1, p.tick + 1, -2);
  spiderLegs(c, hx + 2.2, 17 + U, 1, p.tick, -1);
  if (w) cradle(c, fa, fb, p.cradle * 0.8, p.tick);

  if (!w) {
    // Swallowtails streaming back.
    c.part();
    c.shape(waist, Math.round(27.5 + L), (y) => {
      const u = (y - waist) / (27.5 + L - waist);
      return [hx + 0.4 + u * 1.4, hx + 3.6 + u * (1.6 + p.sway)];
    }, S.coat, (_x, _y, t) => sphere(t * 0.9 + 0.1, 0.3, 1), { bias: -1 });
  }

  legs(c, 'side', L, p);

  if (w) {
    const hem = Math.round(28 + L);
    c.part();
    c.shape(top, hem, (y) => {
      const u = y <= waist ? 0 : (y - waist) / (hem - waist);
      const shift = y <= waist ? hx : hx + (cx - hx) * u;
      const hw = y <= waist ? 3.2 - 0.3 * ((y + 0.5 - top) / (waist - top)) : 3.0 + (y - waist) * 0.4;
      return [shift - hw - 0.3, shift + hw + u * (0.6 + p.sway)];
    }, S.coat, (_x, y, t) => sphere(t * 0.9 - 0.1, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.3, 1));
    // The lining showing down the front edge.
    c.part();
    for (let y = waist + 1; y <= hem; y++) {
      const u = (y - waist) / (hem - waist);
      const x = Math.round(hx + (cx - hx) * u - 3.0 - (y - waist) * 0.4);
      c.px(x + 1, y, S.under, sphere(-0.6, 0.3));
    }
    for (let x = cx - 7; x <= cx + 7; x++) if (c.filled(x, hem)) c.px(x, hem, S.trim, sphere(0, 0.4));
    c.part();
    c.shape(waist, waist, () => [hx - 3, hx + 3], S.under, (_x, _y, t) => cyl(t, 0));
    c.part();
    c.shape(Math.round(waist + 1), Math.round(waist + 3), () => [hx + 1, hx + 3], SPOOL, (_x, _y, t) => cyl(t, 0.2));
    c.px(hx + 1, waist + 2, S.stripe, sphere(0, 0), { glow: 0.5 });
    c.px(hx + 2, waist + 2, S.stripe, sphere(0, 0), { glow: 0.5 });
    if (S.moth) mothHeadSide(c, hx, U, p);
    else {
      // The hood in profile, its point hanging back; the face in its shadow.
      c.part();
      c.ellipse(hx + 0.4, 12 + U, 3.9, 4.2, S.coat, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.2, dy * 0.8 - 0.2, 1) });
      c.part();
      c.capsule(hx + 3, 11 + U, hx + 4.6, 14.4 + U, 1.3, 0.5, S.coat);
      c.part();
      c.ellipse(hx - 1.6, 13 + U, 1.9, 2.4, S.under, { normal: () => sphere(-0.3, 0.3, 1), bias: -2 });
      c.part();
      c.ellipse(hx - 2.2, 13.4 + U, 1.4, 2.0, PALE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8 - 0.2, dy * 0.6 + 0.2, 1), bias: -1 });
      c.part();
      c.capsule(hx - 1.2, 12 + U, hx - 1.6, 17.4 + U, 0.9, 0.7, S.hair);
      eyes(c, S.spider ? [[hx - 3, 13 + U], [hx - 2, 12 + U]] : [[hx - 3, 13 + U]], p.blink, true);
      c.part();
      c.px(hx - 4, 10 + U, S.trim, sphere(-0.5, -0.4));
      c.px(hx - 3, 9 + U, S.trim, sphere(-0.3, -0.5));
    }
  } else {
    c.part();
    c.shape(top, waist, (y) => {
      const hw = 3.2 - 0.4 * ((y + 0.5 - top) / (waist - top)) ** 2;
      return [hx - hw - 0.2, hx + hw + 0.2];
    }, S.coat, (_x, y, t) => sphere(t * 0.9 - 0.1, ((y - top) / (waist - top)) * 0.8 - 0.35, 1));
    // The waistcoat showing at the front, piping down the lapel.
    c.part();
    c.shape(Math.round(top + 1), waist, () => [hx - 3.4, hx - 1.6], S.under, (_x, _y, t) => sphere(t * 0.5 - 0.5, 0.1, 1));
    for (let y = Math.round(top + 2); y <= waist; y += 1) if (!S.tear || (y & 1) === 0) c.px(Math.round(hx - 3), y, S.stripe, sphere(-0.3, 0));
    for (let y = Math.round(top + 1); y <= waist; y++) c.px(Math.round(hx - 1.6), y, S.trim, sphere(-0.2, 0));
    c.part();
    c.ellipse(hx - 2.2, 16 + U, 1.4, 1.4, CRAVAT, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8 - 0.3, dy * 0.6 - 0.2, 1) });
    // The head in profile: hair behind, the masked face, the hat.
    c.part();
    c.ellipse(hx + 0.4, 12.4 + U, 2.9, 3.0, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.2, dy * 0.8, 1) });
    c.part();
    c.ellipse(hx - 1.2, 12.9 + U, 2.2, 2.4, SKIN);
    c.part();
    c.px(hx - 4, 12.6 + U, SKIN, sphere(-0.7, -0.1), { bias: 1 });
    if (S.toymaker) {
      // The patch on its strap, the queue and ribbon behind, the moustache.
      c.part();
      c.capsule(hx + 1.8, 12.6 + U, hx + 3.6, 16.4 + U, 1.0, 0.6, S.hair);
      c.part();
      c.px(hx + 2, 13 + U, S.plume, sphere(0.4, 0));
      c.part();
      c.px(hx - 3, 12 + U, S.mask, sphere(-0.3, 0));
      c.px(hx - 3, 13 + U, S.mask, sphere(-0.3, 0.4), { bias: -1 });
      for (let x = hx - 2; x <= hx + 0; x++) c.px(x, 11 + U, S.mask, sphere(0, -0.3), { bias: -1 });
      c.part();
      c.px(hx - 4, 14 + U, S.hair, sphere(-0.5, 0.2));
      c.px(hx - 3, 14 + U, S.hair, sphere(0, 0.2));
      c.px(hx - 5, 13 + U, S.hair, sphere(-0.7, -0.3));
    } else {
    c.part();
    c.shape(Math.round(11 + U), Math.round(12 + U), () => [hx - 3.8, hx], S.mask, (_x, _y, t, u) => sphere(t * 0.8 - 0.2, u * 0.8 - 0.4, 1));
    c.px(hx - 4, 11 + U, S.mask, sphere(-0.7, -0.3));
    eyes(c, [[hx - 3, 12 + U]], p.blink);
    }
    if (S.tear) {
      c.part();
      c.px(hx - 3, 13 + U, S.tear, sphere(0, 0.2));
    }
    if (!S.toymaker) c.shade(hx - 3, 14 + U, -1);
    topHat(c, hx, U, p.tick, 'side');
  }

  if (!fb.behind && !w) armB(0);
  // The working arm out in front.
  arm(c, hx - 0.2, 16.7 + U, fa, REACH_SIDE, [0.4, 1], 0);
  if (!w) controlCross(c, 'side', fa.x, fa.y - 0.6, p.tilt, p.glow);
  else {
    if (!fb.behind) armB(0);
    if (p.glow > 0) glowAt(c, fa.x - 0.5, fa.y, p.glow);
  }
}

// ---------------------------------------------------------------------------
// Animations

/** The marionettist's cross held up before him, the other hand at ease; the weaver's hands at her chest, the cradle between them. */
const CROSS_A = H(2.6, 3.8, 2.2);
const EASE_B = H(0.4, 4.6, -2.4);
const CRADLE_A = H(2.2, 2.2, 1.2);
const CRADLE_B = H(2.2, 2.2, 1.2);
/** Side-view hands. */
const side = (h: Hand, arm: 'a' | 'b'): Hand => (S.weaver ? H(h.f + 1.2, 0, h.h - (arm === 'b' ? 0.6 : 0)) : H(arm === 'a' ? h.f + 1.4 : h.f + 0.4, 0, h.h));

const base = (view: View): Pose => {
  const a = S.weaver ? CRADLE_A : CROSS_A;
  const b = S.weaver ? CRADLE_B : EASE_B;
  return {
    lift: 0,
    breath: 0,
    footA: view === 'side' ? 1 : 0,
    footB: view === 'side' ? -1 : 0,
    lean: 0,
    a: view === 'side' ? side(a, 'a') : { ...a },
    b: view === 'side' ? side(b, 'b') : { ...b },
    tilt: 0,
    glow: 0,
    cradle: S.weaver ? 0.6 : 0,
    sway: 0,
    tick: 0,
  };
};

/** Standing easy: the cross rocks as he keeps his puppet dancing; her cradle of thread breathes. */
function idle(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = (f / N) * Math.PI * 2;
    const p = base(view);
    p.breath = Math.sin(ph) > 0.5 ? 1 : 0;
    p.sway = Math.sin(ph - 1) * 0.6;
    p.tick = f;
    p.blink = f === 4;
    if (S.weaver) {
      p.a.s -= Math.sin(ph) * 0.5;
      p.b.s -= Math.sin(ph) * 0.5;
      p.cradle = 0.55 + 0.25 * Math.sin(ph);
    } else {
      p.tilt = Math.sin(ph) * 0.25;
      p.a.h += Math.sin(ph + 0.8) * 0.5;
      p.glow = 0.15 + 0.1 * Math.sin(ph);
    }
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
    p.tick = f;
    if (view === 'side') {
      p.footA = Math.round(s * 2.2);
      p.footB = -p.footA;
      p.lean = 1;
      p.sway = 1 + Math.abs(s) * 0.9;
    } else {
      p.footA = s > 0.3 ? 1 : 0;
      p.footB = s < -0.3 ? 1 : 0;
      p.sway = s * 0.8;
    }
    if (S.weaver) {
      p.a.h += p.lift * 0.4;
      p.b.h += p.lift * 0.4;
    } else {
      p.tilt = s * 0.2;
      p.a.h += p.lift * 0.5;
      p.b.f -= s * 1.2;
      p.glow = 0.15;
    }
    frames.push(p);
  }
  return frames;
}

interface Key {
  a: Hand;
  b: Hand;
  aSide?: Hand;
  bSide?: Hand;
  tilt?: number;
  glow?: number;
  cradle?: number;
  lean?: number;
  breath?: number;
  lift?: number;
  step?: number;
}

function action(keys: Key[]) {
  return (view: View): Pose[] =>
    keys.map((k, i) => {
      const p = base(view);
      p.a = view === 'side' ? { ...(k.aSide ?? side(k.a, 'a')) } : { ...k.a };
      p.b = view === 'side' ? { ...(k.bSide ?? side(k.b, 'b')) } : { ...k.b };
      p.tilt = k.tilt ?? 0;
      p.glow = k.glow ?? 0;
      p.cradle = k.cradle ?? 0;
      p.breath = k.breath ?? 0;
      p.lift = k.lift ?? 0;
      p.tick = i;
      const step = k.step ?? 0;
      if (view === 'side') {
        p.lean = k.lean ?? 0;
        p.footA = 1 + step;
        p.footB = -1 - Math.round(step * 0.5);
        p.sway = Math.max(0, (k.lean ?? 0) * 0.6) + 0.4;
      } else {
        p.footA = step > 0 ? 1 : 0;
        p.sway = (k.lean ?? 0) * -0.4;
      }
      return p;
    });
}

/** The pull: the cross drawn back and up, then jerked down and forward, and the puppet lunges. */
const pull = action([
  { a: H(0.8, 3.2, 6.4), b: EASE_B, tilt: -0.3, glow: 0.3, lean: -1 },
  { a: H(0.2, 3.4, 7.6), b: H(0.6, 4.4, -1.6), tilt: -0.5, glow: 0.5, lean: -1 },
  { a: H(3.6, 2.8, 2.8), b: H(1.2, 4.2, -1.2), tilt: 0.5, glow: 1, lean: 1, step: 1 },
  { a: H(3.4, 2.8, 3.2), b: EASE_B, tilt: 0.3, glow: 0.6, lean: 1, step: 1 },
  { a: CROSS_A, b: EASE_B, tilt: 0, glow: 0.2 },
]);

/** The twirl: the cross raised high and spun over his head, the free hand flung out with a flourish. */
const twirl = action([
  { a: H(1.6, 3.0, 7.0), b: H(1.0, 4.4, 1.0), tilt: -0.6, glow: 0.4 },
  { a: H(1.0, 2.4, 9.0), b: H(1.6, 5.0, 3.0), tilt: 0.6, glow: 0.7, lift: 1 },
  { a: H(0.6, 1.6, 10.0), b: H(1.8, 5.4, 4.2), tilt: -0.8, glow: 1, lift: 1, lean: -1 },
  { a: H(1.0, 2.4, 9.4), b: H(1.8, 5.4, 4.2), tilt: 0.9, glow: 1 },
  { a: H(0.6, 1.6, 10.0), b: H(1.6, 5.2, 3.8), tilt: -0.9, glow: 1, lift: 1 },
  { a: H(1.0, 2.4, 9.0), b: H(1.4, 5.0, 2.8), tilt: 0.7, glow: 0.8 },
  { a: H(1.6, 3.0, 7.0), b: H(1.0, 4.6, 0.6), tilt: 0.2, glow: 0.5 },
  { a: CROSS_A, b: EASE_B, tilt: 0, glow: 0.2 },
]);

/** The lash: the casting hand drawn back, then flicked out, the thread cracking from the fingers. */
const lash = action([
  { a: H(0.4, 3.4, 3.4), b: H(2.0, 2.6, 0.8), cradle: 0.3, lean: -1 },
  { a: H(-0.4, 3.8, 3.8), b: H(2.0, 2.8, 0.6), cradle: 0.2, glow: 0.3, lean: -1 },
  { a: H(4.6, 2.0, 2.6), b: H(1.6, 3.0, 0.4), glow: 1, lean: 1, step: 1 },
  { a: H(4.2, 2.2, 2.2), b: H(1.8, 2.8, 0.6), glow: 0.5, lean: 1, step: 1 },
  { a: CRADLE_A, b: CRADLE_B, cradle: 0.5 },
]);

/** The snag: the thread flung out, then both hands hauling it back hand over hand. */
const snag = action([
  { a: H(0.2, 3.6, 4.4), b: H(1.4, 3.2, 1.6), glow: 0.4, lean: -1 },
  { a: H(4.8, 2.0, 3.0), b: H(3.4, 2.4, 2.2), glow: 1, lean: 1, step: 1 },
  { a: H(4.4, 2.0, 2.8), b: H(3.8, 2.2, 2.6), glow: 1, lean: 1, step: 1 },
  { a: H(0.6, 3.4, 2.0), b: H(3.6, 2.4, 2.4), glow: 0.8, lean: -1, breath: 1 },
  { a: H(3.4, 2.4, 2.4), b: H(0.4, 3.6, 1.8), glow: 0.8, lean: -1 },
  { a: CRADLE_A, b: CRADLE_B, cradle: 0.5, glow: 0.3 },
]);

/** The weave: both hands raised, fingers working, the cradle blazing, then flung down and wide. */
const weave = action([
  { a: H(2.0, 2.4, 3.4), b: H(2.0, 2.4, 3.4), cradle: 0.8 },
  { a: H(1.6, 2.8, 6.0), b: H(1.6, 2.0, 5.2), cradle: 1, lift: 1 },
  { a: H(1.6, 2.0, 7.2), b: H(1.6, 2.8, 6.4), cradle: 1, lift: 1, glow: 0.4 },
  { a: H(1.4, 2.8, 8.0), b: H(1.4, 2.0, 7.4), cradle: 1, lift: 1, glow: 0.7 },
  { a: H(3.0, 4.6, 2.0), b: H(3.0, 4.6, 2.0), glow: 1, step: 1, lean: 1, breath: 1 },
  { a: H(2.8, 5.0, 1.0), b: H(2.8, 5.0, 1.0), glow: 0.6, step: 1, lean: 1 },
  { a: H(2.4, 3.4, 1.0), b: H(2.4, 3.4, 1.0), glow: 0.3, cradle: 0.3 },
  { a: CRADLE_A, b: CRADLE_B, cradle: 0.6 },
]);

// ---------------------------------------------------------------------------
// The idle moment (`rest`), facing the viewer

/** A pose built from the idle's first frame, so the moment starts and ends on it exactly. */
const still = (o: Partial<Pose> = {}): Pose => {
  const p = idle('down')[0];
  return { ...p, a: { ...p.a }, b: { ...p.b }, ...o };
};

/** His free hand in his coat, and held out to the side with the dancer hanging from it. */
const COAT_B = H(1.6, 1.6, 1.0);
const DANCE_B = H(1.4, 10.2, 4.6);
const dance = (dh: number, ds = 0): Hand => H(DANCE_B.f, DANCE_B.s + ds, DANCE_B.h + dh);

/**
 * The marionettist's pocket dancer: he slips his free hand into his coat and
 * draws out a tiny doll of his own puppet on three threads, limp at first.
 * A twitch of the fingers and it springs up, arms high, kicks one way and
 * the other, leaps, and lands in a bow; he bows with it, and tucks it away.
 */
function showmanRest(): Pose[] {
  return [
    still(),
    still({ b: COAT_B, breath: 1, tick: 1 }),
    still({ b: dance(-0.6, -1.4), mini: { limp: true }, tick: 2 }),
    still({ b: dance(0.4), mini: { limp: true }, tick: 3 }),
    still({ b: dance(1.2), mini: { hop: 1, armL: 1, armR: 1 }, tick: 4 }),
    still({ b: dance(0.2, 0.4), mini: { armL: 0, armR: 1, kick: 1 }, tick: 5 }),
    still({ b: dance(0.2, -0.4), mini: { armL: 1, armR: 0, kick: -1 }, tick: 0 }),
    still({ b: dance(1.6), mini: { hop: 2, armL: 1, armR: 1 }, tick: 1 }),
    still({ b: dance(0.8), mini: { bow: true }, breath: 1, tick: 2 }),
    still({ b: COAT_B, breath: 1, tick: 3 }),
    still(),
  ];
}
const SHOWMAN_REST_ORDER = [0, 1, 2, 3, 3, 4, 4, 5, 6, 5, 6, 5, 6, 7, 7, 4, 8, 8, 8, 8, 9, 10];

/** Her hands drawn apart to string the figure, twisted one up and one down to change it, and pulled wide to snap it. */
const PAIR = (s: number, h: number, twist = 0): Pick<Pose, 'a' | 'b'> => ({ a: H(2.4, s, h + twist), b: H(2.4, s, h - twist) });

/**
 * The stringweaver plays cat's cradle: she draws her hands apart and the
 * cradle between them becomes a plain cradle of shining thread; a twist of
 * the hands and a pick at the middle and it is a diamond, another and it is
 * an eye; she holds it up to admire, then pulls her hands wide and it snaps,
 * bits of light flying, and she spins a fresh cradle between her fingers.
 */
function weaverRest(): Pose[] {
  return [
    still(),
    still({ ...PAIR(3.6, 1.2), cradle: 0, figure: { shape: 0, k: 0.6 }, tick: 1 }),
    still({ ...PAIR(4.0, 1.4), cradle: 0, figure: { shape: 0, k: 0.9 }, tick: 2 }),
    still({ ...PAIR(3.8, 1.6, 0.8), cradle: 0, figure: { shape: 0, k: 0.8, pick: true }, tick: 3 }),
    still({ ...PAIR(4.2, 1.6), cradle: 0, figure: { shape: 1, k: 0.9 }, tick: 0 }),
    still({ ...PAIR(4.0, 1.8, -0.8), cradle: 0, figure: { shape: 1, k: 0.8, pick: true }, tick: 1 }),
    still({ ...PAIR(4.8, 2.2), cradle: 0, figure: { shape: 2, k: 1 }, lift: 1, tick: 2 }),
    still({ ...PAIR(4.8, 2.6), cradle: 0, figure: { shape: 2, k: 1 }, lift: 1, glow: 0.3, tick: 3 }),
    still({ ...PAIR(6.2, 1.6), cradle: 0, figure: { shape: 2, k: 1, snap: 1 }, tick: 0 }),
    still({ ...PAIR(5.0, 1.0), cradle: 0, figure: { shape: 2, k: 1, snap: 2 }, breath: 1, tick: 1 }),
    still({ ...PAIR(2.8, 1.2), cradle: 0.25, tick: 2 }),
    still(),
  ];
}
const WEAVER_REST_ORDER = [0, 1, 2, 2, 3, 4, 4, 4, 5, 6, 7, 7, 7, 7, 6, 8, 9, 9, 10, 10, 11];

const REST_FPS = 8;
const rest = (view: View): Pose[] => (view !== 'down' ? [] : S.weaver ? weaverRest() : showmanRest());

// ---------------------------------------------------------------------------
// Frame generation

export type PuppeteerAnim = 'idle' | 'walk' | 'pull' | 'twirl' | 'lash' | 'snag' | 'weave' | 'rest';

export interface PuppeteerAnimDef {
  name: PuppeteerAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => Pose[];
  /** Only drawn for the stringweaver (true) or the marionettist (false); both when left out. */
  weaver?: boolean;
  /** Frame indices to play in order, when some are held or repeated. */
  order?: readonly number[];
}

export const PUPPETEER_ANIMS: PuppeteerAnimDef[] = [
  { name: 'idle', fps: 6, loop: true, poses: idle },
  { name: 'walk', fps: 9, loop: true, poses: walk },
  { name: 'pull', fps: 15, loop: false, poses: pull, weaver: false },
  { name: 'twirl', fps: 12, loop: false, poses: twirl, weaver: false },
  { name: 'lash', fps: 17, loop: false, poses: lash, weaver: true },
  { name: 'snag', fps: 14, loop: false, poses: snag, weaver: true },
  { name: 'weave', fps: 11, loop: false, poses: weave, weaver: true },
];

export const puppeteerAnims = (look: PuppeteerLook): PuppeteerAnimDef[] => [
  ...PUPPETEER_ANIMS.filter((a) => a.weaver === undefined || a.weaver === look.weaver),
  { name: 'rest', fps: REST_FPS, loop: false, poses: rest, order: look.weaver ? WEAVER_REST_ORDER : SHOWMAN_REST_ORDER },
];

/** Frame index at which each action lands. */
export const PUPPETEER_RELEASE = { pull: 2, twirl: 2, lash: 2, snag: 1, weave: 4 } as const;

/**
 * Where the working hand is in every frame, from the sprite's origin (its
 * feet), by `<texture>:<frame>`: the strings run from here to the puppet,
 * and threads leave from here.
 */
export const HAND_AT = new Map<string, { x: number; y: number }>();

export interface PuppeteerFrame {
  key: string;
  anim: PuppeteerAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawFrame(dir: Dir, pose: Pose, name: string): PixelCanvas {
  const c = new PixelCanvas(PUPPETEER_W, PUPPETEER_H).offset(BODY_X, BODY_Y);
  if (dir === 'down') drawDown(c, pose);
  else if (dir === 'up') drawUp(c, pose);
  else drawSide(c, pose);
  // Record the hand (the cross's middle) for the world's strings.
  const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
  const L = -pose.lift;
  const U = L + pose.breath;
  const hx = 12 - (view === 'side' ? pose.lean : 0);
  const q = place(view, 'a', pose.a, U, hx);
  const x = q.x + BODY_X - PUPPETEER_ORIGIN_X + 0.5;
  const y = q.y + BODY_Y - PUPPETEER_ORIGIN_Y - (S.weaver ? 0 : 1.4);
  HAND_AT.set(name, { x: dir === 'right' ? -x : x, y });
  return dir === 'right' ? c.mirrored() : c;
}

export function buildPuppeteerFrames(look: PuppeteerLook = CARNIVAL_LOOK): PuppeteerFrame[] {
  S = look;
  const out: PuppeteerFrame[] = [];
  for (const a of puppeteerAnims(look)) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, index) => {
        const key = `${a.name}_${dir}_${index}`;
        out.push({ key, anim: a.name, dir, canvas: drawFrame(dir, pose, `${look.key}:${key}`) });
      });
    }
  }
  S = CARNIVAL_LOOK;
  return out;
}

// ---------------------------------------------------------------------------
// The puppet: a wooden knight marionette (drawn facing right, mirrored)

export const PUPPET_FRAME = { w: 34, h: 42, ox: 17, oy: 40 };
/** Where the puppet is struck and strikes, above its feet. */
export const PUPPET_BODY_Y = 14;
/** How high its feet dangle over the ground. */
export const PUPPET_HOVER = 3;

/** One look for the puppet. */
export interface PuppetLook {
  key: string;
  head: Material;
  /** Its joints and limbs. */
  wood: Material;
  joint: Material;
  helm: Material;
  plume: Material;
  tabard: Material;
  trim: Material;
  blade: Material;
  /** Painted cheeks, and its eyes. */
  cheek: Material;
  eye: Material;
  /** Hairline cracks in the glaze (the porcelain doll). */
  cracks: boolean;
  /** The blade's edge glows faintly in this colour. */
  edge: RGB;
  /** The nutcracker: a tall shako with a plume instead of the helm, a white beard, and its own legs' colour. */
  shako?: { beard: Material; legs: Material };
}

const BIRCH: Material = { ramp: ramp('#5a3a22', '#8a5e38', '#b8864e', '#dcae6e', '#f0cc90'), outline: hex('#24140a'), shine: true };
const WALNUT: Material = { ramp: ramp('#2a1810', '#4a2e1c', '#6e4a2c', '#906a42'), outline: hex('#140a06') };
const TIN: Material = { ramp: ramp('#2a2c38', '#4e5264', '#7e8498', '#b8bece', '#eef2fa'), outline: hex('#12141c'), shine: true };
const RED_FELT: Material = { ramp: ramp('#3a0a10', '#6a1420', '#a02230', '#d04048'), outline: hex('#1a0408') };
const ROUGE: Material = { ramp: ramp('#b8404a', '#e0606a'), outline: hex('#5a1a20'), noOutline: true, noAO: true };
const PAINT: Material = { ramp: ramp('#140a0a', '#241414'), outline: hex('#140a0a'), noOutline: true, noAO: true };

export const GALLANT_LOOK: PuppetLook = {
  key: 'puppet',
  head: BIRCH,
  wood: BIRCH,
  joint: WALNUT,
  helm: TIN,
  plume: RED_FELT,
  tabard: RED_FELT,
  trim: GOLD,
  blade: TIN,
  cheek: ROUGE,
  eye: PAINT,
  cracks: false,
  edge: hex('#ffe08a'),
};

const GLAZE: Material = { ramp: ramp('#7e8698', '#b8c0d0', '#e2e8f2', '#f8fbff', '#ffffff'), outline: hex('#2a3040'), shine: true };
export const PORCELAIN_DOLL_LOOK: PuppetLook = {
  key: 'puppet_porcelain',
  head: GLAZE,
  wood: GLAZE,
  joint: GOLD,
  helm: SILVER,
  plume: { ramp: ramp('#123a6a', '#1e5aa0', '#3a8ad8', '#7ac0ff'), outline: hex('#081a34') },
  tabard: { ramp: ramp('#1e3a6a', '#2e5a9a', '#4a86c8', '#7ab4ec'), outline: hex('#0a1a34') },
  trim: SILVER,
  blade: { ramp: ramp('#2a4a7a', '#4a7ab8', '#8ac0f0', '#d8f0ff', '#ffffff'), outline: hex('#0e1a34'), shine: true },
  cheek: { ramp: ramp('#8ab4e0', '#b8d8f8'), outline: hex('#3a5a8a'), noOutline: true, noAO: true },
  eye: { ramp: ramp('#0e2a5a', '#1e4a8a'), outline: hex('#0e2a5a'), noOutline: true, noAO: true },
  cracks: true,
  edge: hex('#b8ecff'),
};

/** The Toymaker's nutcracker: a soldier in a red coat and white breeches, a black shako, a white beard and a gilt sabre. */
export const NUTCRACKER_LOOK: PuppetLook = {
  key: 'puppet_nutcracker',
  head: { ramp: ramp('#6a3a2a', '#a8684a', '#dc9a78', '#f6c8a4'), outline: hex('#2a140a'), shine: true },
  wood: { ramp: ramp('#3a0a10', '#6a1420', '#a02230', '#d04048', '#ee6a6a'), outline: hex('#1a0408'), shine: true },
  joint: GOLD,
  helm: { ramp: ramp('#050408', '#100c14', '#1e1824', '#2e2638', '#443a52'), outline: hex('#020203'), shine: true },
  plume: { ramp: ramp('#8a8698', '#c8c4d0', '#ece8f0', '#ffffff'), outline: hex('#2a2634') },
  tabard: { ramp: ramp('#3a0a10', '#6a1420', '#a02230', '#d04048', '#ee6a6a'), outline: hex('#1a0408') },
  trim: GOLD,
  blade: { ramp: ramp('#5b3418', '#9a6424', '#d6a044', '#f6d88a', '#fff6d0'), outline: hex('#1e1008'), shine: true },
  cheek: ROUGE,
  eye: PAINT,
  cracks: false,
  edge: hex('#ffd890'),
  shako: {
    beard: { ramp: ramp('#8a8698', '#c8c4d0', '#ece8f0', '#ffffff'), outline: hex('#2a2634') },
    legs: { ramp: ramp('#8a8698', '#c8c4d0', '#e8e4ec', '#fbfaff'), outline: hex('#2a2634') },
  },
};

export const PUPPET_LOOKS = [GALLANT_LOOK, PORCELAIN_DOLL_LOOK, NUTCRACKER_LOOK];

let P: PuppetLook = GALLANT_LOOK;

interface PuppetPose {
  /** Whole body raised, in pixels (a hop on its strings). */
  lift?: number;
  /** Lean forward (+) or back (-), in pixels at the head. */
  lean?: number;
  /** Legs swinging, -1..1 (front leg forward +). */
  legs?: number;
  /** Knees drawn up, 0..1 (limp, dangling). */
  tuck?: number;
  /** Sword arm: the blade's angle from pointing straight ahead, down is positive, in radians. */
  sword?: number;
  /** Shield arm, raised 0..1. */
  shield?: number;
  /** The blade's edge lit, 0..1. */
  flash?: number;
  /** For the pirouette: 'side' (facing right), 'front' or 'back'. */
  view?: 'side' | 'front' | 'back';
  /** The head lolls this far (px). */
  loll?: number;
}

/** Where its strings tie on, per `<look key>:<frame>`, from its feet: the head's top and the two hands. */
export const PUPPET_TIES = new Map<string, [number, number][]>();

function puppet(p: PuppetPose, name: string): PixelCanvas {
  const c = new PixelCanvas(PUPPET_FRAME.w, PUPPET_FRAME.h);
  const view = p.view ?? 'side';
  const L = -(p.lift ?? 0);
  const lean = p.lean ?? 0;
  const cx = 17;
  const tuck = p.tuck ?? 0;
  const lg = p.legs ?? 0;
  const loll = p.loll ?? 0;
  // Body landmarks (feet at y 37 before the lift).
  const hipY = 27 + L;
  const chestY = 20 + L;
  const neckY = 16 + L;
  const headX = cx + lean + (view === 'side' ? 0.5 : 0) + loll * 0.5;
  const headY = 12 + L + Math.abs(loll) * 0.3;
  const ties: [number, number][] = [];

  const jointBall = (x: number, y: number, r = 0.9, bias = 0) => {
    c.part();
    c.ellipse(x, y, r, r, P.joint, { bias });
  };
  const limb = (x0: number, y0: number, x1: number, y1: number, r0: number, r1: number, bias = 0) => {
    c.part();
    c.capsule(x0, y0, x1, y1, r0, r1, P.wood, { bias });
  };
  const legAt = (hx: number, swing: number, bias: number) => {
    const kx = hx + swing * 2.2;
    const ky = hipY + 4.2 - tuck * 1.6;
    const fx = hx + swing * 3.2 - tuck * swing;
    const fy = 36.4 + L - tuck * 3;
    const legMat = P.shako?.legs ?? P.wood;
    c.part();
    c.capsule(hx, hipY + 0.5, kx, ky, 1.1, 1.0, legMat, { bias });
    jointBall(kx, ky, 0.9, bias);
    c.part();
    c.capsule(kx, ky, fx, fy - 0.8, 1.0, 0.9, legMat, { bias });
    c.part();
    // A little painted boot.
    c.ellipse(fx + (view === 'side' ? 0.7 : 0), fy, view === 'side' ? 1.7 : 1.3, 1.05, BOOT, { bias });
  };

  // The sword arm (near, right side) and the shield arm (far).
  const swordA = p.sword ?? 1.1;
  const sh = p.shield ?? 0;
  const nearShoulder: [number, number] = view === 'side' ? [cx + 1.2 + lean * 0.6, chestY - 2.4] : [cx + 4.3, chestY - 2.2];
  const farShoulder: [number, number] = view === 'side' ? [cx - 1.8 + lean * 0.6, chestY - 2.8] : [cx - 4.3, chestY - 2.2];
  const swordHand = (): [number, number] => {
    // The hand swings with the blade: out ahead and round.
    const r = 5.4;
    const a = swordA * 0.85;
    return [nearShoulder[0] + Math.cos(a) * r * (view === 'back' ? -1 : 1) * (view === 'side' ? 1 : 0.9), nearShoulder[1] + Math.sin(a) * r];
  };
  const shieldHand = (): [number, number] => {
    if (view === 'side') return [farShoulder[0] + 2.8 + sh * 1.4, farShoulder[1] + 4.2 - sh * 3.6];
    return [farShoulder[0] - 1.4 - sh * 1.6, farShoulder[1] + 4.6 - sh * 3.4];
  };
  const [shx, shy] = shieldHand();
  const [swx, swy] = swordHand();

  const drawShieldArm = (bias: number) => {
    const ex = (farShoulder[0] + shx) / 2 - (view === 'side' ? 0.8 : 0.9);
    const ey = (farShoulder[1] + shy) / 2 + 0.6;
    limb(farShoulder[0], farShoulder[1], ex, ey, 1.0, 0.9, bias);
    jointBall(ex, ey, 0.8, bias);
    limb(ex, ey, shx, shy, 0.9, 0.8, bias);
    // A round shield, red and gold, with a boss.
    c.part();
    const sx = shx + (view === 'side' ? 1.4 : -0.6);
    const rx = view === 'side' ? 1.7 : 3;
    c.ellipse(sx, shy, rx, 3.1, P.tabard, { bias, normal: (_x, _y, dx, dy) => sphere(dx * 0.6, dy * 0.6, 1) });
    c.part();
    c.px(sx, shy, P.trim, sphere(0, -0.4), { bias });
    for (let a = 0; a < 8; a++) {
      const t = (a / 8) * Math.PI * 2;
      c.px(sx + Math.cos(t) * (rx - 0.6), shy + Math.sin(t) * 2.5, P.trim, sphere(Math.cos(t) * 0.5, Math.sin(t) * 0.5), { bias });
    }
  };
  const drawSwordArm = (bias: number) => {
    const bend = view === 'side' ? 1 : 0.6;
    const ex = (nearShoulder[0] + swx) / 2 + 0.4 * bend;
    const ey = (nearShoulder[1] + swy) / 2 + 1 * bend;
    limb(nearShoulder[0], nearShoulder[1], ex, ey, 1.0, 0.9, bias);
    jointBall(ex, ey, 0.8, bias);
    limb(ex, ey, swx, swy, 0.9, 0.8, bias);
    // The tin sword: a gold crossguard and a straight blade along its angle.
    const dx = Math.cos(swordA) * (view === 'back' ? -1 : 1);
    const dy = Math.sin(swordA);
    const len = view === 'side' ? 9.5 : 8;
    c.part();
    c.line(swx - dy * 1.6, swy + dx * 1.6, swx + dy * 1.6, swy - dx * 1.6, P.trim, () => sphere(0, -0.4), { bias });
    c.part();
    c.line(swx - dx * 1.2, swy - dy * 1.2, swx, swy, WALNUT, () => sphere(0, 0), { bias });
    c.part();
    const tipX = swx + dx * len;
    const tipY = swy + dy * len;
    c.line(swx + dx, swy + dy, tipX, tipY, P.blade, (i, n) => sphere(-dy * 0.4, 0.2 - i / n * 0.6), { bias });
    const fl = p.flash ?? 0;
    const [er, eg, eb] = P.edge;
    const edge: RGB = [er, eg, eb];
    for (let i = 2; i <= len; i++) c.spark(swx + dx * i, swy + dy * i, edge, 0.18 + fl * 0.75 * (i / len));
    if (fl > 0.4) {
      c.spark(tipX, tipY, [255, 255, 255], fl);
      c.spark(tipX + 1, tipY, edge, fl * 0.5);
      c.spark(tipX - 1, tipY, edge, fl * 0.5);
      c.spark(tipX, tipY - 1, edge, fl * 0.5);
    }
    c.part();
    c.ellipse(swx, swy, 1.0, 1.0, P.wood, { bias });
  };

  // Back to front: far limbs, body, near limbs.
  if (view === 'side') {
    drawShieldArm(-1);
    legAt(cx - 0.6, -lg, -1);
  } else if (view === 'back') {
    drawSwordArm(-1);
  }
  if (view !== 'side') {
    legAt(cx - 1.8, view === 'front' ? lg : -lg, 0);
    legAt(cx + 1.8, view === 'front' ? -lg : lg, 0);
  }

  // The hips: a wooden block on a ball joint.
  c.part();
  c.ellipse(cx + lean * 0.2, hipY, view === 'side' ? 2.4 : 3, 1.4, P.wood, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.6, 1) });
  jointBall(cx + lean * 0.3, hipY - 1.6, 1.1);
  // The chest: a barrel of wood under a red tabard with gold trim and a star.
  c.part();
  const top = Math.round(chestY - 3.4);
  const bot = Math.round(hipY - 1.4);
  const hw0 = view === 'side' ? 2.8 : 3.8;
  c.shape(top, bot + 1, (y) => {
    const u = (y - top) / (bot + 1 - top);
    const hw = hw0 - 0.6 * (u - 0.4) * (u - 0.4) * 2;
    const x = cx + lean * (1 - u) * 0.8;
    return [x - hw, x + hw];
  }, P.tabard, (_x, _y, t, u) => sphere(t * 0.9, u * 0.8 - 0.3, 1));
  c.part();
  for (let x = Math.floor(cx - hw0 - 1); x <= Math.ceil(cx + hw0 + 1); x++) {
    if (c.filled(x, bot + 1)) c.px(x, bot + 1, P.trim, sphere(0, 0.4));
    if (c.filled(x, top)) c.px(x, top, P.trim, sphere(0, -0.5));
  }
  if (view !== 'back') {
    // The gold star (or silver) on its chest.
    const sx = cx + lean * 0.5 + (view === 'side' ? 0.6 : 0);
    const sy = chestY;
    c.part();
    c.px(sx, sy, P.trim, sphere(0, -0.3));
    c.px(sx - 1, sy, P.trim, sphere(-0.4, 0));
    c.px(sx + 1, sy, P.trim, sphere(0.4, 0));
    c.px(sx, sy - 1, P.trim, sphere(0, -0.6));
    c.px(sx, sy + 1, P.trim, sphere(0, 0.4));
  } else {
    // The string's tie-off loop on its back.
    c.part();
    c.px(cx, chestY - 1, P.joint, sphere(0, -0.3));
  }
  // The neck peg and the head: a round wooden ball, painted.
  c.part();
  c.capsule(cx + lean * 0.8, neckY + 1.8, headX, headY + 3, 0.7, 0.7, P.joint);
  c.part();
  c.ellipse(headX, headY, 3.7, 3.5, P.head, { normal: (_x, _y, dx, dy) => sphere(dx * 0.95, dy * 0.9, 1) });
  if (view === 'side') {
    c.part();
    c.px(headX + 2, headY + 0.4, P.eye);
    c.px(headX + 1, headY + 2, P.cheek);
    c.px(headX + 2, headY + 2, P.cheek);
    // A painted smile curling to the cheek.
    c.px(headX + 3, headY + 2.4, P.eye);
    c.px(headX + 2, headY + 3, P.eye);
    // A round wooden nose.
    c.part();
    c.px(headX + 3.6, headY + 1, P.head, sphere(0.8, 0));
  } else if (view === 'front') {
    c.part();
    c.px(headX - 1.4, headY + 0.4, P.eye);
    c.px(headX + 1.4, headY + 0.4, P.eye);
    c.px(headX - 2.4, headY + 1.8, P.cheek);
    c.px(headX + 2.4, headY + 1.8, P.cheek);
    for (let x = -1; x <= 1; x++) c.px(headX + x, headY + 2.6 + (x === 0 ? 0.6 : 0), P.eye);
  }
  if (P.shako) {
    // The nutcracker's great white beard and the dark line of its jaw.
    c.part();
    if (view === 'side') {
      c.shape(Math.round(headY + 2), Math.round(headY + 4), (y) => [headX - 1 + (y - headY - 2) * 0.6, headX + 3.8 - (y - headY - 2) * 0.5], P.shako.beard, (_x, _y, t, u) => sphere(t * 0.8, u - 0.2, 1));
      c.part();
      c.px(headX + 2, headY + 2, P.eye);
      c.px(headX + 3, headY + 2, P.eye);
    } else if (view === 'front') {
      c.shape(Math.round(headY + 2), Math.round(headY + 4), (y) => {
        const hw = 3.6 - (y - headY - 2) * 0.8;
        return [headX - hw, headX + hw];
      }, P.shako.beard, (_x, _y, t, u) => sphere(t * 0.9, u - 0.2, 1));
      c.part();
      for (let x = -1; x <= 1; x++) c.px(headX + x, headY + 2, P.eye);
    }
  }
  if (P.cracks) {
    // Fine cracks in the glaze.
    c.shade(headX - 1, headY - 2, -2);
    c.shade(headX - 2, headY - 1, -2);
    c.shade(headX - 2, headY, -1);
    c.shade(cx + 2, chestY + 3, -2);
  }
  if (P.shako) {
    // A tall black shako with a gold plate and chinstrap trim, a white pompom on top.
    c.part();
    c.shape(Math.round(headY - 6.6), Math.round(headY - 1.6), (y) => {
      const u = (y - (headY - 6.6)) / 5;
      const hw = 3.1 - u * 0.5;
      return [headX - hw, headX + hw];
    }, P.helm, (_x, _y, t) => cyl(t, 0.1));
    c.part();
    c.shape(Math.round(headY - 1.4), Math.round(headY - 1.4), () => [headX - 3.4 + (view === 'side' ? 0 : 0), headX + (view === 'side' ? 4.4 : 3.4)], P.helm, (_x, _y, t) => cyl(t, 0.3), { bias: 1 });
    c.part();
    for (let x = Math.round(headX - 3); x <= Math.round(headX + 2); x++) if (c.filled(x, Math.round(headY - 6.6))) c.px(x, Math.round(headY - 6.6), P.trim, sphere(0, -0.5));
    if (view !== 'back') {
      const gx = headX + (view === 'side' ? 1.4 : -0.5);
      c.px(gx, headY - 4, P.trim, sphere(0, -0.3));
      c.px(gx + 1, headY - 4, P.trim, sphere(0.3, -0.3));
      c.px(gx, headY - 3, P.trim, sphere(0, 0.2));
      c.px(gx + 1, headY - 3, P.trim, sphere(0.3, 0.2));
    }
    c.part();
    c.ellipse(headX - 0.3, headY - 7.6, 1.4, 1.2, P.plume, { normal: (_x, _y, dx, dy) => sphere(dx, dy - 0.2, 1) });
    ties.push([headX, headY - 8.6]);
  } else {
  // The tin helm: a round cap with a brim, a red plume standing up and back.
  c.part();
  c.shape(Math.round(headY - 4.2), Math.round(headY - 1.6), (y) => {
    const u = (y - (headY - 4.2)) / 2.6;
    const hw = 2.2 + Math.sqrt(Math.max(0, u)) * 1.8;
    return [headX - hw, headX + hw];
  }, P.helm, (_x, _y, t, u) => sphere(t * 0.9, u * 0.7 - 0.6, 1));
  c.part();
  c.shape(Math.round(headY - 1.4), Math.round(headY - 1.4), () => [headX - 4.2, headX + 4.2], P.helm, (_x, _y, t) => cyl(t, 0.3), { bias: -1 });
  c.part();
  const back = view === 'side' ? -1 : 0;
  for (let i = 0; i <= 7; i++) {
    const k = i / 7;
    const px = headX - 0.4 + back * k * 3.4;
    const py = headY - 4.4 - k * 4.4 + k * k * 1.8;
    c.px(px, py, P.plume, sphere(-0.3, -0.6 + k), { bias: k > 0.8 ? -1 : 0 });
    c.px(px + 1, py, P.plume, sphere(0.4, -0.2 + k));
    if (k > 0.3 && k < 0.85) c.px(px + back, py + 1, P.plume, sphere(0, 0.5), { bias: -1 });
  }
  ties.push([headX, headY - 4.5]);
  }

  // Near limbs last.
  if (view === 'side') {
    legAt(cx + 0.6, lg, 0);
    drawSwordArm(0);
  } else if (view === 'front') {
    drawShieldArm(0);
    drawSwordArm(0);
  } else {
    drawShieldArm(0);
  }
  ties.push([swx, swy], [shx, shy]);
  PUPPET_TIES.set(`${P.key}:${name}_r`, ties.map(([x, y]) => [x - PUPPET_FRAME.ox, y - PUPPET_FRAME.oy]));
  PUPPET_TIES.set(`${P.key}:${name}_l`, ties.map(([x, y]) => [PUPPET_FRAME.ox - x - 1, y - PUPPET_FRAME.oy]));
  return c;
}

/** The puppet's sheet, in one look: anims idle, walk, strike, chop, spin and slump. */
export function buildPuppetSheet(look: PuppetLook): MonsterSheet {
  P = look;
  const poses: Record<string, () => PixelCanvas> = {};
  const add = (name: string, p: PuppetPose) => (poses[name] = () => puppet(p, name));
  // Dangling at ease: it sways on its strings, limbs loose.
  add('idle0', { legs: 0.1, sword: 1.2, lean: 0 });
  add('idle1', { legs: 0.2, sword: 1.15, lean: 0.4, lift: 0.5, loll: 0.4 });
  add('idle2', { legs: 0.1, sword: 1.2, lean: 0.2, lift: 1 });
  add('idle3', { legs: -0.1, sword: 1.25, lean: -0.2, lift: 0.5, loll: -0.4 });
  // A jaunty marionette's walk: big stiff strides, bouncing on the strings.
  add('walk0', { legs: 0.9, sword: 1.0, lean: 0.8, lift: 1.5 });
  add('walk1', { legs: 0, sword: 1.2, lean: 0.4, lift: 0 });
  add('walk2', { legs: -0.9, sword: 1.3, lean: 0.8, lift: 1.5 });
  add('walk3', { legs: 0, sword: 1.2, lean: 0.4, lift: 0 });
  // The strike: sword raised back over the helm, then cut down across.
  add('strike0', { legs: -0.4, sword: -2.2, lean: -1, shield: 0.5 });
  add('strike1', { legs: 0.6, sword: -0.6, lean: 1.2, shield: 0.3, flash: 0.6, lift: 1 });
  add('strike2', { legs: 0.8, sword: 0.7, lean: 1.6, shield: 0.2, flash: 1 });
  add('strike3', { legs: 0.4, sword: 1.0, lean: 0.8, flash: 0.3 });
  // The chop: a leap on its strings, the blade high, then down with all its weight.
  add('chop0', { legs: -0.3, sword: -2.4, lean: -1.4, tuck: 0.3, lift: 2, shield: 0.8 });
  add('chop1', { legs: 0.2, sword: -1.9, lean: -0.6, tuck: 0.8, lift: 6, shield: 0.8, flash: 0.4 });
  add('chop2', { legs: 0.9, sword: 1.2, lean: 2, tuck: 0.2, lift: 1, flash: 1 });
  add('chop3', { legs: 0.6, sword: 1.3, lean: 1.4, flash: 0.4 });
  // The pirouette: turning on the tip of a toe, the sword held straight out.
  add('spin0', { view: 'side', legs: 0.3, tuck: 0.4, sword: 0, flash: 0.9, lift: 2, shield: 0.6 });
  add('spin1', { view: 'front', legs: 0.2, tuck: 0.4, sword: 0, flash: 0.9, lift: 2, shield: 0.6 });
  add('spin2', { view: 'back', legs: 0.3, tuck: 0.4, sword: 0, flash: 0.9, lift: 2, shield: 0.6 });
  add('spin3', { view: 'front', legs: -0.2, tuck: 0.4, sword: Math.PI, flash: 0.9, lift: 2, shield: 0.6 });
  // Slumped on slack strings.
  add('slump0', { legs: 0.3, tuck: 1, sword: 1.5, lean: 2, loll: 2 });
  const sh = sheet(PUPPET_FRAME, poses, [
    { name: 'idle', frames: ['idle0', 'idle1', 'idle2', 'idle3'], fps: 5, loop: true },
    { name: 'walk', frames: ['walk0', 'walk1', 'walk2', 'walk3'], fps: 10, loop: true },
    { name: 'strike', frames: ['strike0', 'strike1', 'strike2', 'strike3'], fps: 16, loop: false },
    { name: 'chop', frames: ['chop0', 'chop1', 'chop2', 'chop3'], fps: 12, loop: false },
    { name: 'spin', frames: ['spin0', 'spin1', 'spin2', 'spin3'], fps: 18, loop: true },
    { name: 'slump', frames: ['slump0'], fps: 1, loop: false },
  ]);
  P = GALLANT_LOOK;
  return sh;
}

/** Frame index in 'strike' and 'chop' where the blade lands. */
export const PUPPET_STRIKE_FRAME = 2;

// ---------------------------------------------------------------------------
// Ability icons (16x16)

/** The puppet strike: a little tin sword on a string, from a cross above. */
export function puppetStrikeIcon(dark: boolean, toy = false): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  const wood = dark ? ['#dcdcec', '#8a8a9a'] : ['#b87030', '#5a2c10'];
  const str = toy ? '#ff7a5a' : dark ? '#b8ecff' : '#ffe08a';
  for (let x = 3; x <= 12; x++) put(x, 2, wood[0]);
  for (let y = 0; y <= 4; y++) put(8, y, wood[1]);
  for (let y = 3; y <= 8; y++) put(4, y, str);
  for (let y = 3; y <= 6; y++) put(12, y, str);
  // The blade, slanting down from the hilt.
  for (let i = 0; i < 8; i++) {
    put(5 + i, 15 - i, toy ? '#fff6d0' : dark ? '#d8f0ff' : '#eef2fa');
    put(6 + i, 15 - i, toy ? '#d6a044' : dark ? '#4a7ab8' : '#7e8498');
  }
  for (const [x, y] of [[3, 11], [4, 12], [6, 14], [7, 15]]) put(x, y, toy ? '#d04048' : dark ? '#c4cadf' : '#f4cf6a');
  put(4, 9, '#f8f2da');
  put(12, 7, '#f8f2da');
  outline('#140a06');
  return px;
}

/** The pirouette: a spinning puppet's blade sweeping a circle. */
export function pirouetteIcon(dark: boolean, toy = false): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  const hot = toy ? '#ffd890' : dark ? '#b8ecff' : '#ffe08a';
  const mid = toy ? '#ff5a4a' : dark ? '#5ec8ff' : '#ffb040';
  for (let a = 0; a < 40; a++) {
    const t = (a / 40) * Math.PI * 2;
    const r = 6.2;
    put(Math.round(8 + Math.cos(t) * r), Math.round(9 + Math.sin(t) * r * 0.55), a % 10 < 6 ? hot : mid);
  }
  // A little figure on its toe in the middle.
  for (let y = 4; y <= 7; y++) for (let x = 7; x <= 9; x++) put(x, y, dark ? '#f8fbff' : '#dcae6e');
  for (let y = 8; y <= 11; y++) put(8, y, dark ? '#4a86c8' : '#a02230');
  put(7, 9, dark ? '#4a86c8' : '#a02230');
  put(9, 9, dark ? '#4a86c8' : '#a02230');
  put(8, 12, '#33242a');
  put(8, 3, toy ? '#1e1824' : dark ? '#c4cadf' : '#b8bece');
  put(8, 2, toy ? '#ffffff' : dark ? '#3a8ad8' : '#d04048');
  if (toy) for (const [x, y] of [[7, 3], [9, 3], [7, 4], [8, 4], [9, 4]]) put(x, y, '#1e1824');
  outline('#140a06');
  return px;
}

/** The razor thread: a needle trailing a curling, shining thread (Luna's sheds motes of moth dust). */
export function threadIcon(core: string, hot: string, mid: string, dust = false): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  for (let i = 0; i < 16; i++) {
    const x = i;
    const y = Math.round(10 + Math.sin(i * 0.7) * 2.4 - i * 0.35);
    put(x, y, i > 10 ? core : i > 5 ? hot : mid);
  }
  // The needle at its head, and its eye.
  for (let i = 0; i < 5; i++) put(11 + i, 4 - Math.round(i * 0.6), '#eef2fa');
  put(11, 5, '#7e8498');
  put(15, 1, '#ffffff');
  outline('#0e0818');
  if (dust) for (const [x, y] of [[3, 6], [6, 14], [8, 6], [1, 14], [12, 13]]) put(x, y, y > 10 ? mid : '#fffbe8');
  return px;
}

/** The marionette: a foe dangling from three strings under a cross. */
export function marionetteIcon(core: string, hot: string, mid: string): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  for (let x = 2; x <= 13; x++) put(x, 1, '#906a42');
  for (let y = 0; y <= 3; y++) put(8, y, '#6e4a2c');
  for (const [x, y1] of [[3, 7], [8, 6], [13, 7]]) for (let y = 2; y <= y1; y++) put(x, y, y % 2 ? hot : core);
  // The strung-up foe: a round, startled blob with dangling feet.
  for (let y = 7; y <= 13; y++) for (let x = 3; x <= 13; x++) if (Math.hypot((x - 8) / 5, (y - 10) / 3.4) <= 1) put(x, y, x + y < 17 ? '#8ad67a' : '#4a9a4a');
  put(6, 9, '#0c0816');
  put(10, 9, '#0c0816');
  put(8, 11, '#0c0816');
  put(6, 14, '#2a5a2a');
  put(10, 14, '#2a5a2a');
  put(6, 15, '#2a5a2a');
  put(10, 15, '#2a5a2a');
  outline('#0e0818');
  put(3, 7, mid);
  put(13, 7, mid);
  return px;
}

/**
 * Luna Moth's snare: a luna moth of light, wings spread and tails trailing,
 * three strings of moonsilk falling from it onto a startled foe, and dust
 * drifting down.
 */
export function mothSnareIcon(): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  const WING = ['#64a48a', '#9cd6b8', '#d0f4e0'];
  for (const s of [-1, 1]) {
    // Forewing up and out, hindwing below it, a tail trailing down; rows of (y, from, to) out from the body.
    const at = (o: number) => (s < 0 ? 7 - o : 8 + o);
    for (const [y, o0, o1] of [[0, 4, 7], [1, 1, 7], [2, 1, 6], [3, 1, 4], [4, 1, 4], [5, 2, 4], [6, 3, 4], [7, 4, 4]] as const) {
      for (let o = o0; o <= o1; o++) put(at(o), y, o === o1 || y === 0 ? WING[2] : (o + y) % 3 === 0 ? WING[0] : WING[1]);
    }
    put(at(3), 2, '#d09a40');
    put(at(2), 4, '#d09a40');
    for (let o = 1; o <= 3; o++) put(at(o), 1, '#a06a8e');
  }
  for (let y = 1; y <= 5; y++) for (const x of [7, 8]) put(x, y, y < 3 ? '#ffffff' : '#e6e2d6');
  put(6, 0, '#e0d09c');
  put(9, 0, '#e0d09c');
  for (const [x, y1] of [[4, 9], [8, 8], [11, 9]]) for (let y = x === 8 ? 6 : 8; y <= y1; y++) put(x, y, y % 2 ? '#c8f5dc' : '#f6fff8');
  // The strung-up foe.
  for (let y = 8; y <= 14; y++) for (let x = 3; x <= 13; x++) if (Math.hypot((x - 8) / 5, (y - 11) / 3.2) <= 1) put(x, y, x + y < 18 ? '#8ad67a' : '#4a9a4a');
  put(6, 10, '#0c0816');
  put(10, 10, '#0c0816');
  put(8, 12, '#0c0816');
  put(6, 15, '#2a5a2a');
  put(10, 15, '#2a5a2a');
  outline('#0e1a16');
  for (const [x, y] of [[1, 9], [14, 11], [2, 13]]) put(x, y, '#fffbe8');
  return px;
}
