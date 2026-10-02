// The Jedi, drawn procedurally from a small rig like the warrior.
//
// A knight of the Force: an oat tunic wrapped under a long brown robe, its
// hood lowered, and a saber of blue light. The Sith shares the rig: black
// robes with the hood raised, amber eyes in its shadow, and a saberstaff (a
// red blade out of each end of a long hilt) with moves of its own: sweeps
// that cut both ways, a spinning lunge, Force lightning and the Force grip.
//
// The body keeps to the 24x32 box; frames are larger so the blade can reach
// past it. Drawing functions work in body-box coordinates.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB, type Vec3 } from './pixel';
import {
  BOOT,
  EYE,
  HILT_DARK,
  HOOD_SHADOW,
  JEDI_HAIR,
  JEDI_ROBE,
  JEDI_TUNIC,
  LEATHER,
  MAGIC_CORE,
  MAGIC_HOT,
  MAGIC_MID,
  PALE_SKIN,
  SABER_BLUE,
  SABER_BLUE_GLOW,
  SABER_RED,
  SABER_RED_GLOW,
  SILVER,
  SITH_EYE,
  SITH_ROBE,
  SITH_TUNIC,
  SKIN,
  TROUSER,
} from './palette';
import { GUARD_GLOVE, GUARD_GOLD, GUARD_ROBE, GUARD_TUNIC, MASK, SABER_GOLD, SABER_GOLD_GLOW } from './heroSkins';
import {
  HORN,
  MASTER_ROBE,
  MASTER_TRIM,
  MASTER_TUNIC,
  MASTER_WHITE,
  SABER_EMBER,
  SABER_EMBER_GLOW,
  SABER_GREEN,
  SABER_GREEN_GLOW,
  WARLORD_GLOVE,
  WARLORD_INK,
  WARLORD_ROBE,
  WARLORD_SKIN,
  WARLORD_TRIM,
  WARLORD_TUNIC,
  EMPRESS_CROWN,
  EMPRESS_GEM,
  EMPRESS_GLOVE,
  EMPRESS_GOWN,
  EMPRESS_HAIR,
  EMPRESS_LIPS,
  EMPRESS_SILK,
  EMPRESS_SILVER,
  EMPRESS_SKIN,
  NOMAD_BRASS,
  NOMAD_CLOAK,
  NOMAD_GRIP,
  NOMAD_LENS,
  NOMAD_SCARF,
  NOMAD_SKIN,
  NOMAD_TUNIC,
  NOMAD_WRAP,
  SABER_AMETHYST,
  SABER_AMETHYST_GLOW,
  SABER_DUNE,
  SABER_DUNE_GLOW,
} from './sith';
import { DIRS, type Dir } from './wizard';

export const JEDI_W = 48;
export const JEDI_H = 50;
export const BODY_X = 12;
export const BODY_Y = 12;
/** Sprite origin in the frame: body centre, just under the boots. */
export const JEDI_ORIGIN_X = BODY_X + 12;
export const JEDI_ORIGIN_Y = BODY_Y + 31;
/** The chest's height above the origin, where swings are centred. */
export const CHEST_Y = 11;

export interface JediLook {
  /** Texture key; animations are `${key}_${anim}_${dir}`. */
  key: string;
  robe: Material;
  tunic: Material;
  /** Sash over the tunic at the waist. */
  sash: Material;
  skin: Material;
  hair: Material;
  /** Hood raised over the head (the face in shadow, glowing eyes). */
  hooded: boolean;
  blade: { core: Material; edge: Material };
  /** Halo drawn around the blade in the emissive layer. */
  bladeGlow: RGB;
  /** Force light gathered in the open palm: core, hot, mid. */
  force: [RGB, RGB, RGB];
  /**
   * The temple guard: a taller, pointed hood over a white mask with a dark
   * visor, gold edging down the robe and a long, gold-banded saber hilt.
   */
  guard?: boolean;
  /** The Sith's saberstaff: a blade out of each end of a long hilt held in the middle, and the Sith's moves. */
  staff?: boolean;
  /** Bare-headed with a crown of short horns and the face tattooed in this ink (the Warlord). */
  horns?: boolean;
  tattoo?: Material;
  /** A long beard (the Grand Master). */
  beard?: Material;
  /** Edging down the robe's open front. */
  trim?: Material;
  /** Gloved hands. */
  glove?: Material;
  /** The glow of eyes that shine (hooded or horned looks); defaults to the Force's hot colour. */
  eyeGlow?: RGB;
  /**
   * The Dune Nomad: the head bound in `wrap` with brass goggles pushed up on
   * it, a `scarf` over the mouth and round the shoulders, the cloak's hem
   * frayed to rags, and a worn hilt (tarnished `brass` caps, a leather grip).
   */
  nomad?: { wrap: Material; scarf: Material; brass: Material; lens: Material; grip: Material };
  /**
   * The Dark Empress: a tall spiked `crown` banded in `silver` with glowing
   * `gem`s, long hair, a high flared collar, a gown to the floor with a train
   * and a shimmer, and an ornate silver saberstaff set with a gem.
   */
  empress?: { crown: Material; silver: Material; gem: Material; lips: Material };
}

export const JEDI_LOOK: JediLook = {
  key: 'jedi',
  robe: JEDI_ROBE,
  tunic: JEDI_TUNIC,
  sash: LEATHER,
  skin: SKIN,
  hair: JEDI_HAIR,
  hooded: false,
  blade: SABER_BLUE,
  bladeGlow: SABER_BLUE_GLOW,
  force: [MAGIC_CORE, MAGIC_HOT, MAGIC_MID],
};

/** The Sith: black robes, the hood raised, a red saberstaff and violet lightning in the palm. */
export const SITH_LOOK: JediLook = {
  key: 'jedi_sith',
  robe: SITH_ROBE,
  tunic: SITH_TUNIC,
  sash: SITH_ROBE,
  skin: PALE_SKIN,
  hair: SITH_ROBE,
  hooded: true,
  blade: SABER_RED,
  bladeGlow: SABER_RED_GLOW,
  force: [hex('#fbf6ff'), hex('#d6b8ff'), hex('#9a6cff')],
  staff: true,
  eyeGlow: hex('#ffb23a'),
};

/** The Sith's Warlord skin: horned and tattooed, in black and old blood, with an ember-red saberstaff. */
export const WARLORD_LOOK: JediLook = {
  key: 'jedi_warlord',
  robe: WARLORD_ROBE,
  tunic: WARLORD_TUNIC,
  sash: WARLORD_TRIM,
  skin: WARLORD_SKIN,
  hair: WARLORD_SKIN,
  hooded: false,
  blade: SABER_EMBER,
  bladeGlow: SABER_EMBER_GLOW,
  force: [hex('#fff4ee'), hex('#ffa08a'), hex('#ff3a2a')],
  staff: true,
  horns: true,
  tattoo: WARLORD_INK,
  glove: WARLORD_GLOVE,
  trim: WARLORD_TRIM,
  eyeGlow: hex('#ffc84a'),
};

/** The Jedi knight's Grand Master skin: white hair and beard, indigo robes edged in silver, a green blade. */
export const MASTER_LOOK: JediLook = {
  key: 'jedi_master',
  robe: MASTER_ROBE,
  tunic: MASTER_TUNIC,
  sash: LEATHER,
  skin: SKIN,
  hair: MASTER_WHITE,
  hooded: false,
  blade: SABER_GREEN,
  bladeGlow: SABER_GREEN_GLOW,
  force: [hex('#ffffff'), hex('#dcffe4'), hex('#8ee8a4')],
  beard: MASTER_WHITE,
  trim: MASTER_TRIM,
};

/** The Jedi knight's Temple guard skin. */
export const GUARD_LOOK: JediLook = {
  key: 'jedi_guard',
  robe: GUARD_ROBE,
  tunic: GUARD_TUNIC,
  sash: GUARD_GOLD,
  skin: GUARD_GLOVE,
  hair: GUARD_ROBE,
  hooded: true,
  blade: SABER_GOLD,
  bladeGlow: SABER_GOLD_GLOW,
  force: [hex('#fffbe8'), hex('#ffe08a'), hex('#f0b030')],
  guard: true,
  trim: GUARD_GOLD,
};

/** The Jedi knight's Dune Nomad skin: sand-bleached rags and rust wraps, goggles and scarf, a sun-bleached cyan blade. */
export const NOMAD_LOOK: JediLook = {
  key: 'jedi_nomad',
  robe: NOMAD_CLOAK,
  tunic: NOMAD_TUNIC,
  sash: LEATHER,
  skin: NOMAD_SKIN,
  hair: NOMAD_WRAP,
  hooded: false,
  blade: SABER_DUNE,
  bladeGlow: SABER_DUNE_GLOW,
  force: [hex('#fffcf2'), hex('#d8f6f0'), hex('#8edcd4')],
  nomad: { wrap: NOMAD_WRAP, scarf: NOMAD_SCARF, brass: NOMAD_BRASS, lens: NOMAD_LENS, grip: NOMAD_GRIP },
};

/** The Sith's Dark Empress skin: spiked crown, flared collar, a black-and-amethyst gown in silver, a violet saberstaff. */
export const EMPRESS_LOOK: JediLook = {
  key: 'jedi_empress',
  robe: EMPRESS_GOWN,
  tunic: EMPRESS_SILK,
  sash: EMPRESS_SILVER,
  skin: EMPRESS_SKIN,
  hair: EMPRESS_HAIR,
  hooded: false,
  blade: SABER_AMETHYST,
  bladeGlow: SABER_AMETHYST_GLOW,
  force: [hex('#fff4ff'), hex('#f0b0ff'), hex('#d050ff')],
  staff: true,
  glove: EMPRESS_GLOVE,
  trim: EMPRESS_SILVER,
  eyeGlow: hex('#d890ff'),
  empress: { crown: EMPRESS_CROWN, silver: EMPRESS_SILVER, gem: EMPRESS_GEM, lips: EMPRESS_LIPS },
};

export const JEDI_LOOKS = [JEDI_LOOK, SITH_LOOK, GUARD_LOOK, MASTER_LOOK, WARLORD_LOOK, NOMAD_LOOK, EMPRESS_LOOK];

/** The look being drawn; set by buildJediFrames. */
let S: JediLook = JEDI_LOOK;

export interface Saber {
  /** Hand (grip) position in body pixels. */
  hx: number;
  hy: number;
  /** Degrees; 0 = blade straight up, positive turns clockwise. */
  angle: number;
  /** Blade length past the emitter. */
  len: number;
}

export interface Pose {
  /** Whole body raised (walk passing frames). */
  lift: number;
  /** Upper body lowered (breathing, crouching). */
  breath: number;
  /** Foot offsets. Side view: forward (+) / back (-). Front/back: lift. */
  footA: number;
  footB: number;
  /** Robe hem sway in pixels. */
  robe: number;
  /** Free-arm swing in pixels. */
  arm: number;
  /** Upper body shifted forward (side view), in pixels. */
  lean: number;
  saber: Saber;
  /** Saber, its arm and hand drawn behind the body. */
  saberBehind?: boolean;
  /** Free hand placed here instead of hanging at the side. */
  free?: { x: number; y: number };
  blink?: boolean;
  /** 0..1 Force light gathered in the free palm. */
  force: number;
  /** The saberstaff's back half drawn in front of the body (by default it's behind). */
  rearFront?: boolean;
  /** Lightning crawling off the free hand's fingers, re-struck by this seed (0: none). */
  crackle?: number;
  /** The saber is away (thrown by the Special): the saber hand is empty, held out guiding it. */
  bare?: boolean;
  /** 0..1 Force light in that empty hand while it guides the blade. */
  guide?: number;
  // The idle moment's (`rest`) extras, drawn facing the viewer only.
  /** 0..1 lowered into a cross-legged seat on the ground. */
  sit?: number;
  /** The saber let go, its blade put out, floating here in body pixels (the grip point). */
  hilt?: { x: number; y: number; angle: number };
  /** The head tipped this many pixels across and down. */
  headX?: number;
  headY?: number;
  /** The free arm drawn over the head (a hand raised before the face). */
  handFront?: boolean;
  /** Lightning crackling round a clenched fist instead of light in an open palm, re-struck by this seed. */
  fist?: number;
  /** Motes of the Force twinkling round him, set by this seed (0: none). */
  motes?: number;
  /** 0..1 shining eyes flaring brighter. */
  glare?: number;
}

export interface JediMeta {
  /** Blade tip and grip in frame pixels. */
  tipX: number;
  tipY: number;
  handX: number;
  handY: number;
  /** The free hand, where the Force leaves it. */
  palmX: number;
  palmY: number;
}

const RAD = Math.PI / 180;
const EMITTER = 1.8;
/** Sitting down cross-legged: how far the upper body sinks, and how far the robe pools out on the ground. */
const SIT_DROP = 6;
const SIT_POOL = 2.2;
/** How far the Empress's gown flares out at the floor, and how far her train trails behind her (side view). */
const GOWN_FLARE = 1.4;
const TRAIN = 3;
/** How many Force motes can hang round him as he meditates. */
const MOTES = 7;
/** The body's centre line. */
const cx0 = 12;
const FLAT_DOWN: Vec3 = { x: 0, y: -0.3, z: 0.95 };

// ---------------------------------------------------------------------------
// Shared parts

function each(x0: number, y0: number, x1: number, y1: number, fn: (x: number, y: number) => void): void {
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) fn(x, y);
}

/** How far the saberstaff's hilt reaches either side of the hand before its blades. */
const STAFF_HILT = 2.4;

const hash = (a: number, b: number, c = 0): number => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/**
 * Halo pixels of saberstaff blades drawn behind the body. Light pixels would
 * otherwise shine straight through the robe, so they wait until the frame is
 * drawn and only land where nothing solid covers them (see drawJediFrame).
 */
let hiddenHalo: [number, number, number][] = [];

/**
 * One blade and its hilt, out from the grip at (hx, hy) along `angle` (plus
 * 180 for the saberstaff's back half). A single saber's hilt runs back past
 * the hand; a saberstaff's reaches from the hand to its emitter, each half
 * drawing its own side.
 */
function drawBlade(c: PixelCanvas, s: Saber, back: boolean, hidden: boolean): { x: number; y: number } {
  const a = (s.angle + (back ? 180 : 0)) * RAD;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const px = -dy;
  const py = dx;
  const staff = !!S.staff;
  const emitter = staff ? STAFF_HILT : EMITTER;
  const end = emitter + s.len;
  const reach = end + 3;
  const box = (fn: (x: number, y: number, along: number, side: number) => void) =>
    each(s.hx - reach, s.hy - reach, s.hx + reach, s.hy + reach, (x, y) => {
      const rx = x + 0.5 - s.hx;
      const ry = y + 0.5 - s.hy;
      fn(x, y, rx * dx + ry * dy, rx * px + ry * py);
    });
  const facing = (sx: number, sy: number, z: number): Vec3 => {
    const l = Math.hypot(sx, sy, z) || 1;
    return { x: sx / l, y: -sy / l, z: z / l };
  };

  // Blade: a white core inside its colour, rounded at the tip, with a halo of light (none while put out).
  c.part();
  if (s.len > 0) box((x, y, along, side) => {
    if (along < emitter - 0.3 || along > end + 2.2) return;
    const rest = end - along;
    const d = Math.abs(side);
    const halo = rest < 0 ? Math.hypot(rest, side) : d;
    if (halo < 2.3 && (halo >= 1.05 || rest < -0.9)) {
      const k = halo < 1.6 ? 0.42 : 0.2;
      if (hidden && staff) hiddenHalo.push([x, y, k]);
      else c.spark(x, y, S.bladeGlow, k);
    }
    if (rest < -0.9) return;
    const hw = rest < 0.6 ? 0.75 : 1.05;
    if (d < 0.5 && rest > 0.1) c.px(x, y, S.blade.core, facing(-0.2, 0.3, 0.9));
    else if (d < hw) c.px(x, y, S.blade.edge, facing(-0.2, 0.3, 0.9), { bias: d > 0.8 ? -1 : 0 });
  });
  // Hilt: chrome with a dark grip, a brighter emitter shroud.
  c.part();
  const butt = staff ? 0 : S.guard ? -4.6 : -2.2;
  box((x, y, along, side) => {
    if (along < butt || along > emitter || Math.abs(side) > 0.62) return;
    const n = facing(px * side - 0.3, py * side + 0.3, 0.8);
    if (staff && S.empress) {
      // The Empress's: an obsidian grip, a silver collar, and an amethyst set round each emitter.
      if (along < 1.0) c.px(x, y, S.empress.crown, n);
      else if (along < emitter - 0.55) c.px(x, y, S.empress.silver, n, { bias: 1 });
      else c.px(x, y, S.empress.gem, n);
    } else if (staff) {
      // Out from the hand: the grip, a chrome collar, and the emitter's dark ring.
      if (along < 1.0) c.px(x, y, HILT_DARK, n);
      else if (along < emitter - 0.55) c.px(x, y, SILVER, n, { bias: 1 });
      else c.px(x, y, HILT_DARK, n, { bias: 1 });
    }
    // The guard's long hilt is banded in gold.
    else if (S.guard && along < -1.1) c.px(x, y, Math.round(along) % 2 ? GUARD_GOLD : HILT_DARK, n);
    // The Nomad's worn hilt: a grip bound in leather (its turns a pixel apart) between tarnished brass caps.
    else if (S.nomad) {
      if (along > -1.1 && along < 0.9) c.px(x, y, S.nomad.grip, n, { bias: Math.round(along * 2) % 2 ? -1 : 0 });
      else c.px(x, y, S.nomad.brass, n, { bias: along > 0 ? 0 : -1 });
    } else if (along > -1.1 && along < 0.9) c.px(x, y, HILT_DARK, n);
    else c.px(x, y, SILVER, n, { bias: along > 0 ? 1 : 0 });
  });
  return { x: s.hx + dx * end, y: s.hy + dy * end };
}

/**
 * A saber: a chrome hilt with dark grip bands and a blade of light with a
 * white core. A saberstaff draws both halves, or only its front ('main') or
 * back ('rear') half, so each can sit on its own side of the body. Returns
 * the front blade's tip.
 */
function drawSaber(c: PixelCanvas, s: Saber, half: 'both' | 'main' | 'rear' = 'both', hidden = false): { x: number; y: number } {
  if (!S.staff) return drawBlade(c, s, false, false);
  if (half === 'rear') {
    drawBlade(c, s, true, hidden);
    return { x: s.hx, y: s.hy };
  }
  const tip = drawBlade(c, s, false, hidden);
  if (half === 'both') drawBlade(c, s, true, hidden);
  return tip;
}

/** A wide robe sleeve from the shoulder, ending short of the hand. */
function sleeve(c: PixelCanvas, sx: number, sy: number, hx: number, hy: number, bias = 0): void {
  c.part();
  const vx = hx - sx;
  const vy = hy - sy;
  const l = Math.hypot(vx, vy) || 1;
  c.capsule(sx, sy, hx - (vx / l) * 1.1, hy - (vy / l) * 1.1, 1.4, 1.65, S.robe, { bias });
}

function hand(c: PixelCanvas, x: number, y: number): void {
  c.part();
  c.ellipse(x, y, 1.1, 1.1, S.glove ?? S.skin, { bias: S.hooded ? -1 : 0 });
}

/** Force light held in the open palm; with a `crackle` seed, forked lightning crawls off the fingers. */
function palm(c: PixelCanvas, x: number, y: number, k: number, crackle = 0): void {
  if (k <= 0) return;
  const [core, hot, mid] = S.force;
  c.spark(x, y, core, k);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + k * 2;
    const r = 1.6 + (i % 2) * 1.1 * k;
    c.spark(x + Math.cos(a) * r, y + Math.sin(a) * r, i % 2 ? mid : hot, k * (i % 2 ? 0.5 : 0.75));
  }
  if (!crackle) return;
  for (let b = 0; b < 3; b++) {
    let a = (b / 3) * Math.PI * 2 + hash(b, crackle, 1) * 2;
    let lx = x;
    let ly = y;
    for (let st = 0; st < 4; st++) {
      a += (hash(b, st, crackle) - 0.5) * 1.6;
      lx += Math.cos(a) * 1.3;
      ly += Math.sin(a) * 1.3;
      c.spark(lx, ly, st < 2 ? core : hot, 0.95 - st * 0.18);
    }
  }
}

/**
 * The saber hand with no saber in it, held out after the flying blade: the
 * sleeve, the open hand, and a faint thread of the Force round the fingers.
 * Returns the hand, where the blade would have been.
 */
function guideHand(c: PixelCanvas, sh: { x: number; y: number }, p: Pose): { x: number; y: number } {
  const { hx, hy } = p.saber;
  sleeve(c, sh.x, sh.y, hx, hy);
  hand(c, hx, hy);
  // Fingers spread: a knuckle pixel either side of the palm, a shade darker.
  c.part();
  c.px(hx - 1, hy - 1, S.glove ?? S.skin, sphere(-0.5, -0.6, 1));
  c.px(hx + 1, hy - 1, S.glove ?? S.skin, sphere(0.5, -0.6, 1));
  palm(c, hx, hy - 1, p.guide ?? 0);
  return { x: hx, y: hy };
}

/**
 * Lightning crackling round a clenched fist: short arcs jumping off the
 * knuckles and snapping back, now and then a longer one down the wrist.
 */
function fistSpark(c: PixelCanvas, x: number, y: number, k: number, seed: number): void {
  if (k <= 0 || !seed) return;
  const [core, hot, mid] = S.force;
  // A dim halo hugging the fist.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + seed;
    c.spark(x + Math.cos(a) * 1.9, y + Math.sin(a) * 1.9, mid, 0.22 * k);
  }
  const arcs = k > 1 ? 6 : k > 0.9 ? 5 : k > 0.5 ? 3 : 2;
  for (let b = 0; b < arcs; b++) {
    let a = hash(b, seed, 7) * Math.PI * 2;
    let lx = x + Math.cos(a) * 1.4;
    let ly = y + Math.sin(a) * 1.4;
    const steps = 2 + Math.floor(hash(b, seed, 9) * 3) + (k > 1 ? 1 : 0);
    for (let st = 0; st < steps; st++) {
      a += (hash(b, st, seed + 11) - 0.5) * 1.8;
      lx += Math.cos(a) * 1.1;
      ly += Math.sin(a) * 1.1;
      c.spark(lx, ly, st === 0 ? core : st < 2 ? hot : mid, Math.min(1, k) * (0.95 - st * 0.2));
    }
  }
  // The longer arc crawling down the forearm on alternate strikes.
  if (seed % 2 === 0) {
    let lx = x - 0.6;
    let ly = y + 1.4;
    for (let st = 0; st < 3; st++) {
      lx += (hash(st, seed, 3) - 0.5) * 1.6;
      ly += 1.1;
      c.spark(lx, ly, st ? hot : core, Math.min(1, k) * (0.8 - st * 0.2));
    }
  }
  c.spark(x, y, core, 0.25 * Math.min(1, k));
}

/** Motes of the Force hanging in the air round him, each twinkling in and out by the seed. */
function motes(c: PixelCanvas, seed: number, L: number): void {
  if (!seed) return;
  const [core, hot, mid] = S.force;
  for (let i = 0; i < MOTES; i++) {
    const on = hash(i, seed, 5);
    if (on < 0.35) continue;
    // Out at his sides, clear of the face.
    const h = hash(i, 1, 2);
    const x = h < 0.5 ? 1 + h * 10 : 13 + h * 10;
    // Rising slowly: each seed lifts them a little higher.
    const y = 18 + hash(i, 2, 2) * 12 - ((seed + i) % 4) + L;
    c.spark(x, y, on > 0.8 ? core : on > 0.6 ? hot : mid, 0.35 + on * 0.4);
  }
}

function boot(c: PixelCanvas, x: number, y: number, side = false, bias = 0): void {
  c.part();
  if (side) c.ellipse(x, y, 2.2, 1.25, BOOT, { flatten: 0.8, bias });
  else c.ellipse(x, y, 1.75, 1.3, BOOT, { flatten: 0.8, bias });
}

function leg(c: PixelCanvas, hx: number, hy: number, fx: number, fy: number, bias = 0): void {
  c.part();
  c.capsule(hx, hy, fx, fy, 1.35, 1.15, TROUSER, { bias });
}

function shoulder(c: PixelCanvas, x: number, y: number, rx = 2.2, ry = 1.6): void {
  c.part();
  c.ellipse(x, y, rx, ry, S.robe, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.3, 0.95) });
}

function eyes(c: PixelCanvas, pts: [number, number][], blink: boolean | undefined, glare = 0): void {
  if (S.guard) return;
  c.part();
  for (const [x, y] of pts) {
    if (S.hooded || S.horns || S.empress) {
      if (blink) continue;
      c.px(x, y, S.empress?.gem ?? SITH_EYE);
      c.spark(x, y, S.eyeGlow ?? S.force[1], 0.3 + glare * 0.6);
      // Flaring, the glow bleeds out sideways into the shadow.
      if (glare > 0) {
        c.spark(x - 1, y, S.eyeGlow ?? S.force[1], glare * 0.22);
        c.spark(x + 1, y, S.eyeGlow ?? S.force[1], glare * 0.22);
      }
    } else if (blink) c.px(x, y, S.skin, FLAT_DOWN, { bias: -1 });
    else c.px(x, y, EYE);
  }
}

/** Half-width of a cowl row, u = 0 at its peak down to 1 at the shoulders. */
function cowlHW(u: number, full: number): number {
  return 0.8 + (full - 0.8) * Math.sin(Math.min(1, u / 0.6) * (Math.PI / 2));
}

// ---------------------------------------------------------------------------
// The skins' extras: the Nomad's rags and head, the Empress's gown, collar and crown

/** A seed that changes from frame to frame with the pose, so frayed hems flutter and the gown's glints wander. */
const poseSeed = (p: Pose): number =>
  Math.round(p.breath * 3 + p.robe * 5 + p.footA * 7 + p.footB * 13 + p.lift * 11 + p.saber.angle * 0.5 + p.saber.hx * 3) & 1023;

/** The Nomad's cloak frayed to rags along row `rb`: strands hanging a pixel or two below, notches torn into it. */
function rags(c: PixelCanvas, rb: number, l: number, r: number, seed: number): void {
  for (let x = Math.round(l); x < Math.round(r); x++) {
    if (c.materialAt(x, rb) !== S.robe) continue;
    const h = hash(x, rb, seed);
    if (h > 0.48) c.px(x, rb + 1, S.robe, cyl(0, -0.3), { bias: -1 });
    if (h > 0.86) c.px(x, rb + 2, S.robe, cyl(0, -0.4), { bias: -2 });
    else if (h < 0.16) c.shade(x, rb, -2);
  }
}

/**
 * The Empress's gown between rows y0 and rb: a silver band along the hem, a
 * row of silver scrolls above it, and a few glints of amethyst shimmering in
 * the black silk, moving from frame to frame.
 */
function gown(c: PixelCanvas, y0: number, rb: number, span: (y: number) => [number, number], seed: number): void {
  const e = S.empress!;
  for (let y = y0; y <= rb; y++) {
    const [l, r] = span(y);
    for (let x = Math.round(l); x < Math.round(r); x++) {
      if (c.materialAt(x, y) !== S.robe) continue;
      if (y === rb) c.px(x, y, e.silver, cyl(0, 0.1), { bias: -1 });
      else if (y === rb - 2 && (x & 1) === 0) c.px(x, y, e.silver, cyl(0, 0.2), { bias: -1 });
      else if (y === rb - 3 && (x & 3) === 1) c.px(x, y, e.silver, cyl(0, 0.3), { bias: -2 });
      else if (y < rb - 3 && hash(x, y, seed) > 0.95) c.spark(x, y, e.gem.ramp[2], 0.3);
    }
  }
}

/** The Nomad's head from the front: the linen wrap, the brass goggles pushed up on it, the scarf over the mouth. */
function nomadFront(c: PixelCanvas, cx: number, U: number): void {
  const n = S.nomad!;
  c.part();
  const widths = [2.6, 3.7, 4.2, 4.4];
  c.shape(7 + U, 10 + U, (y) => [cx - widths[y - 7 - U], cx + widths[y - 7 - U]], n.wrap, (_x, _y, t, u) => sphere(t * 0.9, u * 1.2 - 0.9, 1));
  c.part();
  for (const y of [11, 12, 13]) {
    c.px(8, y + U, n.wrap, cyl(-0.8, 0));
    c.px(15, y + U, n.wrap, cyl(0.8, 0));
  }
  // The turns of the cloth wound round the crown.
  for (const [x, y] of [[9, 8], [10, 7], [13, 10], [14, 9], [15, 8]] as const) c.shade(x, y + U, -1);
  // Goggles pushed up on the brow: brass rims round two sea-glass lenses, the strap to either side.
  c.part();
  for (const x of [9, 11, 12, 14]) c.px(x, 9 + U, n.brass, sphere((x - cx + 0.5) / 4, -0.2, 1));
  c.px(10, 8 + U, n.brass, sphere(-0.2, -0.8, 1));
  c.px(13, 8 + U, n.brass, sphere(0.2, -0.8, 1));
  for (const x of [10, 13]) c.px(x, 9 + U, n.lens, sphere((x - cx + 0.5) / 5, -0.5, 1));
  c.spark(10, 9 + U, n.lens.ramp[3], 0.2);
  c.part();
  c.px(8, 9 + U, LEATHER, cyl(-0.8, 0));
  c.px(15, 9 + U, LEATHER, cyl(0.8, 0));
  // The scarf drawn up over the nose and mouth, bunched under the chin.
  c.part();
  const sw = [3.0, 3.4, 3.4, 2.8];
  c.shape(13 + U, 16 + U, (y) => [cx - sw[y - 13 - U], cx + sw[y - 13 - U]], n.scarf, (_x, _y, t, u) => sphere(t * 0.9, u * 0.8 - 0.2, 1));
  c.shade(11, 13 + U, 1);
  c.shade(12, 13 + U, 1);
  for (const [x, y] of [[10, 14], [13, 15], [11, 15], [14, 13]] as const) c.shade(x, y + U, -1);
}

/** The Nomad's head in profile (facing left, the upper body centred on hx). */
function nomadSide(c: PixelCanvas, hx: number, U: number): void {
  const n = S.nomad!;
  c.part();
  const rows: [number, number][] = [[-2.9, 2.4], [-3.9, 3.0], [-4.3, 3.3], [-4.4, 3.4], [0.2, 3.4], [0.5, 3.3], [0.9, 2.9]];
  c.shape(7 + U, 13 + U, (y) => {
    const [l, r] = rows[y - 7 - U];
    return [hx + l, hx + r];
  }, n.wrap, (_x, _y, t, u) => sphere(t * 0.9, u * 1.4 - 0.9, 1));
  for (const [dx, y] of [[-1, 8], [0, 9], [1, 10], [2, 8]] as const) c.shade(hx + dx, y + U, -1);
  // The wrap's loose end hanging down behind the neck.
  c.part();
  c.shape(13 + U, 17 + U, (y) => {
    const k = (y - 13 - U) * 0.35;
    return [hx + 1.4 + k, hx + 3.3 + k];
  }, n.wrap, (_x, _y, t, u) => cyl(t * 0.8 + 0.2, 0.2 - u * 0.3), { bias: -1 });
  // The goggles: a lens on the front of the brow in its brass rim, the strap round the wrap.
  c.part();
  for (let dx = -2; dx <= 2; dx++) c.px(hx + dx, 9 + U, LEATHER, sphere(dx / 4, -0.2, 1));
  c.px(hx - 3, 9 + U, n.brass, sphere(-0.3, -0.4, 1));
  c.px(hx - 4, 8 + U, n.brass, sphere(-0.5, -0.8, 1));
  c.px(hx - 4, 9 + U, n.lens, sphere(-0.7, -0.3, 1));
  c.spark(hx - 4, 9 + U, n.lens.ramp[3], 0.2);
  // The scarf over the face up to the nose, wound round the neck.
  c.part();
  const sr: [number, number][] = [[-5.2, 0.8], [-5.0, 1.4], [-4.6, 1.8], [-3.8, 1.8]];
  c.shape(13 + U, 16 + U, (y) => {
    const [l, r] = sr[y - 13 - U];
    return [hx + l, hx + r];
  }, n.scarf, (_x, _y, t, u) => sphere(t * 0.8 - 0.2, u * 0.8 - 0.2, 1));
  c.shade(hx - 5, 13 + U, 1);
  c.shade(hx - 3, 15 + U, -1);
  c.shade(hx - 1, 14 + U, -1);
}

/** The Empress's crown from the front or behind: obsidian spikes, silver tips and band, and (from the front) amethysts that glow. */
function crownFront(c: PixelCanvas, cx: number, U: number, front: boolean): void {
  const e = S.empress!;
  c.part();
  // Tallest at the middle, a pair either side, and the outer ones slanting away.
  const spikes: [number, number][] = [
    [11, 3], [11, 4], [12, 4], [11, 5], [12, 5], [11, 6], [12, 6], [11, 7], [12, 7],
    [9, 5], [9, 6], [9, 7], [10, 7], [14, 5], [14, 6], [14, 7], [13, 7],
    [7, 5], [8, 6], [8, 7], [16, 5], [15, 6], [15, 7],
  ];
  for (const [x, y] of spikes) c.px(x, y + U, e.crown, sphere((x - cx + 0.5) / 4, -0.2, 1));
  for (const [x, y] of [[11, 3], [9, 5], [14, 5], [7, 5], [16, 5]] as const) c.px(x, y + U, e.silver, sphere((x - cx + 0.5) / 4, -0.7, 1));
  c.shade(12, 4 + U, 1);
  // The silver band round the brow.
  c.part();
  c.shape(8 + U, 8 + U, () => [cx - 4.1, cx + 4.1], e.silver, (_x, _y, t) => cyl(t, 0.2));
  if (!front) return;
  // A great amethyst in the middle spike and two small ones in the band, lit from within.
  c.part();
  for (const [x, y] of [[11, 6], [12, 6], [11, 7], [12, 7], [9, 8], [14, 8]] as const) {
    c.px(x, y + U, e.gem, sphere((x - cx + 0.5) / 3, (y - 6.5) / 2, 1));
    c.spark(x, y + U, e.gem.ramp[2], y < 8 ? 0.4 : 0.3);
  }
  c.spark(11, 5 + U, e.gem.ramp[2], 0.15);
  c.spark(12, 5 + U, e.gem.ramp[2], 0.15);
}

/** The Empress's high collar from the front: two obsidian wings rising either side of the head, edged in silver. */
function collarFront(c: PixelCanvas, cx: number, U: number): void {
  const e = S.empress!;
  const out = (y: number) => 6.0 - Math.max(0, y - 11) * 0.3;
  c.part();
  for (const side of [-1, 1] as const) {
    c.shape(10 + U, 16 + U, (y) => (side < 0 ? [cx - out(y - U), cx - 2] : [cx + 2, cx + out(y - U)]), e.crown, (_x, _y, t, u) => cyl(-t * side * 0.6 + side * 0.2, 0.4 - u * 0.4));
  }
  // Silver along the outer edges, up to the points.
  for (let y = 10; y <= 15; y++) {
    c.px(Math.round(cx - out(y)), y + U, e.silver, cyl(-0.6, 0.3), { bias: -1 });
    c.px(Math.round(cx + out(y)) - 1, y + U, e.silver, cyl(0.6, 0.3), { bias: -1 });
  }
  c.px(cx - 6, 9 + U, e.silver, sphere(-0.5, -0.7, 1));
  c.px(cx + 5, 9 + U, e.silver, sphere(0.5, -0.7, 1));
}

/** The Empress's head from the front: hair parted in the middle and falling to the shoulders, dark lips, the crown. */
function empressFront(c: PixelCanvas, cx: number, U: number): void {
  const e = S.empress!;
  c.part();
  const widths = [2.4, 3.4, 3.9, 4.1];
  c.shape(7 + U, 10 + U, (y) => [cx - widths[y - 7 - U], cx + widths[y - 7 - U]], S.hair, (_x, _y, t, u) => sphere(t * 0.9, u * 1.2 - 0.9, 1));
  c.part();
  for (let y = 11; y <= 16; y++) {
    c.px(8, y + U, S.hair, cyl(-0.8, 0), { bias: y > 14 ? -1 : 0 });
    c.px(15, y + U, S.hair, cyl(0.8, 0), { bias: y > 14 ? -1 : 0 });
  }
  c.px(9, 11 + U, S.hair, cyl(-0.4, 0));
  c.px(14, 11 + U, S.hair, cyl(0.4, 0));
  // The parting: the brow showing in a V under the band.
  c.px(11, 10 + U, S.skin, sphere(-0.1, -0.8));
  c.px(12, 10 + U, S.skin, sphere(0.2, -0.8));
  c.part();
  c.px(11, 14 + U, e.lips, sphere(-0.3, 0.2, 1));
  c.px(12, 14 + U, e.lips, sphere(0.3, 0.2, 1));
  crownFront(c, cx, U, true);
}

/** The Empress's head in profile: hair swept back long, the collar's wing behind, the crown. */
function empressSide(c: PixelCanvas, hx: number, U: number): void {
  const e = S.empress!;
  c.part();
  const rows: [number, number][] = [[-2.9, 2.2], [-3.8, 2.8], [-4.2, 3.1], [-4.2, 3.2], [0.2, 3.2], [0.5, 3.2], [0.8, 3.0]];
  c.shape(7 + U, 13 + U, (y) => {
    const [l, r] = rows[y - 7 - U];
    return [hx + l, hx + r];
  }, S.hair, (_x, _y, t, u) => sphere(t * 0.9, u * 1.4 - 0.9, 1));
  c.erase(hx - 5, 10 + U);
  // The long fall down the back.
  c.part();
  c.shape(14 + U, 17 + U, (y) => [hx + 0.8, hx + 3.0 - (y - 14 - U) * 0.2], S.hair, (_x, _y, t, u) => cyl(t * 0.8, 0.2 - u * 0.3), { bias: -1 });
  // The collar's wing standing up behind the head.
  const wing = (y: number) => hx + 4.8 - Math.max(0, y - 12) * 0.4;
  c.part();
  c.shape(10 + U, 16 + U, (y) => [hx + 2.6, wing(y - U)], e.crown, (_x, _y, t, u) => cyl(t * 0.6 + 0.2, 0.4 - u * 0.4));
  for (let y = 10; y <= 15; y++) c.px(Math.round(wing(y)) - 1, y + U, e.silver, cyl(0.6, 0.3), { bias: -1 });
  c.px(hx + 4, 9 + U, e.silver, sphere(0.5, -0.7, 1));
  c.part();
  c.px(hx - 4, 14 + U, e.lips, sphere(-0.6, 0.2, 1));
  // The crown in profile: the tall spike at the brow, smaller ones round to the back.
  c.part();
  const spikes: [number, number][] = [[-3, 3], [-3, 4], [-3, 5], [-3, 6], [-3, 7], [-2, 6], [-2, 7], [-1, 5], [-1, 6], [-1, 7], [0, 7], [1, 5], [1, 6], [1, 7], [2, 7], [3, 6], [4, 5]];
  for (const [dx, y] of spikes) c.px(hx + dx, y + U, e.crown, sphere(dx / 4, -0.2, 1));
  for (const [dx, y] of [[-3, 3], [-1, 5], [1, 5], [4, 5]] as const) c.px(hx + dx, y + U, e.silver, sphere(dx / 4, -0.7, 1));
  c.part();
  c.shape(8 + U, 8 + U, () => [hx - 4.2, hx + 3.2], e.silver, (_x, _y, t) => cyl(t, 0.2));
  c.part();
  for (const [dx, y] of [[-3, 6], [-3, 7], [-1, 8]] as const) {
    c.px(hx + dx, y + U, e.gem, sphere(-0.5, (y - 6.5) / 2, 1));
    c.spark(hx + dx, y + U, e.gem.ramp[2], y < 8 ? 0.4 : 0.3);
  }
}

// ---------------------------------------------------------------------------
// Directions

type Meta = { tip: { x: number; y: number }; hand: { x: number; y: number }; palm: { x: number; y: number } };

function drawDown(c: PixelCanvas, p: Pose): Meta {
  const L = -p.lift;
  // Sitting, the upper body sinks down onto the folded legs.
  const s = p.sit ?? 0;
  const D = Math.round(s * SIT_DROP);
  const U = L + p.breath + D;
  const cx = 12;
  let tip = { x: 0, y: 0 };
  const sh = { x: 7.6, y: 16.8 + U }; // saber shoulder (screen left)
  const saberArm = () => {
    if (p.hilt) {
      // The saber floats free: only the empty hand and its sleeve here.
      sleeve(c, sh.x, sh.y, p.saber.hx, p.saber.hy);
      hand(c, p.saber.hx, p.saber.hy);
      return;
    }
    if (p.bare) {
      tip = guideHand(c, sh, p);
      return;
    }
    tip = drawSaber(c, p.saber, 'main', p.saberBehind);
    sleeve(c, sh.x, sh.y, p.saber.hx, p.saber.hy, p.saberBehind ? -1 : 0);
    hand(c, p.saber.hx, p.saber.hy);
  };
  // A saberstaff's back half usually sits behind him.
  if (S.staff && !p.rearFront) drawSaber(c, p.saber, 'rear', true);
  if (p.saberBehind) saberArm();

  // The back of the robe, seen past the hips and between the legs.
  // Seated, the robe pools out on the ground round him.
  const rt = 15 + U;
  const rb = 28 + L + Math.round(s * 2);
  const pool = s * SIT_POOL;
  // The Empress's gown flares out at the floor.
  const flare = S.empress ? GOWN_FLARE : 0;
  const robeX = (u: number) => cx + p.robe * u * u;
  c.part();
  c.shape(rt, rb, (y) => {
    const u = (y + 0.5 - rt) / (rb + 1 - rt);
    const hw = 4.6 + 2.0 * u + pool * u * u + flare * u * u * u;
    return [robeX(u) - hw, robeX(u) + hw];
  }, S.robe, (_x, _y, t, u) => cyl(t, 0.2 - u * 0.3), { bias: -2 });

  if (s > 0) seatedLegs(c, s, L, D, 'thighs');
  else {
    leg(c, 10.1, 24 + L, 10, 28.4 - p.footA);
    leg(c, 13.9, 24 + L, 14, 28.4 - p.footB);
    boot(c, 9.7, 29.7 - p.footA);
    boot(c, 14.3, 29.7 - p.footB);
  }

  // Tunic: a wrapped chest and a skirt to the knee.
  const top = 15 + U;
  const waist = 22 + U;
  // The Empress's silk underskirt falls to the floor like her gown.
  const hem = S.empress ? rb : s > 0 ? Math.max(26 + L, waist + 2) : 26 + L;
  c.part();
  c.shape(top, waist - 1, (y) => {
    const u = (y + 0.5 - top) / (waist - top);
    const hw = 4.2 - 0.6 * u * u;
    return [cx - hw, cx + hw];
  }, S.tunic, (_x, _y, t, u) => sphere(t * 0.9, (u - 0.35) * 1.1, 1));
  // The left flap crosses over the right: a seam from the collar down to the sash.
  for (let y = top + 1; y < waist - 1; y++) c.shade(Math.round(cx - 1.5 + (y - top) * 0.5), y, -1);
  c.part();
  c.shape(waist, hem, (y) => {
    const u = (y + 0.5 - waist) / (hem + 1 - waist);
    const hw = 3.5 + 1.0 * u + s * 2.2 * u;
    const x = cx + p.robe * 0.3 * u;
    return [x - hw, x + hw];
  }, S.tunic, (_x, _y, t, u) => cyl(t, 0.1 - u * 0.2), { bias: -1 });
  // Sash and belt, a small silver buckle.
  c.part();
  c.shape(waist - 1, waist - 1, () => [cx - 3.8, cx + 3.8], S.tunic, (_x, _y, t) => cyl(t, 0.1), { bias: -1 });
  c.part();
  c.shape(waist, waist, () => [cx - 3.8, cx + 3.8], S.sash, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(cx - 1, waist, SILVER, { x: -0.3, y: 0.3, z: 0.9 }, { bias: 1 });
  c.px(cx, waist, SILVER, { x: 0.2, y: 0.3, z: 0.9 });

  // The robe's front panels, open over the tunic down to the ankles.
  const panel = (side: -1 | 1) => (y: number): [number, number] => {
    const u = (y + 0.5 - rt) / (rb + 1 - rt);
    const hw = 4.9 + 2.1 * u + pool * u * u + flare * u * u * u;
    const gap = 2.2 + 1.0 * u;
    const x = robeX(u);
    return side < 0 ? [x - hw, x - gap] : [x + gap, x + hw];
  };
  c.part();
  c.shape(rt, rb, panel(-1), S.robe, (_x, _y, t, u) => cyl(t * 0.6 - 0.35, 0.25 - u * 0.35));
  c.part();
  c.shape(rt, rb, panel(1), S.robe, (_x, _y, t, u) => cyl(t * 0.6 + 0.35, 0.25 - u * 0.35));
  // Light along the inner edges, where the cloth turns.
  for (let y = rt + 1; y <= rb; y++) {
    if (S.trim) {
      c.px(Math.round(panel(-1)(y)[1]) - 1, y, S.trim, cyl(0.3, 0.2));
      c.px(Math.round(panel(1)(y)[0]), y, S.trim, cyl(-0.3, 0.2), { bias: -1 });
    } else {
      c.shade(Math.round(panel(-1)(y)[1]) - 1, y, 1);
      c.shade(Math.round(panel(1)(y)[0]), y, 1);
    }
  }
  if (S.nomad) for (const side of [-1, 1] as const) rags(c, rb, ...panel(side)(rb), poseSeed(p));
  if (S.empress) {
    gown(c, rt + 2, rb, panel(-1), poseSeed(p));
    gown(c, rt + 2, rb, panel(1), poseSeed(p) + 1);
  }

  // The folded shins cross in front of the lap.
  if (s > 0) seatedLegs(c, s, L, D, 'shins');

  // Free arm (character's left, screen right).
  const fh = p.free ? { x: p.free.x, y: p.free.y + U } : { x: 17.4, y: 22.4 + U + p.arm };
  const freeArm = () => {
    sleeve(c, 16.4, 16.8 + U, fh.x, fh.y);
    if (!p.fist) hand(c, fh.x, fh.y);
    else {
      // A clenched fist, bigger than an open hand, lit from within by its lightning; the knuckles along the top.
      c.part();
      c.ellipse(fh.x, fh.y, 1.5, 1.35, S.glove ?? S.skin, { glow: 0.12 + 0.1 * Math.min(1, p.force) });
      for (let x = Math.round(fh.x - 1.5); x < Math.round(fh.x + 1.5); x++) c.shade(x, Math.round(fh.y - 1.35), (x & 1) === 0 ? 1 : 0);
      c.shade(Math.round(fh.x - 0.5), Math.round(fh.y + 0.5), -1);
    }
  };
  if (!p.handFront) freeArm();
  shoulder(c, 16.8, 16.2 + U);

  // The lowered hood, bunched round the neck (the Nomad's scarf wound there instead), or the Empress's high collar.
  if (S.empress) collarFront(c, cx, U);
  else if (!S.hooded) {
    c.part();
    c.ellipse(cx, 15.4 + U, 4.3, 1.7, S.nomad?.scarf ?? S.robe, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.35, 1) });
  }

  // Head, tipped aside by the pose.
  c.offset(BODY_X + (p.headX ?? 0), BODY_Y + (p.headY ?? 0));
  c.part();
  c.ellipse(cx, 12.6 + U, 3.2, 2.9, S.skin);
  c.part();
  c.px(11, 13 + U, S.skin, sphere(-0.4, -0.3), { bias: 1 });
  c.px(12, 13 + U, S.skin, sphere(0.35, -0.2));
  c.shade(11, 14 + U, -1);
  c.shade(12, 14 + U, -1);
  if (S.hooded) cowlFront(c, cx, U);
  else if (S.horns) warlordFront(c, cx, U);
  else if (S.nomad) nomadFront(c, cx, U);
  else if (S.empress) empressFront(c, cx, U);
  else {
    // Swept hair with a side parting, falling to the jaw.
    c.part();
    const widths = [2.3, 3.4, 3.9, 4.1];
    c.shape(7 + U, 10 + U, (y) => [cx - widths[y - 7 - U], cx + widths[y - 7 - U]], S.hair, (_x, _y, t, u) => sphere(t * 0.9, u * 1.2 - 0.9, 1));
    c.part();
    for (const y of [11, 12]) {
      c.px(8, y + U, S.hair, cyl(-0.8, 0));
      c.px(15, y + U, S.hair, cyl(0.8, 0));
    }
    c.shade(10, 8 + U, -1);
    c.shade(10, 9 + U, -1);
    // The fringe parts over the right brow.
    c.px(12, 10 + U, S.skin, sphere(0.1, -0.8));
    c.px(13, 10 + U, S.skin, sphere(0.4, -0.8));
    if (S.beard) beardFront(c, cx, U);
  }
  eyes(c, [[10, 12 + U], [13, 12 + U]], p.blink, p.glare);
  c.offset(BODY_X, BODY_Y);
  if (p.handFront) freeArm();
  if (p.fist) fistSpark(c, fh.x, fh.y, p.force, p.fist);
  else palm(c, fh.x, fh.y, p.force, p.crackle);

  if (S.staff && p.rearFront) drawSaber(c, p.saber, 'rear');
  if (!p.saberBehind) saberArm();
  shoulder(c, 7.2, 16.2 + U);
  if (p.hilt) {
    // The saber hangs in the air before him, held by the Force in a faint glow.
    tip = drawSaber(c, { hx: p.hilt.x, hy: p.hilt.y, angle: p.hilt.angle, len: 0 });
    const [, hot, mid] = S.force;
    for (let i = -3; i <= 2; i++) {
      c.spark(p.hilt.x + i, p.hilt.y + 1, i % 2 ? mid : hot, 0.5 - Math.abs(i + 0.5) * 0.08);
      c.spark(p.hilt.x + i, p.hilt.y - 1, mid, 0.22 - Math.abs(i + 0.5) * 0.04);
    }
  }
  motes(c, p.motes ?? 0, L);
  return { tip, hand: { x: p.saber.hx, y: p.saber.hy }, palm: fh };
}

/**
 * Legs folded cross-legged as he sits (s from 0 standing to 1 seated): the
 * knees splay out, and past halfway the feet slide in and cross in front.
 * The thighs go under the tunic's lap; the shins and boots over it.
 */
function seatedLegs(c: PixelCanvas, s: number, L: number, D: number, part: 'thighs' | 'shins'): void {
  const hy = 24 + L + D * 0.7;
  const t = Math.max(0, Math.min(1, (s - 0.45) / 0.55));
  const cross = t * t * (3 - 2 * t);
  // The screen-left leg first, so the right shin crosses over it.
  for (const side of [-1, 1] as const) {
    const hx = cx0 + side * 1.9;
    const kx = cx0 + side * (2 + 4.4 * s);
    const ky = 26.8 + L + 1.6 * s;
    const fx = cx0 + side * 2.3 + (-side * 3.8) * cross;
    const fy = 29.7 + L * cross;
    if (part === 'thighs') leg(c, hx, hy, kx, ky);
    else {
      c.part();
      c.capsule(kx, ky, fx, fy - 0.6, 1.3, 1.15, TROUSER);
      boot(c, fx, fy, cross > 0.5, cross > 0.5 && side < 0 ? -1 : 0);
    }
  }
}

/**
 * The Warlord's bare head from the front: the scalp above the brow, black
 * tattoos over the red (a mask round the eyes, bars on the brow and cheeks,
 * the lips), and a crown of short ivory horns.
 */
function warlordFront(c: PixelCanvas, cx: number, U: number): void {
  c.part();
  const widths = [2.2, 3.0, 3.4, 3.4];
  c.shape(7 + U, 10 + U, (y) => [cx - widths[y - 7 - U], cx + widths[y - 7 - U]], S.skin, (_x, _y, t, u) => sphere(t * 0.9, u * 1.1 - 0.95, 1));
  c.part();
  const ink: [number, number][] = [
    [10, 7], [13, 7],
    [9, 8], [11, 8], [12, 8], [14, 8],
    [10, 9], [13, 9],
    [11, 10], [12, 10],
    [9, 11], [10, 11], [13, 11], [14, 11],
    [9, 12], [14, 12],
    [10, 13], [13, 13],
    [9, 14], [11, 14], [12, 14], [14, 14],
    [10, 15], [13, 15],
  ];
  for (const [x, y] of ink) c.px(x, y + U, S.tattoo!, sphere((x - cx + 0.5) / 3.5, (y - 12) / 4, 1));
  horns(c, [[10, 6], [13, 6]], [[8, 8], [15, 8]], U);
}

/** Short ivory horns: two pixels each, the tip in the light; `low` ones stand at the sides of the crown. */
function horns(c: PixelCanvas, top: [number, number][], low: [number, number][], U: number): void {
  c.part();
  for (const [x, y] of [...top, ...low]) {
    c.px(x, y + U, HORN, sphere(-0.2, 0.1, 1), { bias: -1 });
    c.px(x, y - 1 + U, HORN, sphere(-0.3, -0.6, 1), { bias: 1 });
  }
}

/** The Grand Master's beard and brows: a white moustache under the nose, falling to a point on the chest. */
function beardFront(c: PixelCanvas, cx: number, U: number): void {
  c.part();
  const widths = [2.6, 3.0, 2.8, 2.3, 1.7, 1.0];
  c.shape(14 + U, 19 + U, (y) => [cx - widths[y - 14 - U], cx + widths[y - 14 - U]], S.beard!, (_x, _y, t, u) => sphere(t * 0.85, u * 0.9 - 0.25, 1));
  // The mouth, a shadow under the moustache, and strands down the beard.
  c.shade(11, 15 + U, -2);
  c.shade(12, 15 + U, -2);
  for (let y = 16; y <= 18; y++) {
    c.shade(cx - 2, y + U, -1);
    c.shade(cx + 1, y + U, -1);
  }
  // Heavy white brows.
  c.part();
  for (const x of [9, 10, 13, 14]) c.px(x, 11 + U, S.beard!, sphere((x - cx + 0.5) / 3, -0.6, 1));
}

/** The raised hood from the front: a cowl round a shadow where the eyes glow. */
function cowlFront(c: PixelCanvas, cx: number, U: number): void {
  const top = (S.guard ? 2 : 5) + U;
  const bottom = 16 + U;
  c.part();
  c.shape(top, bottom, (y) => {
    const u = (y + 0.5 - top) / (bottom + 1 - top);
    const hw = cowlHW(u, 5.3) - (u > 0.9 ? 0.3 : 0);
    return [cx - hw, cx + hw];
  }, S.robe, (_x, _y, t, u) => cyl(t, 0.5 - u * 0.4));
  c.shade(cx - 2, 7 + U, -1);
  c.shade(cx + 1, 7 + U, -1);
  c.part();
  c.ellipse(cx, 12.8 + U, 3.1, 3.3, HOOD_SHADOW, { normal: () => FLAT_DOWN });
  if (S.guard) {
    // A white mask fills the hood: a dark visor across the eyes, a ridge down the middle.
    c.part();
    c.ellipse(cx, 12.9 + U, 2.6, 3.0, MASK, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.7 - 0.1, 1) });
    c.part();
    for (let x = 10; x <= 13; x++) c.px(x, 12 + U, HILT_DARK, FLAT_DOWN);
    c.spark(10, 12 + U, S.force[2], 0.35);
    c.spark(13, 12 + U, S.force[2], 0.35);
    for (let y = 13; y <= 15; y++) c.shade(12, y + U, -1);
    c.shade(11, 10 + U, 1);
    return;
  }
  // The chin, just caught by the light below the shadow.
  c.part();
  c.shape(15 + U, 15 + U, () => [cx - 1.6, cx + 1.6], S.skin, (_x, _y, t) => cyl(t, -0.3), { bias: -1 });
}

function drawUp(c: PixelCanvas, p: Pose): Meta {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  let tip = { x: 0, y: 0 };
  const sh = { x: 16.4, y: 16.8 + U }; // saber shoulder (screen right)
  const saberArm = () => {
    if (p.bare) {
      tip = guideHand(c, sh, p);
      return;
    }
    tip = drawSaber(c, p.saber, 'main', p.saberBehind);
    sleeve(c, sh.x, sh.y, p.saber.hx, p.saber.hy, p.saberBehind ? -1 : 0);
    hand(c, p.saber.hx, p.saber.hy);
  };
  // A saberstaff's back half usually sits behind him.
  if (S.staff && !p.rearFront) drawSaber(c, p.saber, 'rear', true);
  if (p.saberBehind) saberArm();

  // Free hand reaching ahead (away from us) is hidden behind the body.
  const fh = p.free ? { x: 24 - p.free.x, y: p.free.y + U } : { x: 6.6, y: 22.4 + U + p.arm };
  const ahead = fh.y < 17 + U;
  if (ahead) {
    palm(c, fh.x, fh.y, p.force, p.crackle);
    sleeve(c, 7.6, 16.8 + U, fh.x, fh.y, -1);
    hand(c, fh.x, fh.y);
  }

  leg(c, 10.1, 24 + L, 10, 28.4 - p.footB);
  leg(c, 13.9, 24 + L, 14, 28.4 - p.footA);
  boot(c, 9.7, 29.7 - p.footB);
  boot(c, 14.3, 29.7 - p.footA);

  // The robe from behind, falling from the shoulders to the ankles in two folds.
  const rt = 14.5 + U;
  const rb = 28 + L;
  // The Empress's gown flares at the floor and its train spreads out on the ground towards us.
  const flare = S.empress ? GOWN_FLARE : 0;
  const end = S.empress ? rb + TRAIN - 1 : rb;
  const edges = (y: number): [number, number] => {
    const u = Math.max(0, Math.min(1, (y + 0.5 - rt) / (rb + 1 - rt)));
    const hw = 4.6 + 2.2 * Math.pow(u, 1.1) + flare * u * u * u - Math.max(0, y - rb) * 1.6;
    const x = cx + p.robe * u * u;
    return [x - hw, x + hw];
  };
  c.part();
  c.shape(rt, end, edges, S.robe, (_x, _y, t, u) => cyl(t * 0.9, 0.25 - u * 0.35));
  for (let y = Math.round(rt + 6); y <= end; y++) {
    const [l, r] = edges(y);
    c.shade(Math.round(l + (r - l) * 0.32), y, -1);
    c.shade(Math.round(l + (r - l) * 0.66), y, -1);
  }
  if (S.nomad) rags(c, rb, ...edges(rb), poseSeed(p));
  if (S.empress) gown(c, Math.round(rt + 2), end, edges, poseSeed(p));
  // Sash knot at the back of the waist.
  c.part();
  c.shape(22 + U, 22 + U, () => [cx - 4.4, cx + 4.4], S.sash, (_x, _y, t) => cyl(t, 0), { bias: -1 });

  if (!ahead) {
    sleeve(c, 7.6, 16.8 + U, fh.x, fh.y);
    hand(c, fh.x, fh.y);
    palm(c, fh.x, fh.y, p.force, p.crackle);
  }

  if (S.hooded) {
    // The raised hood from behind, its point drooping down the back.
    c.part();
    const top = (S.guard ? 2 : 5) + U;
    const bottom = 17 + U;
    c.shape(top, bottom, (y) => {
      const u = (y + 0.5 - top) / (bottom + 1 - top);
      const hw = cowlHW(u, 5.2) - (u > 0.85 ? (u - 0.85) * 12 : 0);
      return hw < 0.8 ? null : [cx - hw, cx + hw];
    }, S.robe, (_x, _y, t, u) => cyl(t, 0.45 - u * 0.4));
    for (let y = 8 + U; y <= 16 + U; y++) c.shade(cx, y, -1);
  } else if (S.empress) {
    // The back of her head under the crown, then the collar's back rising round it like a fan.
    const e = S.empress;
    c.part();
    c.ellipse(cx, 11 + U, 3.9, 3.9, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.95, dy * 0.9 - 0.2, 1) });
    c.shade(cx - 1, 8 + U, 1);
    crownFront(c, cx, U, false);
    c.part();
    const fan = (y: number) => 6.0 - Math.max(0, y - 11) * 0.35;
    c.shape(11 + U, 17 + U, (y) => [cx - fan(y - U), cx + fan(y - U)], e.crown, (_x, _y, t, u) => cyl(t * 0.9, 0.5 - u * 0.5));
    c.shape(10 + U, 10 + U, () => [cx - 6, cx - 4.4], e.crown, (_x, _y, t) => cyl(t, 0.6));
    c.shape(10 + U, 10 + U, () => [cx + 4.4, cx + 6], e.crown, (_x, _y, t) => cyl(t, 0.6));
    // Silver along the rim of its wings and down its middle seam, and an amethyst at the nape.
    for (let x = cx - 6; x < cx + 6; x++) if ((x < cx - 3 || x >= cx + 3) && c.materialAt(x, 11 + U) === e.crown) c.px(x, 11 + U, e.silver, cyl((x - cx + 0.5) / 6, 0.5), { bias: x < cx - 4 || x >= cx + 4 ? -1 : -2 });
    for (let y = 13; y <= 16; y++) c.px(y % 2 ? cx - 1 : cx, y + U, e.silver, cyl(0, 0.3), { bias: -1 });
    c.part();
    c.px(cx - 1, 12 + U, e.gem, sphere(-0.3, 0, 1));
    c.px(cx, 12 + U, e.gem, sphere(0.3, 0, 1));
    c.spark(cx - 1, 12 + U, e.gem.ramp[2], 0.3);
    c.spark(cx, 12 + U, e.gem.ramp[2], 0.3);
  } else {
    // The lowered hood lies across the shoulders, its point hanging down the back.
    c.part();
    const top = 14 + U;
    const bottom = 20 + U;
    c.shape(top, bottom, (y) => {
      const u = (y + 0.5 - top) / (bottom + 1 - top);
      const hw = 4.4 * Math.cos(u * 1.3) + 0.2;
      return hw < 0.6 ? null : [cx - hw, cx + hw];
    }, S.nomad?.scarf ?? S.robe, (_x, _y, t, u) => cyl(t * 0.8, 0.5 - u * 0.5));
    for (let y = top + 1; y < bottom; y++) c.shade(cx, y, -1);
    // The back of the head.
    c.part();
    c.ellipse(cx, 11 + U, 3.9, 3.9, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.95, dy * 0.9 - 0.2, 1) });
    c.shade(cx - 1, 8 + U, 1);
    if (S.nomad) {
      // The wrap's turns, the goggles' strap round the back with its brass buckle, and the loose end hanging down.
      const n = S.nomad;
      for (const [x, y] of [[9, 9], [10, 8], [11, 7], [13, 11], [14, 10]] as const) c.shade(x, y + U, -1);
      c.part();
      for (let x = 8; x <= 15; x++) c.px(x, 10 + U, LEATHER, cyl((x - cx + 0.5) / 4, 0));
      c.px(12, 10 + U, n.brass, sphere(0.2, -0.3, 1));
      c.part();
      c.shape(12 + U, 18 + U, (y) => {
        const k = (y - 12 - U) * 0.25;
        return [cx + 0.6 + k, cx + 2.6 + k - (y - 12 - U) * 0.1];
      }, n.wrap, (_x, _y, t, u) => cyl(t * 0.8, 0.3 - u * 0.4));
      c.shade(13, 15 + U, -1);
    }
    if (S.horns) {
      // Tattoo bars down the back of the scalp, and the horns' crown.
      c.part();
      for (const [x, y] of [[11, 8], [12, 8], [9, 9], [14, 9], [11, 10], [12, 10], [10, 12], [13, 12], [11, 13], [12, 13]] as const) {
        c.px(x, y + U, S.tattoo!, sphere((x - cx + 0.5) / 4, (y - 11) / 4, 1));
      }
      horns(c, [[10, 7], [13, 7]], [[8, 9], [15, 9]], U);
    }
  }

  if (S.staff && p.rearFront) drawSaber(c, p.saber, 'rear');
  if (!p.saberBehind) saberArm();
  shoulder(c, 7.2, 16.2 + U);
  shoulder(c, 16.8, 16.2 + U);
  return { tip, hand: { x: p.saber.hx, y: p.saber.hy }, palm: fh };
}

/** Facing left. Right-facing frames are mirrored from these. */
function drawSide(c: PixelCanvas, p: Pose): Meta {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const Sx = -p.lean; // lean forward = toward the left
  const hx = cx + Sx; // upper body centre
  let tip = { x: 0, y: 0 };
  const sh = { x: hx + 0.6, y: 17.4 + U };
  if (S.staff && !p.rearFront) drawSaber(c, p.saber, 'rear', true);
  if (p.saberBehind) tip = drawSaber(c, p.saber, 'main', true);

  // The robe's back streaming behind.
  const rt = 15 + U;
  const rb = 28 + L;
  // The Empress's gown sweeps out behind into a train, its last row lying along the ground.
  const train = S.empress ? TRAIN : 0;
  const back = (y: number) => {
    const u = Math.max(0, Math.min(1, (y + 0.5 - rt) / (rb + 1 - rt)));
    return hx + 3.0 + 2.6 * Math.pow(u, 1.2) + p.robe * u * u - Sx * u + train * Math.pow(u, 4) + (y > rb ? train * 0.5 : 0);
  };
  c.part();
  c.shape(rt, rb, (y) => {
    const u = Math.max(0, (y + 0.5 - rt) / (rb + 1 - rt));
    return [hx - 1.5 - Sx * u, back(y)];
  }, S.robe, (_x, _y, t, u) => cyl(t * 0.8 + 0.15, 0.25 - u * 0.3), { bias: -1 });
  if (S.empress) {
    c.part();
    c.shape(rb + 1, rb + 1, (y) => [hx + 0.5, back(y)], S.robe, (_x, _y, t) => cyl(t * 0.6, -0.6), { bias: -2 });
  }

  // Far arm, mostly hidden behind the body.
  const fh = p.free ? { x: p.free.x + Sx, y: p.free.y + U } : { x: hx + 2.6 - p.arm, y: 22.4 + U };
  sleeve(c, hx + 1.8, 17 + U, fh.x, fh.y, -1);
  hand(c, fh.x, fh.y);

  // Legs: back leg in shade first, then the front leg.
  const lift = (f: number) => Math.max(0, f) * 0.35;
  leg(c, cx + 0.9, 24 + L, cx + 1.3 - p.footB, 28.4 - lift(p.footB), -1);
  boot(c, cx + 0.6 - p.footB, 29.7 - lift(p.footB), true, -1);
  leg(c, cx - 0.2, 24 + L, cx + 0.2 - p.footA, 28.4 - lift(p.footA));
  boot(c, cx - 0.5 - p.footA, 29.7 - lift(p.footA), true);

  // Tunic in profile, then the robe over the back half of it.
  const top = 15 + U;
  const waist = 22 + U;
  const hem = S.empress ? rb : 26 + L;
  c.part();
  c.shape(top, waist - 1, (y) => [hx - 2.8 - (y >= top + 1 && y <= top + 3 ? 0.4 : 0), hx + 2.6], S.tunic, (_x, _y, t, u) => sphere(t * 0.9 - 0.1, (u - 0.35) * 1.1, 1));
  c.part();
  c.shape(waist, hem, (y) => {
    const u = (y + 0.5 - waist) / (hem + 1 - waist);
    return [cx - 3.0 + Sx * 0.5 - u * 0.6, cx + 2.6];
  }, S.tunic, (_x, _y, t, u) => cyl(t * 0.9 - 0.1, 0.1 - u * 0.2), { bias: -1 });
  c.part();
  c.shape(waist - 1, waist - 1, () => [hx - 3.0, hx + 2.6], S.tunic, (_x, _y, t) => cyl(t, 0.1), { bias: -1 });
  c.part();
  c.shape(waist, waist, () => [hx - 3.1, hx + 2.6], S.sash, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(Math.round(hx - 3.1), waist, SILVER, { x: -0.5, y: 0.3, z: 0.8 }, { bias: 1 });
  c.part();
  c.shape(rt, rb, (y) => {
    const u = Math.max(0, (y + 0.5 - rt) / (rb + 1 - rt));
    return [hx - 0.6 - 1.4 * u - Sx * u * 0.5, back(y)];
  }, S.robe, (_x, _y, t, u) => cyl(t * 0.8 - 0.1, 0.25 - u * 0.3));
  for (let y = rt + 2; y <= rb; y++) {
    const u = (y + 0.5 - rt) / (rb + 1 - rt);
    const ex = Math.round(hx - 0.6 - 1.4 * u - Sx * u * 0.5);
    if (S.trim) c.px(ex, y, S.trim, cyl(-0.5, 0.2));
    else c.shade(ex, y, 1);
  }
  const side = (y: number): [number, number] => [hx - 3 - Sx, back(y) + 1];
  if (S.nomad) rags(c, rb, ...side(rb), poseSeed(p));
  if (S.empress) gown(c, rt + 2, rb + 1, side, poseSeed(p));

  // Head, over the lowered hood (the Nomad's scarf wound there instead; the Empress's collar is drawn with her head).
  if (!S.hooded && !S.empress) {
    c.part();
    c.ellipse(hx + 1.3, 15.2 + U, 2.8, 1.8, S.nomad?.scarf ?? S.robe, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.1, dy * 0.8 - 0.35, 1) });
  }
  c.part();
  c.ellipse(hx - 1.2, 12.8 + U, 2.9, 2.7, S.skin);
  c.part();
  c.px(hx - 5, 13 + U, S.skin, sphere(-0.6, -0.2), { bias: 1 });
  c.shade(hx - 4, 14 + U, -1);
  if (S.hooded) {
    // The cowl, its point flopping back, the face in shadow at the front.
    const top = (S.guard ? 2 : 5) + U;
    const bottom = 16 + U;
    c.part();
    c.shape(top, bottom, (y) => {
      const u = (y + 0.5 - top) / (bottom + 1 - top);
      const s = Math.sin(Math.min(1, u / 0.6) * (Math.PI / 2));
      const x = 2.4 * Math.pow(1 - u, 2.2);
      return [hx + x - 0.6 - 4.4 * s, hx + x + 0.6 + 3.8 * s];
    }, S.robe, (_x, _y, t, u) => cyl(t * 0.9 + 0.1, 0.5 - u * 0.4));
    c.shade(hx + 1, 8 + U, -1);
    c.shade(hx + 2, 12 + U, -1);
    c.part();
    c.ellipse(hx - 3.4, 12.9 + U, 1.6, 2.7, HOOD_SHADOW, { normal: () => FLAT_DOWN });
    if (S.guard) {
      // The mask in profile, its visor a dark notch.
      c.part();
      c.ellipse(hx - 3.6, 13 + U, 1.3, 2.6, MASK, { normal: (_x, _y, dx, dy) => sphere(-0.5 + dx * 0.4, dy * 0.7, 0.9) });
      c.part();
      c.px(hx - 4, 12 + U, HILT_DARK, FLAT_DOWN);
      c.px(hx - 5, 12 + U, HILT_DARK, FLAT_DOWN);
      c.spark(hx - 4, 12 + U, S.force[2], 0.35);
    } else {
      c.part();
      c.px(hx - 4, 15 + U, S.skin, { x: -0.5, y: -0.2, z: 0.8 }, { bias: -1 });
    }
    eyes(c, [[hx - 4, 12 + U]], p.blink);
  } else if (S.nomad || S.empress) {
    if (S.nomad) nomadSide(c, hx, U);
    else empressSide(c, hx, U);
    eyes(c, [[hx - 3, 12 + U]], p.blink);
  } else {
    c.part();
    const rows: [number, number][] = [
      [-2.9, 2.2],
      [-3.8, 2.8],
      [-4.2, 3.1],
      [-4.2, 3.1],
      [0.2, 3.1],
      [0.5, 3.0],
      [0.9, 2.6],
    ];
    c.shape(7 + U, 13 + U, (y) => {
      const [l, r] = rows[y - 7 - U];
      return [hx + l, hx + r];
    }, S.hair, (_x, _y, t, u) => sphere(t * 0.9, u * 1.4 - 0.9, 1));
    c.erase(hx - 5, 10 + U);
    if (S.horns) {
      // The Warlord in profile: the brow band and the mask round the eye, the lips, bars over the scalp, and the horns.
      c.part();
      const ink: [number, number][] = [[-2, 7], [0, 8], [2, 8], [-1, 9], [1, 10], [-4, 11], [-3, 11], [-2, 11], [-2, 12], [-3, 13], [-4, 14], [-3, 14], [0, 12], [1, 13]];
      for (const [dx, y] of ink) c.px(hx + dx, y + U, S.tattoo!, sphere(dx / 4, (y - 11) / 4, 1));
      horns(c, [[hx - 2, 6], [hx, 6]], [[hx + 2, 7], [hx + 3, 9]], U);
    }
    if (S.beard) {
      // The beard from the jaw to a point over the chest, the brow above the eye.
      c.part();
      const rows: [number, number][] = [[-4.8, -1.2], [-4.8, -0.8], [-4.4, -1.0], [-4.0, -1.6], [-3.6, -2.2], [-3.2, -2.4]];
      c.shape(14 + U, 19 + U, (y) => {
        const [l, r] = rows[y - 14 - U];
        return [hx + l, hx + r];
      }, S.beard, (_x, _y, t, u) => sphere(t * 0.8 - 0.2, u * 0.9 - 0.25, 1));
      c.shade(hx - 4, 15 + U, -2);
      c.shade(hx - 3, 17 + U, -1);
      c.px(hx - 3, 11 + U, S.beard, sphere(-0.2, -0.6, 1));
      c.px(hx - 4, 11 + U, S.beard, sphere(-0.5, -0.6, 1));
    }
    eyes(c, [[hx - 3, 12 + U]], p.blink);
  }
  palm(c, fh.x, fh.y, p.force, p.crackle);

  // Near arm and saber.
  if (S.staff && p.rearFront) drawSaber(c, p.saber, 'rear');
  if (p.bare) tip = guideHand(c, sh, p);
  else {
    if (!p.saberBehind) tip = drawSaber(c, p.saber, 'main');
    sleeve(c, sh.x, sh.y, p.saber.hx, p.saber.hy);
    hand(c, p.saber.hx, p.saber.hy);
  }
  shoulder(c, hx + 0.8, 16.8 + U, 2.1, 1.6);
  return { tip, hand: { x: p.saber.hx, y: p.saber.hy }, palm: fh };
}

// ---------------------------------------------------------------------------
// Animations

type View = 'down' | 'up' | 'side';

const sb = (hx: number, hy: number, angle: number, len = 11): Saber => ({ hx, hy, angle, len });
/** A saberstaff held at its middle: shorter blades either end. */
const st = (hx: number, hy: number, angle: number, len = 8): Saber => ({ hx, hy, angle, len });

/** A ready guard: the blade raised beside him. */
const IDLE_SABER: Record<View, Saber> = {
  down: sb(5.5, 22, -28),
  up: sb(18.5, 22, 28),
  side: sb(9, 22, -42),
};

/** The Sith's guard: the staff slanted across his side, the upper blade raised, the lower one behind him. */
const IDLE_STAFF: Record<View, Saber> = {
  down: st(6, 21, -40),
  up: st(18, 21, 40),
  side: st(10, 21.5, -35),
};

const idleSaber = (view: View): Saber => ({ ...(S.staff ? IDLE_STAFF : IDLE_SABER)[view] });

const base = (view: View): Pose => ({
  lift: 0,
  breath: 0,
  footA: 0,
  footB: 0,
  robe: 0,
  arm: 0,
  lean: 0,
  saber: idleSaber(view),
  force: 0,
});

function idle(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 8;
  for (let f = 0; f < N; f++) {
    const ph = (f / N) * Math.PI * 2;
    const p = base(view);
    p.breath = Math.sin(ph - 0.6) > 0.1 ? 1 : 0;
    p.saber.hy += p.breath * 0.5;
    p.saber.angle += Math.sin(ph) * 2;
    p.robe = Math.sin(ph - 2.2) > 0.5 ? 1 : 0;
    p.blink = f === 5;
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
    p.robe = view === 'side' ? 1 + (p.lift ? 0 : 1) : Math.round(-s);
    if (view === 'side') {
      p.footA = Math.round(s * 2.4);
      p.footB = -p.footA;
      p.arm = Math.round(s * 1.5);
      p.saber.angle = idleSaber('side').angle - s * 8;
      p.saber.hx += -s;
    } else {
      p.footA = s > 0.3 ? 1 : 0;
      p.footB = s < -0.3 ? 1 : 0;
      p.arm = Math.round(-s);
      p.saber.hy += s > 0 ? -1 : 0;
    }
    p.saber.hy -= p.lift;
    frames.push(p);
  }
  return frames;
}

/** Where the empty saber hand is held out while the blade flies: raised, reaching towards it. */
const GUIDE_HAND: Record<View, { x: number; y: number }> = {
  down: { x: 5, y: 19 },
  up: { x: 19, y: 19 },
  side: { x: 6.5, y: 18.5 },
};

/**
 * The Jedi with his saber thrown (the Special): his own idle and walk, but
 * the saber hand raised and open, steering the blade through the air with a
 * soft glow that swells and ebbs.
 */
function bare(of: (view: View) => Pose[]) {
  return (view: View): Pose[] =>
    of(view).map((p, i, all) => {
      const g = GUIDE_HAND[view];
      const ph = (i / all.length) * Math.PI * 2;
      p.bare = true;
      p.saberBehind = false;
      // The hand rides with the body's bob and sways a pixel as it steers.
      p.saber = { ...p.saber, hx: g.x + Math.round(Math.sin(ph) * 0.6), hy: g.y + p.breath - p.lift + (Math.cos(ph) > 0.5 ? -0.5 : 0) };
      p.guide = 0.42 + 0.18 * Math.sin(ph);
      return p;
    });
}

/** A swing keyframe: the blade, drawn behind the body, and (a saberstaff) its back half in front. */
type Key = Saber & { behind?: boolean; rf?: boolean };

/** Blade keyframes per view: wind-up, strike, follow-through, follow-through, recover. */
const SWINGS: Record<'slash1' | 'slash2', Record<View, Key[]>> = {
  // Forehand: across the body from the saber side.
  slash1: {
    down: [sb(3.5, 16.5, -70), sb(9.5, 25, 190), sb(14.5, 24, 130), sb(15.5, 22, 104), sb(6, 21, -34)],
    up: [sb(20.5, 16.5, 70), { ...sb(14.5, 14, -8), behind: true }, { ...sb(8, 15.5, -60), behind: true }, { ...sb(6, 19, -86), behind: true }, sb(18, 21, 34)],
    side: [sb(15, 15, 25), sb(5.5, 20, -88), sb(8.5, 24, -140), sb(10.5, 25, -175), sb(9, 22, -50)],
  },
  // Backhand: back the other way.
  slash2: {
    down: [sb(14.5, 19, 75), sb(13.5, 25, 172), sb(5.5, 24, 232), sb(3.5, 21, 262), sb(5.5, 21.5, -24)],
    up: [{ ...sb(6, 17, -70), behind: true }, { ...sb(9.5, 14, 5), behind: true }, sb(17, 16, 60), sb(19.5, 19.5, 88), sb(18.5, 21.5, 24)],
    side: [sb(11, 25, 165), sb(5.5, 20.5, -92), sb(7.5, 15.5, -38), sb(10.5, 13.5, -8), sb(9, 22, -42)],
  },
};

/**
 * The Sith's sweeps with the saberstaff: the same arcs as the Jedi's, the
 * hands nearer the middle, and the back blade swinging round the other way.
 * Seen from behind, the front blade passes out of sight in front of him and
 * the back blade sweeps past on our side.
 */
const STAFF_SWINGS: Record<'sweep1' | 'sweep2', Record<View, Key[]>> = {
  sweep1: {
    down: [st(5, 17, -80), st(9, 24, 200), st(13, 24, 140), st(15, 22, 100), st(6.5, 21, -36)],
    up: [st(19, 17, 80), { ...st(15, 14, -20), behind: true, rf: true }, { ...st(10, 14.5, -60), behind: true, rf: true }, { ...st(7, 18, -95), behind: true, rf: true }, st(17.5, 21, 36)],
    side: [{ ...st(15, 15, 30), rf: true }, st(6, 20, -88), st(8.5, 24, -140), st(10.5, 25, -175), st(10, 21.5, -35)],
  },
  sweep2: {
    down: [st(15, 19, 80), st(14, 25, 165), st(8, 24, 225), st(5.5, 21, 262), st(6.5, 21, -36)],
    up: [st(6, 17, -75), { ...st(10, 14, 10), behind: true, rf: true }, { ...st(16, 15.5, 60), behind: true, rf: true }, st(19.5, 19.5, 90), st(17.5, 21, 36)],
    side: [st(11, 25, 165), st(5.5, 20.5, -92), st(7.5, 15.5, -38), st(10.5, 13.5, -8), st(10, 21.5, -35)],
  },
};

function slash(kind: 'slash1' | 'slash2' | 'sweep1' | 'sweep2') {
  return (view: View): Pose[] =>
    (kind === 'slash1' || kind === 'slash2' ? SWINGS[kind] : STAFF_SWINGS[kind])[view].map((s, i) => {
      const p = base(view);
      p.saber = { hx: s.hx, hy: s.hy, angle: s.angle, len: s.len };
      p.saberBehind = s.behind;
      p.rearFront = s.rf;
      // Crouch into the strike, the robe whipping after it.
      p.breath = i === 1 || i === 2 ? 1 : 0;
      const dirSign = kind === 'slash1' || kind === 'sweep1' ? 1 : -1;
      p.robe = i === 0 ? 0 : i < 4 ? -dirSign * (view === 'side' ? -1 : 1) : 0;
      if (view === 'side') {
        p.lean = i === 1 || i === 2 ? 1 : 0;
        p.footA = i >= 1 && i <= 3 ? 2 : 0;
        p.footB = i >= 1 && i <= 3 ? -1 : 0;
        p.robe = i >= 1 && i <= 3 ? 2 : 1;
      } else {
        p.free = { x: 18.4, y: 20.6 };
        if (i >= 1 && i <= 3) p.footA = 1;
      }
      return p;
    });
}

/** Special: gather the Force in the free palm, thrust it out, recover. */
function push(view: View): Pose[] {
  const saber: Record<View, Saber> = { down: sb(5, 23, -150), up: sb(19, 23, 150), side: sb(14.5, 22.5, 140) };
  // Free hand: drawn back to the chest, then driven forward.
  const hands: Record<View, { x: number; y: number }[]> = {
    down: [{ x: 15.5, y: 19 }, { x: 15, y: 18.5 }, { x: 13.5, y: 23 }, { x: 13.5, y: 23 }, { x: 16.5, y: 21.5 }],
    up: [{ x: 15.5, y: 19 }, { x: 15, y: 18.5 }, { x: 16, y: 12.5 }, { x: 16, y: 12.5 }, { x: 16.5, y: 18 }],
    side: [{ x: 13.5, y: 19.5 }, { x: 14, y: 19 }, { x: 4, y: 18 }, { x: 4, y: 18 }, { x: 8, y: 20.5 }],
  };
  const force = [0.45, 0.85, 1, 0.55, 0.15];
  return force.map((k, i) => {
    const p = base(view);
    p.saber = { ...saber[view] };
    p.free = hands[view][i];
    p.force = k;
    const out = i === 2 || i === 3;
    p.breath = i < 2 || out ? 1 : 0;
    p.robe = out ? (view === 'side' ? 3 : view === 'down' ? -1 : 1) : i === 1 ? 1 : 0;
    if (view === 'side') {
      p.lean = out ? 2 : i === 1 ? -1 : 0;
      p.footA = out ? 3 : i === 1 ? -1 : 0;
      p.footB = out ? -2 : i === 1 ? 1 : 0;
      p.saber.hx += out ? 1 : 0;
    } else {
      p.footA = out ? 1 : 0;
    }
    return p;
  });
}

/** The saberstaff held low along his side while the free hand works the Force. */
const STAFF_LOW: Record<View, Saber> = { down: st(5, 21.5, -32), up: st(19, 21.5, 32), side: st(15, 22, 62) };

/**
 * Force lightning: the free hand drawn back as the lightning gathers in it,
 * then thrust out, fingers spread and shaking as it pours from them for five
 * frames (the robe snapping in the backwash), then lowered.
 */
function lightning(view: View): Pose[] {
  const hands: Record<View, { x: number; y: number }[]> = {
    down: [{ x: 15.5, y: 19 }, { x: 15, y: 18.5 }, { x: 13.5, y: 23.5 }, { x: 14.1, y: 23 }, { x: 13.5, y: 23.6 }, { x: 14.1, y: 23 }, { x: 13.5, y: 23.5 }, { x: 16.5, y: 21.5 }],
    up: [{ x: 15.5, y: 19 }, { x: 15, y: 18.5 }, { x: 16, y: 12.5 }, { x: 16.5, y: 13 }, { x: 15.8, y: 12.4 }, { x: 16.5, y: 13 }, { x: 16, y: 12.5 }, { x: 16.5, y: 18 }],
    side: [{ x: 13.5, y: 19.5 }, { x: 14, y: 19 }, { x: 3.5, y: 18 }, { x: 4, y: 17.4 }, { x: 3.4, y: 18.2 }, { x: 4, y: 17.4 }, { x: 3.5, y: 18 }, { x: 8, y: 20.5 }],
  };
  const force = [0.4, 0.75, 1, 1, 1, 1, 1, 0.25];
  return force.map((k, i) => {
    const p = base(view);
    p.saber = { ...STAFF_LOW[view] };
    p.free = hands[view][i];
    p.force = k;
    const out = i >= LIGHTNING_FRAMES.from && i <= LIGHTNING_FRAMES.to;
    if (out) p.crackle = i + 1;
    p.breath = i < 2 || out ? 1 : 0;
    // The robe snaps back and forth in the lightning's backwash.
    const snap = out ? (i % 2 ? 1 : 0) : 0;
    p.robe = out ? (view === 'side' ? 2 + snap : view === 'down' ? -1 - snap : 1 + snap) : i === 1 ? 1 : 0;
    if (view === 'side') {
      p.lean = out ? 2 : i === 1 ? -1 : 0;
      p.footA = out ? 3 : i === 1 ? -1 : 0;
      p.footB = out ? -2 : i === 1 ? 1 : 0;
    } else {
      p.footA = out ? 1 : 0;
    }
    return p;
  });
}

/**
 * The Force grip (the Special's pose): the free hand rises above his head,
 * fingers hooked, and closes into a fist, the other hand holding the staff
 * low. He leans back a little, looking down on what he holds.
 */
function grip(view: View): Pose[] {
  const hands: Record<View, { x: number; y: number }[]> = {
    down: [{ x: 17.5, y: 21 }, { x: 18.5, y: 17 }, { x: 18, y: 12.5 }, { x: 17.8, y: 11.5 }, { x: 17.8, y: 11.5 }, { x: 17.8, y: 12 }],
    up: [{ x: 17.5, y: 21 }, { x: 18.5, y: 17 }, { x: 18, y: 12.5 }, { x: 17.8, y: 11.5 }, { x: 17.8, y: 11.5 }, { x: 17.8, y: 12 }],
    side: [{ x: 9, y: 20 }, { x: 7, y: 16 }, { x: 5, y: 11.5 }, { x: 5, y: 10.5 }, { x: 5, y: 10.5 }, { x: 5, y: 11 }],
  };
  const force = [0.2, 0.5, 0.85, 1, 1, 0.9];
  return force.map((k, i) => {
    const p = base(view);
    p.saber = { ...STAFF_LOW[view] };
    p.free = hands[view][i];
    p.force = k;
    p.breath = i === 1 ? 1 : 0;
    p.robe = i >= 3 ? (i % 2 ? 1 : 0) : 0;
    if (view === 'side') {
      p.lean = i >= 2 ? -1 : 0;
      p.footA = i >= 2 ? 1 : 0;
      p.footB = i >= 2 ? -1 : 0;
    }
    return p;
  });
}

// ---------------------------------------------------------------------------
// The idle moment (`rest`): a little performance when he's left standing, drawn facing the viewer only.

/** The upper body's drop in a pose, so hands can be placed in plain body pixels. */
const drop = (p: Pose): number => -p.lift + p.breath + Math.round((p.sit ?? 0) * SIT_DROP);

/** Put the free hand at (x, y) in body pixels, whatever the pose's drop. */
function freeAt(p: Pose, x: number, y: number): Pose {
  p.free = { x, y: y - drop(p) };
  return p;
}

/**
 * The Jedi knight meditates: he puts out his blade and sits down
 * cross-legged, lets the hilt go to hang in the air before him, closes his
 * eyes and rises a couple of pixels off the ground among motes of the Force,
 * then settles, takes the hilt back, stands, and lights the blade again.
 */
function meditate(view: View): Pose[] {
  if (view !== 'down') return [];
  const stand = idle('down')[0];
  const at = (o: Partial<Pose>): Pose => ({ ...base('down'), ...o });
  // Hands on the hilt before his chest: the saber hand at the grip, the other beside it.
  const holding = (sit: number, breath: number, y: number): Pose => {
    const p = at({ sit, breath, saber: sb(10.2, y + drop(at({ sit, breath })), 90, 0) });
    return freeAt(p, 14, y + drop(p) + 0.2);
  };
  // Seated with hands on the knees, the hilt floating at `hy` above the lap.
  const seated = (o: Partial<Pose>, hy: number): Pose => {
    const p = at({ sit: 1, blink: true, ...o });
    const d = drop(p);
    p.saber = sb(6.2, 27.6 - p.lift, 0, 0);
    p.hilt = { x: 12.2, y: hy + d, angle: 90 };
    return freeAt(p, 17.8, 27.6 - p.lift);
  };
  return [
    stand,
    // 1: the blade shrinks back into the hilt as he brings it in.
    at({ saber: sb(6.2, 21.6, -12, 5) }),
    // 2: blade out, both hands on the hilt; he dips, about to sit.
    holding(0, 1, 20.4),
    // 3-4: down into the seat, knees splaying, robe gathering.
    holding(0.4, 0, 20.4),
    holding(0.8, 0, 20.6),
    // 5: seated, the body settling a pixel, hands to the knees, the hilt left hanging.
    seated({ breath: 1, blink: false, robe: 1 }, 17.8),
    // 6: eyes closed, the hilt drifting up.
    seated({ motes: 1 }, 17.2),
    // 7-9: rising off the ground among the motes, the hilt bobbing.
    seated({ lift: 1, motes: 2 }, 16.6),
    seated({ lift: 2, motes: 3 }, 16.2),
    seated({ lift: 2, motes: 4, robe: -1 }, 15.9),
    // 10: sinking back down.
    seated({ lift: 1, motes: 5 }, 16.6),
    // 11: eyes open, the hilt drifting home into his hands.
    holding(1, 0, 20.6),
  ];
}

/** The knight's order: held frames while he floats, and the sitting played back to stand again. */
const MEDITATE_ORDER = [0, 1, 2, 3, 4, 5, 6, 6, 7, 8, 9, 8, 9, 8, 9, 10, 6, 6, 11, 4, 3, 2, 2, 1, 0] as const;

/**
 * The Sith's menace: he raises a clenched fist beside his face and Force
 * lightning crackles between the fingers; his head cocks toward it, the eyes
 * flare in the hood, he squeezes, and lowers it again.
 */
function menace(view: View): Pose[] {
  if (view !== 'down') return [];
  const stand = idle('down')[0];
  const fist = (x: number, y: number, o: Partial<Pose>): Pose => freeAt({ ...base('down'), ...o }, x, y);
  return [
    stand,
    // 1-2: the free hand comes up, closing, the first sparks at the knuckles.
    fist(18.2, 20, { breath: 1 }),
    fist(19, 17, { force: 0.35, fist: 1 }),
    // 3: the fist raised beside his face; the head starts to tip toward it.
    fist(19.2, 14, { force: 0.7, fist: 2, handFront: true, headX: 1 }),
    // 4-6: the head cocked, lightning crawling round the fingers, eyes flaring.
    fist(19.2, 13.6, { force: 1, fist: 3, handFront: true, headX: 1, headY: 1, glare: 0.3 }),
    fist(19.5, 13.7, { force: 1, fist: 4, handFront: true, headX: 1, headY: 1, glare: 0.8, robe: -1 }),
    fist(19.2, 13.5, { force: 1, fist: 5, handFront: true, headX: 1, headY: 1, glare: 0.5 }),
    // 7: the squeeze: the fist shakes and the lightning bursts out of it.
    fist(19.3, 14.2, { force: 1.25, fist: 6, handFront: true, headX: 1, headY: 1, glare: 1, robe: -1, breath: 1 }),
    // 8-9: the hand lowers, the last sparks dying, the head straightening.
    fist(19, 17.4, { force: 0.3, fist: 7, headX: 1 }),
    fist(17.8, 20.6, { force: 0.1, fist: 9 }),
  ];
}

const MENACE_ORDER = [0, 1, 2, 3, 3, 4, 5, 6, 4, 5, 6, 4, 7, 7, 5, 6, 8, 9, 9, 0] as const;

/** Screen angle (0 = right, 90 = down) he faces in each direction. */
export const FACING_DEG: Record<Dir, number> = { right: 0, down: 90, left: 180, up: 270 };

/** The finisher: a full turn with the blade held straight out, one pose per eighth of a turn. */
export const TWIRL_FRAMES = 8;

/** Which way a spin frame faces, and the angle drawn (right-facing frames are drawn facing left and mirrored). */
function spinAngle(k: number, count: number): { dir: Dir; deg: number; view: View } {
  const phi = (k * 360) / count;
  const dir: Dir = phi >= 45 && phi < 135 ? 'down' : phi >= 135 && phi < 225 ? 'left' : phi >= 225 && phi < 315 ? 'up' : 'right';
  const deg = dir === 'right' ? 180 - phi : phi;
  const view: View = dir === 'down' || dir === 'up' ? dir : 'side';
  return { dir, deg, view };
}

function twirlFrame(k: number): { dir: Dir; pose: Pose } {
  const { dir, deg, view } = spinAngle(k, TWIRL_FRAMES);
  const a = deg * RAD;
  const p = base(view);
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  p.saber = sb(12 + ca * 5.5, 20 + sa * 3.5, deg + 90, 12);
  p.saberBehind = sa < -0.35;
  p.breath = 1;
  p.robe = Math.round(-ca * 2);
  if (view !== 'side') p.free = { x: 12 - ca * 6, y: 19.5 - sa * 2 };
  p.footA = view === 'side' ? 1 : k % 2;
  p.footB = view === 'side' ? -1 : 1 - (k % 2);
  return { dir, pose: p };
}

/** The frame index of the twirl facing `dir`, where a twirl starting that way begins. */
export const twirlStart = (dir: Dir): number => Math.round(FACING_DEG[dir] / (360 / TWIRL_FRAMES)) % TWIRL_FRAMES;

/**
 * The Sith's finisher, the Dervish: the saberstaff whirled flat round him
 * from its middle as he lunges, one pose per eighth of a turn. Whichever
 * blade points towards us passes in front of him, the other behind.
 */
export const DERVISH_FRAMES = 8;

function dervishFrame(k: number): { dir: Dir; pose: Pose } {
  const { dir, deg, view } = spinAngle(k, DERVISH_FRAMES);
  const a = deg * RAD;
  const p = base(view);
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  p.saber = st(12 + ca * 1.5, 20 + sa * 0.8, deg + 90, 9);
  p.saberBehind = sa <= 0.35;
  p.rearFront = sa < -0.35;
  p.breath = 1;
  p.robe = Math.round(-ca * 2);
  if (view !== 'side') p.free = { x: 12 - ca * 6, y: 19.5 - sa * 2 };
  p.footA = view === 'side' ? 2 : k % 2;
  p.footB = view === 'side' ? -1 : 1 - (k % 2);
  if (view === 'side') p.lean = 1;
  return { dir, pose: p };
}

// ---------------------------------------------------------------------------
// Frame generation

export type JediAnim = 'idle' | 'walk' | 'slash1' | 'slash2' | 'push' | 'sweep1' | 'sweep2' | 'lightning' | 'grip' | 'rest' | 'idle_bare' | 'walk_bare';

export interface JediAnimDef {
  name: JediAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => Pose[];
  /** Frame indices to play in sequence, when some are held or repeated. */
  order?: readonly number[];
}

export const JEDI_ANIMS: JediAnimDef[] = [
  { name: 'idle', fps: 6, loop: true, poses: idle },
  { name: 'walk', fps: 10, loop: true, poses: walk },
  { name: 'slash1', fps: 22, loop: false, poses: slash('slash1') },
  { name: 'slash2', fps: 22, loop: false, poses: slash('slash2') },
  { name: 'push', fps: 12, loop: false, poses: push },
  { name: 'idle_bare', fps: 6, loop: true, poses: bare(idle) },
  { name: 'walk_bare', fps: 10, loop: true, poses: bare(walk) },
  { name: 'rest', fps: 8, loop: false, poses: meditate, order: MEDITATE_ORDER },
];

/** The Sith's: sweeps with the saberstaff, Force lightning, and the grip his Special is cast with. */
export const SITH_ANIMS: JediAnimDef[] = [
  { name: 'idle', fps: 6, loop: true, poses: idle },
  { name: 'walk', fps: 10, loop: true, poses: walk },
  { name: 'sweep1', fps: 21, loop: false, poses: slash('sweep1') },
  { name: 'sweep2', fps: 21, loop: false, poses: slash('sweep2') },
  { name: 'lightning', fps: 11, loop: false, poses: lightning },
  { name: 'grip', fps: 8, loop: false, poses: grip },
  { name: 'rest', fps: 8, loop: false, poses: menace, order: MENACE_ORDER },
];

export const jediAnimsFor = (look: JediLook): JediAnimDef[] => (look.staff ? SITH_ANIMS : JEDI_ANIMS);

/** Frame index at which each move lands. */
export const HIT_FRAME = { slash1: 1, slash2: 1, twirl: 3, push: 2, sweep1: 1, sweep2: 1, dervish: 1 } as const;

/** The lightning pours from the hand on these frames of its animation. */
export const LIGHTNING_FRAMES = { from: 2, to: 6 } as const;

/** Twirl playback speed: a whole turn in about a quarter of a second. */
export const TWIRL_FPS = 30;
/** The Dervish: a whole turn in about a third of a second, as he lunges. */
export const DERVISH_FPS = 26;

export interface JediFrame {
  key: string; // e.g. "walk_left_3", or "twirl_5"
  anim: JediAnim | 'twirl' | 'dervish';
  dir: Dir | null;
  canvas: PixelCanvas;
  meta: JediMeta;
}

function drawJediFrame(dir: Dir, pose: Pose): { canvas: PixelCanvas; meta: JediMeta } {
  const c = new PixelCanvas(JEDI_W, JEDI_H).offset(BODY_X, BODY_Y);
  hiddenHalo = [];
  const m = dir === 'down' ? drawDown(c, pose) : dir === 'up' ? drawUp(c, pose) : drawSide(c, pose);
  // A blade behind the body glows only where the body doesn't cover it.
  for (const [x, y, k] of hiddenHalo) {
    const under = c.materialAt(x, y);
    if (!under || under === S.blade.core || under === S.blade.edge) c.spark(x, y, S.bladeGlow, k);
  }
  hiddenHalo = [];
  const meta: JediMeta = {
    tipX: m.tip.x + BODY_X,
    tipY: m.tip.y + BODY_Y,
    handX: m.hand.x + BODY_X,
    handY: m.hand.y + BODY_Y,
    palmX: m.palm.x + BODY_X,
    palmY: m.palm.y + BODY_Y,
  };
  if (dir === 'right') return { canvas: c.mirrored(), meta: { ...meta, tipX: JEDI_W - meta.tipX, handX: JEDI_W - meta.handX, palmX: JEDI_W - meta.palmX } };
  return { canvas: c, meta };
}

export function buildJediFrames(look: JediLook = JEDI_LOOK): JediFrame[] {
  S = look;
  const out: JediFrame[] = [];
  for (const a of jediAnimsFor(look)) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, index) => {
        const { canvas, meta } = drawJediFrame(dir, pose);
        out.push({ key: `${a.name}_${dir}_${index}`, anim: a.name, dir, canvas, meta });
      });
    }
  }
  // The finisher's frames, played by angle (see heroSheets.ts): the Jedi's twirl or the Sith's Dervish.
  const spin = look.staff ? { name: 'dervish' as const, n: DERVISH_FRAMES, frame: dervishFrame } : { name: 'twirl' as const, n: TWIRL_FRAMES, frame: twirlFrame };
  for (let k = 0; k < spin.n; k++) {
    const { dir, pose } = spin.frame(k);
    const { canvas, meta } = drawJediFrame(dir, pose);
    out.push({ key: `${spin.name}_${k}`, anim: spin.name, dir: null, canvas, meta });
  }
  S = JEDI_LOOK;
  return out;
}
