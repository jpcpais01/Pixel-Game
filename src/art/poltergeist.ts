// The Poltergeist: a round, mischievous sheet-ghost floating over the
// ground, big black eyes and a toothy grin, stubby sheet arms, its hem
// rippling and a little tail curling under it. Its Tea Party skin is a
// Victorian ghost girl on the same float: a porcelain face in a lavender
// bonnet tied with a pink bow, pale ringlets, a bodice with puffed sleeves,
// a lace-frilled skirt fading into mist and a parasol over her shoulder.
// Its Banshee skin is the wailing spirit: very long white-silver hair
// streaming in a wind only she feels, a hollow pale face with dark sunken
// eyes and a mouth stretched wide in a wail, a silver comb in her hair, a
// tattered sea-green shroud fading into mist, and thin arms reaching out
// with long bony fingers.
//
// Also here: the haunted things it throws (a chair, a book, a candlestick, a
// pot, a trunk for the big throw; for the tea party a cup, a saucer, a jug of
// milk and the teapot; for the Banshee a silver comb, a cracked hand mirror,
// a funeral urn, a tarnished bell and a coffin), and the icons.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB } from './pixel';
import { DIRS, type Dir } from './wizard';
import { icon16, seg, type Tones } from './druid';

const ramp = (...c: string[]): RGB[] => c.map(hex);

export const POLTER_W = 48;
export const POLTER_H = 50;
/** Drawn in the 24x32 body box every hero uses, placed in a larger frame. */
const BODY_X = 12;
const BODY_Y = 12;
export const POLTER_ORIGIN_X = BODY_X + 12;
export const POLTER_ORIGIN_Y = BODY_Y + 31;
/** The body's middle above the ground, where throws start. */
export const POLTER_CHEST_Y = 14;

// ---------------------------------------------------------------------------
// Materials

export const SHEET: Material = { ramp: ramp('#34525e', '#5e8a94', '#94c0be', '#c6e6de', '#eafcf4'), outline: hex('#0e2228'), outlineLit: hex('#18343c'), emissive: 0.18, noAO: true };
export const MIST: Material = { ramp: ramp('#3e6470', '#78a8ac', '#b4e0d8'), outline: hex('#1a3a42'), emissive: 0.45, noAO: true, noOutline: true };
export const VOID: Material = { ramp: ramp('#05060a', '#0e1018', '#1c2030'), outline: hex('#020204'), shine: true, noAO: true };
const TOOTH: Material = { ramp: ramp('#b8c4c0', '#ffffff'), outline: hex('#05060a'), noAO: true };
const PATCH: Material = { ramp: ramp('#4a4e5e', '#707890', '#9aa2b8'), outline: hex('#1a1e28') };
const STITCH: Material = { ramp: ramp('#1e2230', '#2c3040'), outline: hex('#0c0e14'), noOutline: true };
export const BLUSH: Material = { ramp: ramp('#c05a7a', '#f08aa8'), outline: hex('#401420'), noOutline: true, noAO: true };

// The tea party.
const PORCELAIN: Material = { ramp: ramp('#6a6a82', '#9e9eb8', '#cfcfe2', '#f2f2fa'), outline: hex('#20203a'), outlineLit: hex('#2e2e4a'), shine: true, emissive: 0.1 };
const LAVENDER: Material = { ramp: ramp('#241a40', '#3e2e6a', '#5e4a96', '#8470be', '#aa98dc'), outline: hex('#0c0818'), outlineLit: hex('#1a1230'), emissive: 0.12 };
const LACE: Material = { ramp: ramp('#8a80a8', '#bcb4d4', '#e8e2f6'), outline: hex('#2a2244'), emissive: 0.15 };
const RIBBON: Material = { ramp: ramp('#6a1a44', '#b04474', '#e87aa6'), outline: hex('#24061a'), shine: true };
const RINGLET: Material = { ramp: ramp('#6a6040', '#a89c6a', '#d8cc98', '#f4ecc8'), outline: hex('#221e10'), emissive: 0.1 };
const DRESS_MIST: Material = { ramp: ramp('#4a3e7a', '#8070b4', '#bcb0e8'), outline: hex('#2a2244'), emissive: 0.45, noAO: true, noOutline: true };
const PARASOL: Material = { ramp: ramp('#7a5a70', '#b494a8', '#dcc4d2', '#f6e8f0'), outline: hex('#2a1624'), emissive: 0.1 };
const STICK: Material = { ramp: ramp('#2a1a0e', '#5a3a1e', '#8a6030'), outline: hex('#100804') };

// The Banshee.
const BAN_HAIR: Material = { ramp: ramp('#5a6872', '#8a9aa4', '#b2c0c6', '#d4e0e2', '#eef6f4'), outline: hex('#141c22'), outlineLit: hex('#222c34'), emissive: 0.15, shine: true };
const BAN_SKIN: Material = { ramp: ramp('#3e4e4a', '#6a827c', '#98b2aa', '#c0d6cc', '#e0eee6'), outline: hex('#0e1614'), outlineLit: hex('#1a2622'), emissive: 0.16 };
const SHROUD: Material = { ramp: ramp('#0c2624', '#16423c', '#246254', '#3c8670', '#62ac90'), outline: hex('#041210'), outlineLit: hex('#0a1e1a'), emissive: 0.08 };
const SHROUD_MIST: Material = { ramp: ramp('#244e46', '#4e8a78', '#90ccb4'), outline: hex('#0e2a24'), emissive: 0.45, noAO: true, noOutline: true };
const SILVER: Material = { ramp: ramp('#3a4448', '#6a7a7e', '#a8b8b8', '#dce8e4', '#ffffff'), outline: hex('#121a1c'), shine: true };
/** The sickly green-silver light in her sockets and on what she hurls. */
const SICK: Material = { ramp: ramp('#5a9a6a', '#b4f0b4', '#f2fff0'), outline: hex('#0e2a18'), emissive: 1, noAO: true, noOutline: true };
const SICK_GLOW: RGB = [190, 255, 200];

export interface PolterLook {
  key: string;
  tea: boolean;
  /** The Banshee: long streaming silver hair, a wailing face, a tattered shroud. */
  banshee?: boolean;
}

export const POLTER_LOOK: PolterLook = { key: 'polter', tea: false };
export const TEA_LOOK: PolterLook = { key: 'polter_tea', tea: true };
export const BANSHEE_LOOK: PolterLook = { key: 'polter_banshee', tea: false, banshee: true };
export const POLTER_LOOKS = [POLTER_LOOK, TEA_LOOK, BANSHEE_LOOK];

let L: PolterLook = POLTER_LOOK;

type View = 'down' | 'up' | 'side';

interface Pt {
  x: number;
  y: number;
}

export interface PolterPose {
  /** Floated up (+) or sunk. */
  bob: number;
  /** The hem's ripple, and the tail's sway. */
  wave: number;
  sway: number;
  /** Hands, relative to where they rest. */
  handA: Pt;
  handB: Pt;
  /** Leaning into its drift (side view), in px. */
  lean: number;
  /** 0..1: eyes wide and blazing (the Special); or squeezed shut in a grin (the throw). */
  glare: number;
  squint: boolean;
  /** Shaking (the rattle): the whole figure jitters this many px. */
  shake: number;
  /** The idle moment's peekaboo: the mouth thrown wide open (BOO!). */
  boo: boolean;
  /** The Tea Party's parasol: 0..1 lowered from her shoulder to hide her face, slid aside (px) to peek, and flung up high for the boo. */
  brolly: number;
  brollyX: number;
  raise: boolean;
  /** The Tea Party's hand held to her mouth as she giggles. */
  hush: boolean;
  /** The Banshee's silver comb taken from her hair into her hand, combing it. */
  comb: boolean;
}

const base = (): PolterPose => ({ bob: 0, wave: 0, sway: 0, handA: { x: 0, y: 0 }, handB: { x: 0, y: 0 }, lean: 0, glare: 0, squint: false, shake: 0, boo: false, brolly: 0, brollyX: 0, raise: false, hush: false, comb: false });

// ---------------------------------------------------------------------------
// The sheet-ghost (body-box coordinates: 24 wide, the ground at y 31; it floats)

/** The sheet: a dome over a body that flares a little, the hem rippling. */
function sheet(c: PixelCanvas, cx: number, top: number, bottom: number, r: number, wave: number, view: View): void {
  const hem = (x: number) => bottom + 1 + Math.sin((x - cx) * 1.1 + wave * 1.6) * 1;
  for (let y = Math.floor(top); y <= bottom + 2; y++) {
    const dy = top + r - (y + 0.5);
    const w = dy > 0 ? Math.sqrt(Math.max(0, r * r - dy * dy)) : r + (y - top - r) * 0.12;
    const lean = view === 'side' ? Math.max(0, y - top - r) * 0.2 : 0;
    for (let x = Math.floor(cx - w + lean); x < cx + w + lean; x++) {
      if (y > hem(x)) continue;
      const t = (x + 0.5 - cx - lean) / w;
      c.px(x, y, SHEET, dy > 0 ? sphere(t * 0.9, (dy / r) * 0.8, 1) : sphere(t * 0.9, -0.1 - ((y - top - r) / (bottom - top - r)) * 0.3, 1));
    }
  }
  // Folds falling from under the dome.
  for (let y = Math.round(top + r + 1); y <= bottom; y++) {
    c.shade(Math.round(cx - r * 0.45), y, -1);
    if (view !== 'side') c.shade(Math.round(cx + r * 0.45), y, -1);
  }
}

/** The tail curling under the hem, down to a point. */
function tail(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number): void {
  c.capsule(x0, y0, (x0 + x1) / 2 + 0.6, (y0 + y1) / 2, 1.7, 1.1, MIST);
  c.capsule((x0 + x1) / 2 + 0.6, (y0 + y1) / 2, x1, y1, 1.1, 0.4, MIST);
}

function face(c: PixelCanvas, cx: number, cy: number, p: PolterPose, side: boolean): void {
  c.part();
  const eyes = side ? [cx - 2.6] : [cx - 2, cx + 2];
  for (const ex of eyes) {
    if (p.squint) {
      c.px(Math.round(ex - 1), Math.round(cy + 0.5), VOID);
      c.px(Math.round(ex), Math.round(cy - 0.5), VOID);
      if (!side) c.px(Math.round(ex + 1), Math.round(cy + 0.5), VOID);
      continue;
    }
    c.ellipse(ex, cy, side ? 0.9 : 1.1, 1.6 + p.glare * 0.4, VOID);
    c.px(Math.round(ex - 0.5), Math.round(cy - 0.8), TOOTH, { x: -0.3, y: 0.5, z: 0.8 });
    if (p.glare > 0) c.spark(ex, cy + 0.5, [160, 255, 220], p.glare * 0.8);
  }
  if (p.boo && !side) {
    // BOO: the mouth thrown wide open, a tooth hanging in it.
    c.ellipse(cx - 0.25, cy + 3.6, 1.9, 1.7, VOID);
    c.px(Math.round(cx - 1), Math.round(cy + 2.4), TOOTH);
    c.px(Math.round(cx + 0.5), Math.round(cy + 2.4), TOOTH);
    c.px(Math.round(cx - 3.8), Math.round(cy + 2), BLUSH);
    c.px(Math.round(cx + 3.4), Math.round(cy + 2), BLUSH);
    return;
  }
  // The grin, a tooth poking down.
  const my = Math.round(cy + 3);
  const mx0 = side ? cx - 4 : cx - 2;
  const mx1 = side ? cx - 1.5 : cx + 1.5;
  for (let x = Math.round(mx0); x <= mx1; x++) c.px(x, x === Math.round(mx0) || x === Math.round(mx1) ? my - 1 : my, VOID, { x: 0, y: 0, z: 1 });
  c.px(Math.round((mx0 + mx1) / 2), my + 1, TOOTH);
  if (!side) {
    c.px(Math.round(cx - 3.8), Math.round(cy + 2), BLUSH);
    c.px(Math.round(cx + 3.4), Math.round(cy + 2), BLUSH);
  }
}

function sheetArm(c: PixelCanvas, sx: number, sy: number, hand: Pt): void {
  c.capsule(sx, sy, hand.x, hand.y, 1.4, 1.2, SHEET);
}

function drawSheetGhost(c: PixelCanvas, p: PolterPose, view: View): void {
  const top = 9 - p.bob;
  const bottom = 23 - p.bob;
  const cx = 12 - (view === 'side' ? p.lean : 0);
  c.part();
  if (view === 'side') tail(c, cx + 3, bottom, cx + 8, bottom - 2 + p.sway);
  else tail(c, cx, bottom + 1, cx + 2 + p.sway * 0.6, bottom + 6);
  if (view === 'side') {
    c.part();
    sheetArm(c, cx + 1, top + 9, { x: cx + 3 + p.handB.x, y: top + 11 + p.handB.y });
  }
  c.part();
  sheet(c, cx, top, bottom, view === 'side' ? 5.4 : 6.2, p.wave, view);
  if (view === 'down') face(c, cx, top + 6, p, false);
  else if (view === 'side') face(c, cx, top + 6, p, true);
  else {
    // A patch sewn on the back.
    c.part();
    for (let y = Math.round(top + 8); y <= top + 11; y++) for (let x = 10; x <= 13; x++) c.px(x, y, PATCH, { x: 0, y: 0.1, z: 1 });
    for (const [x, y] of [[10, top + 8], [13, top + 8], [10, top + 11], [13, top + 11]]) c.px(Math.round(x), Math.round(y), STITCH);
  }
  c.part();
  if (view === 'side') sheetArm(c, cx - 1.5, top + 9, { x: cx - 4 + p.handA.x, y: top + 12 + p.handA.y });
  else {
    sheetArm(c, cx - 5.2, top + 8.5, { x: cx - 7.2 + p.handA.x, y: top + 11.5 + p.handA.y });
    sheetArm(c, cx + 5.2, top + 8.5, { x: cx + 7.2 + p.handB.x, y: top + 11.5 + p.handB.y });
    // Hands brought up over its face (the idle moment's peekaboo): a mitten
    // each, lit on top, with a shadow cast on the face under it so it reads
    // as a hand and not as more sheet.
    for (const [s, h] of [[-1, p.handA], [1, p.handB]] as const) {
      if (h.y > -4.5 || Math.abs(h.x) < 3) continue;
      const hx = cx + s * 7.2 + h.x;
      const hy = top + 11.5 + h.y;
      for (let x = Math.round(hx - 1.5); x <= hx + 1; x++) c.shade(x, Math.round(hy + 2), -1);
      c.part();
      c.ellipse(hx, hy, 1.6, 1.5, SHEET, { bias: 1 });
    }
  }
}

// ---------------------------------------------------------------------------
// The tea party girl

function parasol(c: PixelCanvas, hx: number, hy: number, tx: number, ty: number, view: View): void {
  c.part();
  c.line(hx, hy, tx, ty + 1, STICK);
  c.part();
  const rx = view === 'side' ? 5 : 5.8;
  const ry = 3.2;
  for (let y = Math.floor(ty - ry); y <= ty + 1; y++) {
    for (let x = Math.floor(tx - rx); x <= tx + rx; x++) {
      const dx = (x + 0.5 - tx) / rx;
      const dy = (y + 0.5 - ty) / ry;
      const scallop = y + 0.5 - ty > 0 ? Math.abs(Math.sin((x - tx) * 0.9)) < 0.55 : true;
      if (dx * dx + dy * dy > 1 || !scallop) continue;
      const rib = Math.abs(((x + 0.5 - tx) / 2) % 1) < 0.2;
      c.px(x, y, PARASOL, sphere(dx * 0.9, dy * 0.8, 1), { bias: rib ? -1 : 0 });
    }
  }
  c.px(Math.round(tx), Math.round(ty - ry - 0.5), STICK);
}

function drawTeaGirl(c: PixelCanvas, p: PolterPose, view: View): void {
  const b = p.bob;
  const side = view === 'side';
  const cx = 12 - (side ? p.lean : 0);
  const headY = 10.2 - b;
  const waist = 20 - b;
  const hem = 26 - b;

  // The parasol over her shoulder, held in the back hand.
  const phx = side ? cx + 2.5 + p.handB.x : cx + 5.5 + p.handB.x;
  const phy = waist - 1 + p.handB.y;
  // Its tip: over her shoulder; in the idle moment flung up high, or lowered in front of her face to hide behind.
  let tx = side ? cx + 5 : cx + 6.5;
  let ty = headY - 4.5;
  if (p.raise) {
    tx = cx + 8;
    ty = headY - 7;
  }
  if (p.brolly > 0) {
    tx += (cx + 0.5 + p.brollyX - tx) * p.brolly;
    ty += (headY + 2 - ty) * p.brolly;
  }
  const hiding = p.brolly >= 0.5;
  if (view !== 'up' && !hiding) parasol(c, phx, phy, tx, ty, view);

  // Ringlets behind the face.
  c.part();
  if (!side) for (const s of [-1, 1]) c.capsule(cx + s * 3.9, headY + 1, cx + s * 4.3, headY + 5, 1, 0.8, RINGLET);
  else c.capsule(cx + 2.6, headY + 1, cx + 3.2, headY + 5, 1, 0.8, RINGLET);

  // The skirt, flaring, its lace frills, fading to mist at the hem.
  c.part();
  c.shape(Math.round(waist), Math.round(hem), (y) => {
    const u = (y - waist) / (hem - waist);
    const hw = side ? 3 + u * 3.2 : 3.4 + u * u * 3.6 + u * 0.6;
    return [cx - hw + (side ? u : 0), cx + hw + (side ? u * 1.5 : 0)];
  }, LAVENDER, (_x, y, t) => sphere(t * 0.9, 0.2 - ((y - waist) / (hem - waist)) * 0.3, 1));
  for (let y = Math.round(waist + 2); y <= hem; y++) {
    const u = (y - waist) / (hem - waist);
    c.shade(Math.round(cx - 2 - u), y, -1);
    if (!side) c.shade(Math.round(cx + 2 + u), y, -1);
  }
  c.part();
  for (const fy of [Math.round(waist + 3), Math.round(hem)]) {
    const u = (fy - waist) / (hem - waist);
    const hw = side ? 3 + u * 3.2 : 3.4 + u * u * 3.6 + u * 0.6;
    for (let x = Math.round(cx - hw); x < cx + hw + (side ? 1.5 : 0); x++) if (c.filled(x, fy) || fy === Math.round(hem)) c.px(x, fy, LACE, sphere(0, 0.3));
  }
  // Mist trailing from the hem, dithered away.
  for (let y = Math.round(hem + 1); y <= hem + 4; y++) {
    const k = (y - hem) / 4;
    const hw = (side ? 5.5 : 6.8) * (1 - k * 0.55);
    for (let x = Math.round(cx - hw); x < cx + hw; x++) {
      if ((x + y + Math.round(p.wave * 2)) % (k < 0.4 ? 2 : 3) !== 0) continue;
      c.px(x, y, DRESS_MIST, { x: 0, y: 0, z: 1 });
    }
  }

  // The bodice and puffed sleeves.
  c.part();
  c.shape(Math.round(waist - 5), Math.round(waist), (y) => {
    const k = (y - waist + 5) / 5;
    const hw = side ? 2.4 : 3.1 - k * 0.6;
    return [cx - hw, cx + hw];
  }, LAVENDER, (_x, _y, t) => cyl(t, 0.3));
  c.part();
  if (side) c.ellipse(cx, waist - 4, 1.8, 1.5, LAVENDER);
  else for (const s of [-1, 1]) c.ellipse(cx + s * 3.4, waist - 4, 1.7, 1.5, LAVENDER);
  for (let x = Math.round(cx - 1.5); x <= cx + 1; x++) c.px(x, Math.round(waist - 5), LACE);

  // Arms: the front hand free (it throws), the back one on the parasol.
  c.part();
  if (side) c.capsule(cx - 0.5, waist - 3, cx - 2.5 + p.handA.x, waist - 0.5 + p.handA.y, 0.8, 0.7, PORCELAIN);
  else {
    c.capsule(cx - 3.6, waist - 3, cx - 4.8 + p.handA.x, waist - 0.5 + p.handA.y, 0.8, 0.7, PORCELAIN);
    c.capsule(cx + 3.6, waist - 3, phx, phy, 0.8, 0.7, PORCELAIN);
  }

  // The bonnet, and the face in it.
  c.part();
  c.ellipse(cx + (side ? 0.8 : 0), headY - 0.3, side ? 4.3 : 4.9, 4.5, LAVENDER, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  c.part();
  for (let i = 0; i < 14; i++) {
    const a = Math.PI + (i / 13) * Math.PI;
    if (side && Math.cos(a) > 0.3) continue;
    c.px(Math.round(cx + Math.cos(a) * 4.5), Math.round(headY - 0.3 + Math.sin(a) * 4.2), LACE, sphere(Math.cos(a) * 0.5, 0.4));
  }
  if (view !== 'up') {
    c.part();
    c.ellipse(cx - (side ? 1.2 : 0), headY + 0.6, side ? 2.4 : 3, 3, PORCELAIN, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.8 - 0.1, 1) });
    c.part();
    const eyes = side ? [cx - 2.4] : [cx - 1.3, cx + 1.3];
    for (const ex of eyes) {
      if (p.squint) c.px(Math.round(ex), Math.round(headY + 0.6), VOID);
      else {
        c.px(Math.round(ex - 0.5), Math.round(headY + 0.2), VOID);
        c.px(Math.round(ex - 0.5), Math.round(headY + 1.2), VOID);
        if (p.glare > 0) c.spark(ex, headY + 0.6, [230, 200, 255], p.glare);
      }
    }
    if (!side) {
      c.px(Math.round(cx - 2.4), Math.round(headY + 2), BLUSH);
      c.px(Math.round(cx + 1.8), Math.round(headY + 2), BLUSH);
    } else c.px(Math.round(cx - 3), Math.round(headY + 2), BLUSH);
    // The bow under her chin.
    c.part();
    const bx = side ? cx - 0.8 : cx - 0.5;
    for (const s of side ? [1] : [-1, 1]) c.ellipse(bx + s * 1.3, headY + 4.2, 1, 0.7, RIBBON);
    c.px(Math.round(bx), Math.round(headY + 4), RIBBON);
    if (p.boo && !side) {
      // BOO: a little round o of a mouth.
      c.part();
      c.px(Math.round(cx - 1), Math.round(headY + 2.4), VOID);
      c.px(Math.round(cx), Math.round(headY + 2.4), VOID);
      c.px(Math.round(cx - 1), Math.round(headY + 3.2), VOID, { x: 0, y: 0, z: 1 }, { bias: 1 });
      c.px(Math.round(cx), Math.round(headY + 3.2), VOID, { x: 0, y: 0, z: 1 }, { bias: 1 });
    }
    // A hand raised to her mouth (the giggle), over her face.
    if (p.hush && !side) {
      c.part();
      c.ellipse(cx - 4.8 + p.handA.x, waist - 0.5 + p.handA.y, 1.1, 1, PORCELAIN);
    }
    if (hiding) parasol(c, phx, phy, tx, ty, view);
  } else {
    c.part();
    c.ellipse(cx - 0.5, headY + 3.6, 1.2, 0.8, RIBBON);
    c.capsule(cx - 1, headY + 4, cx - 1.8, headY + 8, 0.6, 0.4, RIBBON);
    c.capsule(cx, headY + 4, cx + 0.8, headY + 8, 0.6, 0.4, RIBBON);
    parasol(c, phx, phy, cx + 4, headY - 3.5, view);
  }
}

// ---------------------------------------------------------------------------
// The Banshee

/** A steady 0..1 per pixel, so ragged edges stay put from frame to frame. */
const hash = (x: number, y: number): number => {
  const h = Math.imul(Math.round(x) * 374761393 + Math.round(y) * 668265263, 1274126177) >>> 0;
  return (((h ^ (h >>> 13)) >>> 0) % 1000) / 1000;
};

/**
 * Her hair: a long fall of white-silver from the crown to below her waist,
 * in strands (every third a shade darker) that ripple in a wind only she
 * feels, their tips ragged. Facing away it covers her whole back; side on it
 * streams out behind her.
 */
function bansheeHair(c: PixelCanvas, cx: number, headY: number, bottom: number, wave: number, view: View): void {
  const side = view === 'side';
  const top = Math.round(headY - 4.4);
  for (let y = top; y <= bottom; y++) {
    const u = (y - top) / (bottom - top);
    // Wider as it falls; side on, it streams back (to the right: she faces left).
    // (Rounded over the crown.)
    const crown = Math.min(1, 0.6 + (y - top) * 0.2);
    const hw = (view === 'up' ? 3.4 + u * 3.4 : 4.4 + Math.min(1, u * 2.2) * 1.6 + u * 0.8) * crown;
    const ripple = Math.sin(wave * 1.6 + y * 0.5) * u * 1.3;
    const l = side ? cx - 2.6 + u * 1.2 + ripple : cx - hw + ripple;
    const r = side ? cx + 3.2 + u * 6.5 + ripple * 1.4 : cx + hw + ripple;
    for (let x = Math.floor(l); x < r; x++) {
      // Ragged tips: each strand ends at its own length.
      if (y > bottom - 4 + hash(x, 3) * 4) continue;
      const t = ((x + 0.5 - l) / Math.max(1, r - l)) * 2 - 1;
      const strand = (x + Math.round(ripple) + 99) % 3 === 0 ? -1 : 0;
      c.px(x, y, BAN_HAIR, sphere(t * 0.35, u < 0.2 ? -0.6 + u * 2 : 0.1, 1), { bias: strand + (u > 0.85 ? -1 : 0) });
    }
  }
}

/** A thin arm reaching out: a torn shroud sleeve to the elbow, a bony forearm, long fingers spread the way it reaches. */
function reachingArm(c: PixelCanvas, sx: number, sy: number, hx: number, hy: number, wave: number): void {
  const ex = sx + (hx - sx) * 0.45;
  const ey = sy + (hy - sy) * 0.45;
  c.capsule(sx, sy, hx, hy, 0.7, 0.55, BAN_SKIN);
  c.part();
  c.capsule(sx, sy, ex, ey, 1.2, 1.1, SHROUD);
  // The sleeve's torn end hangs in two strips.
  for (const d of [-0.6, 0.6]) {
    const n = 2 + Math.round(hash(sx + d * 3, sy) * 1.5);
    for (let i = 1; i <= n; i++) c.px(ex + d, ey + 0.6 + i + (i === n ? Math.round(Math.sin(wave + d * 3) * 0.6) : 0), i === n ? SHROUD_MIST : SHROUD, sphere(d * 0.6, 0.2));
  }
  c.part();
  // The fingers: three long thin ones, spread round the way the arm reaches.
  const dx = hx - sx;
  const dy = hy - sy;
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l;
  const uy = dy / l;
  for (const f of [-0.75, 0, 0.75]) {
    const fx = ux - uy * f;
    const fy = uy + ux * f;
    for (let i = 1; i <= (f === 0 ? 2.6 : 2); i++) c.px(hx + fx * i, hy + fy * i, BAN_SKIN, sphere(fx * 0.5, -0.3), { bias: i > 1.5 ? -1 : 0 });
  }
}

/** The silver comb: a small bar with its teeth, at (x, y), lying flat across. */
function silverComb(c: PixelCanvas, x: number, y: number): void {
  c.part();
  for (let i = -1; i <= 1; i++) c.px(x + i, y, SILVER, sphere(i * 0.4, -0.6));
  for (const i of [-1, 1]) c.px(x + i, y + 1, SILVER, sphere(0, 0.4), { bias: -1 });
}

/** The hollow face: pale and long, sockets dark with a sickly light at the back of them, the mouth stretched wide in a wail. */
function wailingFace(c: PixelCanvas, cx: number, headY: number, p: PolterPose, side: boolean): void {
  const open = p.boo ? 1 : 0;
  const fx = side ? cx - 1.1 : cx;
  c.part();
  c.ellipse(fx, headY + 1.1 + open * 0.4, side ? 2.3 : 2.9, 3.7 + open * 0.5, BAN_SKIN, { normal: (_x, _y, dx, dy) => sphere(dx * 0.7, dy * 0.35 - 0.25, 1) });
  // Her brow shadowing the sockets.
  for (let x = Math.round(fx - 2); x <= fx + 1; x++) c.shade(x, Math.round(headY - 0.8), -1);
  // Sunken cheeks.
  if (!side) for (const s of [-1, 1]) c.shade(Math.round(cx + s * 1.9 - 0.5), Math.round(headY + 2.2), -1);
  else c.shade(Math.round(cx - 0.5), Math.round(headY + 2.2), -1);
  c.part();
  const eyes = side ? [cx - 2.3] : [cx - 1.5, cx + 1.5];
  for (const ex of eyes) {
    const x = Math.round(ex - 0.5);
    c.px(x, Math.round(headY + 0.2), VOID);
    c.px(x, Math.round(headY + 1.2), VOID);
    if (p.squint) continue;
    // A sickly glint deep in each socket, burning up when she wails.
    c.px(x, Math.round(headY + 1.2), SICK, { x: 0, y: 0, z: 1 }, { glow: 0.35 + p.glare * 0.6, bias: -1 });
    c.spark(x, headY + 1, SICK_GLOW, 0.25 + p.glare * 0.6);
  }
  // The mouth: a long dark O, dropping wider and lower in the full wail.
  const mx = side ? cx - 2.6 : cx - 0.5;
  const m0 = Math.round(headY + 2.6);
  const m1 = Math.round(headY + 3.8 + open * 1.2);
  for (let y = m0; y <= m1; y++) {
    const wide = !side && (open ? y > m0 && y < m1 : y === m0 + 1);
    c.px(Math.round(mx), y, VOID, { x: 0, y: 0, z: 1 });
    if (!side) c.px(Math.round(mx) + 1, y, VOID, { x: 0, y: 0, z: 1 });
    if (wide) c.px(Math.round(mx) - 1, y, VOID, { x: 0, y: 0, z: 1 });
  }
}

function drawBanshee(c: PixelCanvas, p: PolterPose, view: View): void {
  const b = p.bob;
  const side = view === 'side';
  const cx = 12 - (side ? p.lean : 0);
  const headY = 9.6 - b;
  const neck = headY + 4.8;
  const hem = 25 - b;
  // In the wail her hair lifts and flies out round her.
  const flare = p.boo ? 1.5 : 0;

  // Where her hands rest, reaching a little out and forward; and her shoulders.
  const shoulder = neck + 1.4;
  const restA = side ? { x: cx - 5.5, y: neck + 5.5 } : { x: cx - 6.6, y: neck + 6 };
  const restB = side ? { x: cx + 1.5, y: neck + 6.5 } : { x: cx + 6.6, y: neck + 6 };
  const hA = { x: restA.x + p.handA.x, y: restA.y + p.handA.y };
  const hB = { x: restB.x + p.handB.x, y: restB.y + p.handB.y };

  if (view !== 'up') {
    c.part();
    bansheeHair(c, cx, headY - flare, Math.round(hem - 2 - flare * 2), p.wave + (side ? 1 : 0), view);
  }
  if (side) {
    c.part();
    reachingArm(c, cx + 1, shoulder, hB.x, hB.y, p.wave);
  }

  // The shroud: narrow at the shoulders, falling wide, torn into strips at the hem that thin into mist.
  c.part();
  const edge = (y: number): [number, number] => {
    const u = (y - neck) / (hem - neck);
    const hw = side ? 2.6 + u * 2.8 : 3.2 + Math.pow(u, 1.3) * 3.2;
    const back = side ? u * 1.4 : 0;
    return [cx - hw + back * 0.3, cx + hw + back];
  };
  c.shape(Math.round(neck), Math.round(hem), edge, SHROUD, (_x, y, t) => sphere(t * 0.9, 0.3 - ((y - neck) / (hem - neck)) * 0.6, 1));
  for (let y = Math.round(neck + 2); y <= hem; y++) {
    const u = (y - neck) / (hem - neck);
    c.shade(Math.round(cx - 1.8 - u * 1.4), y, -1);
    if (!side) c.shade(Math.round(cx + 1.6 + u * 1.4), y, -1);
  }
  // Rents in the cloth.
  for (const [hx, hy] of side ? [[cx + 1.5, hem - 3]] : [[cx - 3, hem - 2], [cx + 2.5, hem - 5]]) {
    c.shade(Math.round(hx), Math.round(hy), -2);
    c.shade(Math.round(hx), Math.round(hy) + 1, -2);
  }
  c.part();
  const [l, r] = edge(hem);
  for (let x = Math.round(l); x < r; x++) {
    const n = 1 + Math.round(hash(x, 11) * 3);
    for (let i = 1; i <= n + 2; i++) {
      const y = Math.round(hem + i);
      const drift = side ? Math.round((i / (n + 2)) * 1.5) : Math.round(Math.sin(x * 0.9 + p.wave * 1.6) * (i / (n + 2)));
      if (i <= n) c.px(x + drift, y, i === n ? SHROUD_MIST : SHROUD, sphere(0, -0.3));
      else if ((x + y + Math.round(p.wave * 2)) % 2 === 0) c.px(x + drift, y, SHROUD_MIST, { x: 0, y: 0, z: 1 });
    }
  }
  // A cowl of the shroud gathered round her shoulders.
  c.part();
  c.shape(Math.round(neck), Math.round(neck + 1), (y) => (y === Math.round(neck) ? [cx - 2.4, cx + 2.4 + (side ? 0.5 : 0)] : [cx - 3.4, cx + 3.4 + (side ? 0.5 : 0)]), SHROUD, (_x, _y, t) => cyl(t, -0.4), { bias: 1 });

  if (view === 'up') {
    // From behind: her arms out to the sides, and her hair over all of her back.
    c.part();
    reachingArm(c, cx - 3.2, shoulder, hA.x, hA.y, p.wave);
    reachingArm(c, cx + 3.2, shoulder, hB.x, hB.y, p.wave);
    c.part();
    bansheeHair(c, cx, headY - flare, Math.round(hem - 1 - flare * 2), p.wave, view);
    if (!p.comb) silverComb(c, cx + 2, headY - 2);
    return;
  }

  // Her arms, thin and reaching.
  c.part();
  if (side) reachingArm(c, cx - 1, shoulder, hA.x, hA.y, p.wave);
  else {
    reachingArm(c, cx - 3.2, shoulder, hA.x, hA.y, p.wave);
    reachingArm(c, cx + 3.2, shoulder, hB.x, hB.y, p.wave);
  }

  wailingFace(c, cx, headY, p, side);
  // Her hair over her crown, parted in the middle, leaving her face clear.
  c.part();
  const crown = Math.round(headY - 4.4);
  const brow = side ? headY - 1 : headY - 2;
  for (let y = crown; y <= brow; y++) {
    const k = (y - crown) / (brow - crown);
    const hw = 2.4 + k * 1.1;
    const x0 = side ? cx - 2.9 + (1 - k) * 0.8 : cx - hw;
    const x1 = side ? cx + 3.4 : cx + hw;
    for (let x = Math.floor(x0); x < x1; x++) {
      const t = ((x + 0.5 - x0) / (x1 - x0)) * 2 - 1;
      const parting = !side && x === Math.round(cx - 0.5);
      c.px(x, y, BAN_HAIR, sphere(t * 0.6, -0.7 + k * 0.4, 1), { bias: parting ? -2 : (x + 99) % 3 === 0 ? -1 : 0 });
    }
  }
  // Strands falling past her cheeks, over the shroud.
  if (side) c.capsule(cx - 0.4, headY - 1, cx + 0.4, headY + 5, 0.9, 0.6, BAN_HAIR);
  else for (const s of [-1, 1]) c.capsule(cx + s * 3.5, headY - 1.5, cx + s * (3.4 + Math.sin(p.wave + s) * 0.4), neck + 3.5, 0.75, 0.55, BAN_HAIR);
  // The comb in her hair, or in her hand, combing it.
  if (!p.comb) silverComb(c, side ? cx + 1.5 : cx + 2.4, headY - 3);
  else silverComb(c, hB.x, hB.y - 1);
}

// ---------------------------------------------------------------------------
// Animations

export type PolterAnim = 'idle' | 'move' | 'throw' | 'rattle' | 'cast' | 'rest';

interface AnimDef {
  name: PolterAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => PolterPose[];
  /** Frame indices to play in order, when some are held or repeated. */
  order?: readonly number[];
}

const idle = (): PolterPose[] =>
  [0, 1, 2, 3].map((i) => {
    const p = base();
    p.bob = [0, 1, 1, 0][i];
    p.wave = i;
    p.sway = [0, 1, 0, -1][i];
    p.handA = { x: 0, y: [0, -1, -1, 0][i] };
    p.handB = { x: 0, y: [0, 0, -1, -1][i] };
    return p;
  });

/** Drifting: leaning into it, the tail streaming. */
const move = (view: View): PolterPose[] =>
  [0, 1, 2, 3].map((i) => {
    const p = base();
    p.bob = [1, 2, 2, 1][i];
    p.wave = i + 0.5;
    p.sway = view === 'side' ? [2, 1, 2, 3][i] : [1, 2, 1, 0][i];
    p.lean = view === 'side' ? 1 : 0;
    p.handA = view === 'side' ? { x: 1.5, y: -1 } : { x: 0, y: 1 };
    p.handB = view === 'side' ? { x: 1.5, y: 0 } : { x: 0, y: 1 };
    return p;
  });

/** A throw: the arm drawn back, then flung forward, with a gleeful squint. */
const toss = (view: View): PolterPose[] =>
  [0, 1, 2, 3].map((i) => {
    const p = base();
    p.bob = 1;
    p.squint = i >= 1 && i <= 2;
    const back = view === 'side' ? { x: 3.5, y: -4 } : view === 'down' ? { x: -1.5, y: -5.5 } : { x: -1.5, y: -3 };
    const fling = view === 'side' ? { x: -3.5, y: -2 } : view === 'down' ? { x: 1, y: 1.5 } : { x: 1, y: -6 };
    p.handA = i === 0 ? back : i === 3 ? { x: 0, y: 0 } : fling;
    p.lean = view === 'side' && i >= 1 && i <= 2 ? 1 : 0;
    p.wave = i;
    return p;
  });

/** The rattle: both arms thrown up and the whole ghost shaking. */
const rattle = (view: View): PolterPose[] =>
  [0, 1, 2, 3, 4].map((i) => {
    const p = base();
    const up = view === 'side' ? { x: -1, y: -6 } : { x: 0, y: -6 };
    p.handA = { ...up, x: up.x + (view === 'side' ? 0 : -1) };
    p.handB = { ...up, x: up.x + (view === 'side' ? 2 : 1) };
    p.shake = i % 2 ? 1 : -1;
    p.bob = i === 0 ? 0 : 2;
    p.glare = 0.5;
    p.wave = i * 1.5;
    return p;
  });

/** Its Special's pose: rising up, arms spread wide, eyes blazing. */
const cast = (view: View): PolterPose[] =>
  [0.3, 0.6, 1, 1, 1].map((k, i) => {
    const p = base();
    p.bob = Math.round(k * 3);
    p.glare = k;
    p.handA = view === 'side' ? { x: -1.5, y: -4 * k } : { x: -2 * k, y: -4 * k };
    p.handB = view === 'side' ? { x: 2, y: -4 * k } : { x: 2 * k, y: -4 * k };
    p.wave = i;
    p.sway = i % 2;
    return p;
  });

/**
 * The idle moment, facing the viewer only: peekaboo. It hides its eyes
 * behind its hands (the Tea Party behind her lowered parasol), sinks a
 * little, peeks out with one eye, ducks back, crouches... and pops up with
 * its arms flung wide and a big BOO, then giggles itself silly and settles.
 */
const rest = (view: View): PolterPose[] => {
  if (view !== 'down') return [];
  const at = (o: Partial<PolterPose>): PolterPose => ({ ...base(), ...o });
  if (L.tea) {
    const hold = { x: -2.5, y: 0 };
    return [
      at({}),
      at({ brolly: 0.4, handB: { x: -1.5, y: -1 }, wave: 1, sway: 1 }),
      at({ brolly: 1, handB: hold, bob: -1, wave: 2 }),
      at({ brolly: 1, handB: hold, bob: -1, wave: 3, sway: -1 }),
      at({ brolly: 1, brollyX: 4, handB: { x: -1, y: 0 }, bob: -1, wave: 4 }),
      at({ brolly: 1, handB: hold, bob: -2, wave: 5, sway: 1 }),
      at({ raise: true, handB: { x: 1, y: -5 }, handA: { x: -2, y: -4 }, boo: true, glare: 1, bob: 3, wave: 6 }),
      at({ raise: true, handB: { x: 1, y: -4 }, handA: { x: -1.5, y: -3 }, boo: true, glare: 0.6, bob: 2, wave: 7 }),
      at({ squint: true, hush: true, handA: { x: 3.4, y: -6.5 }, bob: 1, shake: 1, wave: 8 }),
      at({ squint: true, hush: true, handA: { x: 3.4, y: -6.5 }, bob: 1, shake: -1, wave: 9, sway: 1 }),
      at({ bob: 1, wave: 2, handA: { x: 0, y: -1 } }),
    ];
  }
  if (L.banshee) {
    // The Banshee instead takes the silver comb from her hair and combs it,
    // slow strokes, pauses, sinks as she draws breath... and keens, arms
    // flung up and her mouth dropped wide, sobbing the wail out in shudders.
    const shudder = { x: -2, y: -5 };
    return [
      at({}),
      at({ handB: { x: -1.5, y: -5 }, wave: 1, sway: 1 }),
      at({ comb: true, handB: { x: -3, y: -9 }, wave: 2 }),
      at({ comb: true, handB: { x: -2, y: -4.5 }, wave: 3, sway: -1 }),
      at({ comb: true, handB: { x: -2.5, y: -6.5 }, glare: 0.3, wave: 4 }),
      at({ handA: { x: 1, y: -1 }, handB: { x: -1, y: -1 }, bob: -1, glare: 0.5, wave: 5 }),
      at({ handA: { x: -1.5, y: -6.5 }, handB: { x: 1.5, y: -6.5 }, boo: true, glare: 1, bob: 3, wave: 6 }),
      at({ handA: shudder, handB: { x: 2, y: -5 }, boo: true, glare: 0.85, bob: 2, shake: 1, wave: 7 }),
      at({ handA: shudder, handB: { x: 2, y: -5 }, boo: true, glare: 0.6, bob: 2, shake: -1, wave: 8 }),
      at({ handA: { x: 0, y: -2 }, handB: { x: 0, y: -2 }, glare: 0.3, bob: 1, shake: 1, wave: 9 }),
      at({ bob: 1, wave: 2, handA: { x: 0, y: -1 }, handB: { x: 0, y: -1 } }),
    ];
  }
  // Its sheet hands: over the eyes, halfway there, and one dropped to peek.
  const eyeA = { x: 5.2, y: -5.5 };
  const eyeB = { x: -5.2, y: -5.5 };
  return [
    at({}),
    at({ handA: { x: 2.6, y: -3 }, handB: { x: -2.6, y: -3 }, wave: 1, sway: 1 }),
    at({ handA: eyeA, handB: eyeB, bob: -1, wave: 2 }),
    at({ handA: eyeA, handB: eyeB, bob: -1, wave: 3, sway: -1 }),
    at({ handA: { x: 4, y: -2 }, handB: eyeB, bob: -1, wave: 4 }),
    at({ handA: eyeA, handB: eyeB, bob: -2, wave: 5, sway: 1 }),
    at({ handA: { x: -2, y: -7 }, handB: { x: 2, y: -7 }, boo: true, glare: 1, bob: 3, wave: 6 }),
    at({ handA: { x: -1.5, y: -5.5 }, handB: { x: 1.5, y: -5.5 }, boo: true, glare: 0.6, bob: 2, wave: 7 }),
    at({ squint: true, handA: { x: 2.5, y: -1 }, handB: { x: -2.5, y: -1 }, bob: 1, shake: 1, wave: 8 }),
    at({ squint: true, handA: { x: 2.5, y: -1.5 }, handB: { x: -2.5, y: -1.5 }, bob: 1, shake: -1, wave: 9, sway: 1 }),
    at({ bob: 1, wave: 2, handA: { x: 0, y: -1 }, handB: { x: 0, y: -1 } }),
  ];
};

export const POLTER_ANIMS: AnimDef[] = [
  { name: 'idle', fps: 5, loop: true, poses: idle },
  { name: 'move', fps: 8, loop: true, poses: move },
  { name: 'throw', fps: 16, loop: false, poses: toss },
  { name: 'rattle', fps: 16, loop: false, poses: rattle },
  { name: 'cast', fps: 10, loop: false, poses: cast },
  { name: 'rest', fps: 8, loop: false, poses: rest, order: [0, 1, 2, 3, 2, 3, 2, 4, 4, 4, 3, 2, 3, 5, 5, 6, 6, 7, 7, 7, 8, 9, 8, 9, 8, 9, 10, 0] },
];

export interface PolterFrame {
  key: string;
  anim: PolterAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawFrame(dir: Dir, p: PolterPose): PixelCanvas {
  const c = new PixelCanvas(POLTER_W, POLTER_H).offset(BODY_X + p.shake, BODY_Y);
  const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
  if (L.tea) drawTeaGirl(c, p, view);
  else if (L.banshee) drawBanshee(c, p, view);
  else drawSheetGhost(c, p, view);
  return dir === 'right' ? c.mirrored() : c;
}

export function buildPolterFrames(look: PolterLook = POLTER_LOOK): PolterFrame[] {
  L = look;
  const out: PolterFrame[] = [];
  for (const a of POLTER_ANIMS) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, i) => out.push({ key: `${a.name}_${dir}_${i}`, anim: a.name, dir, canvas: drawFrame(dir, pose) }));
    }
  }
  L = POLTER_LOOK;
  return out;
}

// ---------------------------------------------------------------------------
// The haunted things it throws

export const HAUNT_SIZE = 16;
export type HauntKind = 'chair' | 'book' | 'candle' | 'pot' | 'trunk' | 'cup' | 'saucer' | 'jug' | 'teapot' | 'comb' | 'mirror' | 'urn' | 'bell' | 'coffin';
export const HAUNT_KINDS: HauntKind[] = ['chair', 'book', 'candle', 'pot', 'trunk', 'cup', 'saucer', 'jug', 'teapot', 'comb', 'mirror', 'urn', 'bell', 'coffin'];
/** The Banshee's things: a mourner's keepsakes, glowing sickly green-silver. */
const KEEPSAKES: HauntKind[] = ['comb', 'mirror', 'urn', 'bell', 'coffin'];

const OAK: Material = { ramp: ramp('#2e1a0c', '#5a361a', '#8a5a2e', '#b88448'), outline: hex('#120a04') };
const CLOTH: Material = { ramp: ramp('#3a0e1a', '#6a1a2e', '#a02e46', '#d05a6e'), outline: hex('#160408') };
const PAGE: Material = { ramp: ramp('#a89878', '#e0d4b0', '#fffae8'), outline: hex('#2a2010') };
const BRASS: Material = { ramp: ramp('#5a3a0e', '#a8761e', '#e8b440', '#fff0a0'), outline: hex('#1e1204'), shine: true };
const IRON: Material = { ramp: ramp('#15161c', '#2a2c36', '#464a58', '#6a7082'), outline: hex('#060608'), shine: true };
const FLAME: Material = { ramp: ramp('#ff8a2a', '#ffd860', '#fffbe0'), outline: hex('#5a2006'), emissive: 1, noAO: true, noOutline: true };
const CHINA: Material = { ramp: ramp('#8a92b4', '#c4cce4', '#f0f4ff', '#ffffff'), outline: hex('#20243a'), shine: true };
const CHINA_BLUE: Material = { ramp: ramp('#1a2a7a', '#3a5ad0'), outline: hex('#0a1030'), noOutline: true };
const TEA: Material = { ramp: ramp('#3a1a06', '#7a3e12'), outline: hex('#1a0a02'), noOutline: true };
const GLASS: Material = { ramp: ramp('#22403a', '#4a7a70', '#94c8b8', '#e0fff2'), outline: hex('#0a1a16'), shine: true, emissive: 0.3 };
const VERDIGRIS: Material = { ramp: ramp('#183e30', '#2e6a52', '#58a07e', '#9cd8b4'), outline: hex('#08180f'), shine: true };
const PEWTER: Material = { ramp: ramp('#262c30', '#454e54', '#6e7a80', '#a0acb0'), outline: hex('#0c1012'), shine: true };
const COFFIN_WOOD: Material = { ramp: ramp('#120a0e', '#24161c', '#3a2429', '#563640'), outline: hex('#050204') };

/**
 * A haunted thing, drawn upright in a HAUNT_SIZE square: a ghostly glow
 * clings round its edge (added in the world as its glow layer).
 */
export function hauntFrame(kind: HauntKind): PixelCanvas {
  const c = new PixelCanvas(HAUNT_SIZE, HAUNT_SIZE);
  const cx = 8;
  switch (kind) {
    case 'chair':
      c.capsule(4, 2, 4, 13, 0.8, 0.8, OAK);
      c.capsule(11, 7, 11, 13, 0.8, 0.8, OAK);
      c.capsule(6, 13, 6, 10, 0.7, 0.7, OAK);
      c.part();
      for (let y = 3; y <= 7; y += 2) c.line(4, y, 6, y, OAK);
      c.shape(8, 9, () => [4, 12.5], CLOTH, (_x, _y, t) => cyl(t, 0.6));
      break;
    case 'book':
      c.shape(4, 12, () => [3, 13], CLOTH, (_x, _y, t) => cyl(t * 0.3, 0.2));
      c.part();
      for (let y = 5; y <= 11; y++) c.px(12, y, PAGE, { x: 0.7, y: 0, z: 0.7 });
      c.line(4, 8, 11, 8, BRASS);
      c.px(7, 6, BRASS);
      c.px(8, 6, BRASS);
      break;
    case 'candle':
      c.ellipse(cx, 13, 3.5, 1.4, BRASS);
      c.capsule(cx, 13, cx, 7, 0.9, 0.9, BRASS);
      c.ellipse(cx, 7, 2.6, 1, BRASS);
      c.part();
      c.shape(3, 6, () => [cx - 0.8, cx + 1.2], PAGE, (_x, _y, t) => cyl(t, 0.2));
      c.part();
      c.ellipse(cx + 0.2, 1.5, 0.9, 1.4, FLAME);
      break;
    case 'pot':
      c.ellipse(cx, 9, 5, 4, IRON);
      c.part();
      c.ellipse(cx, 5.5, 4.2, 1.2, IRON, { flatten: 0.4 });
      c.capsule(2.5, 7, 1.5, 6, 0.6, 0.6, IRON);
      c.capsule(13.5, 7, 14.5, 6, 0.6, 0.6, IRON);
      break;
    case 'trunk':
      c.shape(5, 13, () => [1.5, 14.5], OAK, (_x, _y, t, u) => cyl(t * 0.6, 0.3 - u * 0.4));
      c.ellipse(cx, 5, 6.5, 2.5, OAK, { flatten: 0.6 });
      c.part();
      for (const x of [4, 12]) c.line(x, 4, x, 13, BRASS);
      c.px(cx, 8, BRASS);
      c.px(cx, 9, IRON);
      break;
    case 'cup':
      c.shape(6, 11, (y) => [cx - 3.5 + (y - 6) * 0.3, cx + 3.5 - (y - 6) * 0.3], CHINA, (_x, _y, t) => cyl(t, 0.2));
      c.ellipse(cx + 4.5, 8, 1.4, 1.8, CHINA);
      c.part();
      c.ellipse(cx, 6, 3.4, 0.9, TEA, { flatten: 0.3 });
      c.line(cx - 2, 9, cx + 2, 9, CHINA_BLUE);
      break;
    case 'saucer':
      c.ellipse(cx, 9, 6.5, 2.2, CHINA, { flatten: 0.5 });
      c.part();
      c.ellipse(cx, 8.5, 3, 0.9, CHINA);
      for (let x = 3; x <= 13; x += 2) c.px(x, 10, CHINA_BLUE);
      break;
    case 'jug':
      c.shape(4, 13, (y) => {
        const k = (y - 4) / 9;
        const hw = 2.4 + Math.sin(k * Math.PI) * 1.6;
        return [cx - hw, cx + hw];
      }, CHINA, (_x, _y, t) => cyl(t, 0.2));
      c.part();
      c.capsule(cx + 3, 6, cx + 5.5, 9, 0.7, 0.7, CHINA);
      c.px(cx - 3, 4, CHINA);
      c.line(cx - 2, 10, cx + 2, 10, CHINA_BLUE);
      break;
    case 'comb':
      // A long silver comb, a pearl set in its back.
      c.shape(4, 6, (y) => (y === 4 ? [3.5, 12.5] : [2.5, 13.5]), SILVER, (_x, _y, t, u) => sphere(t * 0.6, -0.6 + u * 0.8, 1));
      c.part();
      for (let x = 3; x <= 13; x += 2) c.line(x, 7, x, 11, SILVER, () => ({ x: 0, y: 0.3, z: 0.95 }));
      c.px(8, 4, GLASS, sphere(0, -0.5), { glow: 0.6 });
      break;
    case 'mirror':
      // A hand mirror in a silver frame, its glass cracked across.
      c.capsule(cx, 10, cx, 15, 1, 0.8, SILVER);
      c.part();
      c.ellipse(cx, 6, 4.4, 5, SILVER);
      c.part();
      c.ellipse(cx, 6, 3.2, 3.8, GLASS, { normal: (_x, _y, dx, dy) => sphere(dx * 0.5, dy * 0.5, 1) });
      c.part();
      c.line(5, 4, 8, 7, VOID);
      c.line(8, 7, 7, 9, VOID);
      c.line(8, 7, 11, 6, VOID);
      break;
    case 'urn':
      // A funeral urn of pewter, with a lid and two handles.
      c.shape(5, 14, (y) => {
        const k = (y - 5) / 9;
        const hw = 2 + Math.sin(k * Math.PI * 0.9) * 2.6;
        return [cx - hw, cx + hw];
      }, PEWTER, (_x, _y, t) => cyl(t, 0.1));
      c.part();
      c.ellipse(cx, 4.5, 2.8, 1, PEWTER, { flatten: 0.4 });
      c.px(cx - 1, 3, PEWTER, sphere(0, -0.8));
      c.px(cx, 3, PEWTER, sphere(0.3, -0.8));
      for (const s of [-1, 1]) c.capsule(cx + s * 4.2, 6, cx + s * 4.8, 9, 0.6, 0.6, PEWTER);
      for (let x = cx - 3; x <= cx + 2; x++) c.px(x, 11, VERDIGRIS, sphere(0, 0.2), { bias: x & 1 });
      break;
    case 'bell':
      // A mourner's hand bell gone green with age, its clapper hanging.
      c.capsule(cx, 1, cx, 4, 0.9, 0.9, COFFIN_WOOD);
      c.part();
      c.shape(4, 11, (y) => {
        const k = (y - 4) / 7;
        const hw = 1.8 + k * k * 3.4;
        return [cx - hw, cx + hw];
      }, VERDIGRIS, (_x, _y, t) => cyl(t, -0.1));
      c.part();
      c.ellipse(cx, 11.5, 5.2, 1, VERDIGRIS, { flatten: 0.4 });
      c.px(cx - 1, 13, PEWTER, sphere(0, 0.6));
      c.px(cx, 13, PEWTER, sphere(0.3, 0.6));
      break;
    case 'coffin':
      // A coffin, the long six-sided kind, a silver cross on its lid.
      c.shape(1, 15, (y) => {
        const hw = y < 5 ? 2.6 + (y - 1) * 0.7 : 5.4 - (y - 5) * 0.28;
        return [cx - hw, cx + hw];
      }, COFFIN_WOOD, (_x, _y, t, u) => sphere(t * 0.7, -0.3 + u * 0.4, 1));
      c.part();
      c.line(cx, 4, cx, 11, SILVER);
      c.line(cx - 2, 6, cx + 2, 6, SILVER);
      for (const [x, y] of [[cx - 4, 5], [cx + 3, 5], [cx - 3, 13], [cx + 2, 13]]) c.px(x, y, SILVER, sphere(0, -0.4));
      break;
    case 'teapot':
      c.ellipse(cx, 9, 5, 4, CHINA);
      c.part();
      c.capsule(cx - 4.5, 9, cx - 7, 5.5, 1, 0.6, CHINA);
      c.ellipse(cx + 5.5, 8.5, 1.5, 2.2, CHINA);
      c.ellipse(cx, 5, 2.4, 1, CHINA);
      c.px(cx, 3.5, CHINA);
      c.part();
      for (let x = cx - 3; x <= cx + 3; x += 2) c.px(x, 9, CHINA_BLUE);
      c.px(cx - 1, 11, CHINA_BLUE);
      c.px(cx + 1, 11, CHINA_BLUE);
      break;
  }
  // The haunting: a faint glow hugging its outline.
  const tea = kind === 'cup' || kind === 'saucer' || kind === 'jug' || kind === 'teapot';
  const keepsake = KEEPSAKES.includes(kind);
  const glow: RGB = tea ? [210, 190, 255] : keepsake ? SICK_GLOW : [150, 255, 210];
  if (keepsake) {
    // A wisp curling up off the top of it, as if something of the dead still clung there.
    let top = 0;
    const empty = (y: number): boolean => {
      for (let x = 0; x < HAUNT_SIZE; x++) if (c.filled(x, y)) return false;
      return true;
    };
    while (top < HAUNT_SIZE && empty(top)) top++;
    for (let i = 1; i <= 3; i++) c.spark(cx - 1 + Math.round(Math.sin(i * 1.7) * 1.5), top - i, SICK_GLOW, 0.55 - i * 0.12);
  }
  for (let y = 0; y < HAUNT_SIZE; y++) {
    for (let x = 0; x < HAUNT_SIZE; x++) {
      if (c.filled(x, y)) continue;
      if (c.filled(x - 1, y) || c.filled(x + 1, y) || c.filled(x, y - 1) || c.filled(x, y + 1)) c.spark(x, y, glow, 0.45);
    }
  }
  return c;
}

// ---------------------------------------------------------------------------
// Icons

const POLTER_TONES: Tones = [hex('#eefff8'), hex('#9ff0d4'), hex('#4ac8a0'), hex('#1a6a5a')];
const TEA_TONES: Tones = [hex('#fff4ff'), hex('#e0c8ff'), hex('#a888e0'), hex('#4a3a7a')];
const BANSHEE_TONES: Tones = [hex('#f6fff4'), hex('#d4f4c4'), hex('#8cc49a'), hex('#24443a')];

/** The Banshee's throw: her silver comb tumbling through the air, sickly wisps streaming behind. */
export function bansheeHurlIcon(): Uint8ClampedArray {
  const t = BANSHEE_TONES;
  const lit = hex('#e8f2f0');
  const dim = hex('#7a8a8e');
  return icon16((put) => {
    for (const [y, x0, x1] of [[6, 0, 3], [9, 1, 5], [12, 0, 4]] as const) seg(put, x0, y, x1, y, t[2]);
    for (const [x, y] of [[4, 5], [6, 8], [5, 11]]) put(x, y, t[1]);
    // The comb's back, a diagonal bar, and its teeth off one side.
    seg(put, 6, 4, 12, 10, lit);
    seg(put, 7, 4, 13, 10, lit);
    for (let k = 0; k <= 6; k += 2) seg(put, 6 + k, 5 + k, 4 + k, 7 + k, dim);
    put(9, 7, t[0]);
    // A wisp curling off it.
    for (const [x, y] of [[13, 7], [14, 5], [13, 3], [14, 2]]) put(x, y, t[1]);
  });
}

/** The Banshee's rattle: a wailing face, the keen spreading off it in rings. */
export function keenIcon(): Uint8ClampedArray {
  const t = BANSHEE_TONES;
  return icon16((put) => {
    for (const [r, c] of [[7.5, t[3]], [6, t[2]], [4.5, t[1]]] as const) {
      for (let i = 0; i <= 24; i++) {
        const a = Math.PI * (1.05 + (i / 24) * 0.9);
        put(8 + Math.cos(a) * r, 11 + Math.sin(a) * r * 0.85, c);
      }
    }
    // The face: pale and long, dark eyes, the mouth a long dark O.
    for (let y = 8; y <= 14; y++) for (let x = 6; x <= 10; x++) if ((x - 8) ** 2 / 6.5 + (y - 11) ** 2 / 11 <= 1) put(x, y, hex('#dceae6'));
    // Her silver hair, round the face and falling past it.
    for (let x = 6; x <= 10; x++) put(x, 7, hex('#e8f2f0'));
    for (let y = 8; y <= 15; y++) {
      put(5, y, hex('#c0ccd2'));
      put(11, y, hex('#c0ccd2'));
    }
    put(7, 10, hex('#05060a'));
    put(9, 10, hex('#05060a'));
    for (let y = 12; y <= 14; y++) put(8, y, hex('#05060a'));
    put(7, 11, t[1]);
    put(9, 11, t[1]);
  });
}

/** The throw: a haunted chair (or a teacup) tumbling through the air, streaks of ghost-light behind. */
export function hurlIcon(tea = false): Uint8ClampedArray {
  const t = tea ? TEA_TONES : POLTER_TONES;
  const wood: RGB = tea ? hex('#f0f4ff') : hex('#b88448');
  const dark: RGB = tea ? hex('#3a5ad0') : hex('#5a361a');
  return icon16((put) => {
    for (const [y, x0, x1] of [[5, 0, 4], [8, 1, 5], [11, 0, 3]] as const) seg(put, x0, y, x1, y, t[2]);
    if (tea) {
      for (let y = 5; y <= 11; y++) for (let x = 7 + (y - 5) * 0.2; x <= 14 - (y - 5) * 0.2; x++) put(x, y, y === 5 ? t[1] : wood);
      for (let y = 6; y <= 9; y++) put(15, y, wood);
      seg(put, 8, 9, 13, 9, dark);
      put(9, 3, t[0]);
      put(11, 2, t[1]);
    } else {
      // A chair, tipped over mid-flight.
      seg(put, 7, 3, 13, 9, wood);
      seg(put, 8, 3, 14, 9, dark);
      seg(put, 10, 9, 14, 13, wood);
      seg(put, 13, 9, 9, 13, wood);
      seg(put, 6, 6, 9, 3, wood);
    }
    for (const [x, y] of [[6, 14], [15, 3], [5, 2]]) put(x, y, t[0]);
  });
}

/** The rattle: things bursting up out of the ground in a ring. */
export function rattleIcon(tea = false): Uint8ClampedArray {
  const t = tea ? TEA_TONES : POLTER_TONES;
  return icon16((put) => {
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      put(8 + Math.cos(a) * 6.5, 11 + Math.sin(a) * 3, t[2]);
    }
    for (const [x, h] of [[3, 5], [8, 8], [13, 5], [5.5, 3], [10.5, 3]] as const) {
      seg(put, x, 11, x, 11 - h, t[1]);
      put(x, 10 - h, t[0]);
    }
  });
}
