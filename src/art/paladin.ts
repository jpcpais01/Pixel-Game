// The paladin, drawn procedurally from a small rig like the warrior.
//
// A holy tank: white-silver plate under an azure cape, a winged helm, a big
// heater shield with a glowing sun on the off arm and a flanged mace in the
// other. The body keeps to the 24x32 box; frames are larger so the mace can
// reach past it. Drawing functions work in body-box coordinates.
//
// The Crusader subtype shares the rig and poses but wears blackened plate, a
// crimson cape and shield, a closed great helm with a plume, and swings a
// warhammer that burns with sunfire.

import { PixelCanvas, cyl, sphere, type Material, type RGB, type Vec3 } from './pixel';
import { AZURE, BLACK_PLATE, BLACK_PLATE_DARK, CRIMSON, EYE, GOLD, HALLOW, HOLY_CORE, HOLY_HOT, HOLY_MID, IVORY, LEATHER, PLATE, PLATE_DARK, SKIN, SUNFIRE, SUN_CORE, SUN_HOT, SUN_MID, WOOD } from './palette';
import { DAWN, DAWN_CORE, DAWN_HOT, DAWN_MID, ECLIPSE_CORE, ECLIPSE_HOT, ECLIPSE_MID, FEATHER, HALO, HORN, OATH_CLOTH, OATH_PLATE, OATH_PLATE_DARK, PEARL, PEARL_DARK, SERAPH_HAIR, TARNISH, VOIDFIRE } from './heroSkins';
import { HAT, INQ_COAT, INQ_HAIR, INQ_LEATHER, INQ_RED, INQ_STEEL, LION_CORE, LION_FIRE, LION_HOT, LION_MID, LION_PLATE, LION_PLATE_DARK, LION_RED, MANE, PURGE, PURGE_CORE, PURGE_EMBER, PURGE_HOT, SILVER } from './paladinSkins';
import { DIRS, type Dir } from './wizard';

export const PALADIN_W = 48;
export const PALADIN_H = 50;
export const BODY_X = 12;
export const BODY_Y = 12;
/** Sprite origin in the frame: body centre, just under the boots. */
export const PALADIN_ORIGIN_X = BODY_X + 12;
export const PALADIN_ORIGIN_Y = BODY_Y + 31;
/** The chest's height above the origin. */
export const CHEST_Y = 11;

export interface PaladinLook {
  /** Texture key; anims are `<key>_<anim>_<dir>`. */
  key: string;
  plate: Material;
  plateDark: Material;
  /** Cape and shield field. */
  cape: Material;
  /** The shield's cross and the weapon head when it kindles. */
  emblem: Material;
  /** Light-only colours, brightest first: sparks round the weapon and the shield. */
  light: [RGB, RGB, RGB];
  /** Closed great helm with a plume, a cross on the tabard and a warhammer. */
  crusader: boolean;
  /** Trim: rims, bands, the crest and the emblems. */
  trim: Material;
  tabard: Material;
  /** Bare golden head under a floating halo, and great white wings (the Templar's Seraph skin). */
  seraph?: boolean;
  /** Horns on the great helm, spiked pauldrons, a tattered cloak and an eclipse on the shield (the Crusader's Oathbreaker skin). */
  oath?: boolean;
  /** A closed helm with a golden lion's face in a tawny mane, gold lions on the tabard and shield, a lion-headed mace (the Templar's Lionheart skin). */
  lion?: boolean;
  /** A wide-brimmed hat over a steel half-mask, a long coat and crimson sash, a censer at the belt and a white flame on the shield (the Crusader's Inquisitor skin). */
  inquisitor?: boolean;
}

export const HOLY_LOOK: PaladinLook = {
  key: 'paladin',
  plate: PLATE,
  plateDark: PLATE_DARK,
  cape: AZURE,
  emblem: HALLOW,
  light: [HOLY_CORE, HOLY_HOT, HOLY_MID],
  crusader: false,
  trim: GOLD,
  tabard: IVORY,
};

export const CRUSADER_LOOK: PaladinLook = {
  key: 'paladin_crusader',
  plate: BLACK_PLATE,
  plateDark: BLACK_PLATE_DARK,
  cape: CRIMSON,
  emblem: SUNFIRE,
  light: [SUN_CORE, SUN_HOT, SUN_MID],
  crusader: true,
  trim: GOLD,
  tabard: IVORY,
};

/** The Templar's Seraph skin: pearl plate, a dawn-rose cape, a halo and wings. */
export const SERAPH_LOOK: PaladinLook = {
  key: 'paladin_seraph',
  plate: PEARL,
  plateDark: PEARL_DARK,
  cape: DAWN,
  emblem: HALLOW,
  light: [DAWN_CORE, DAWN_HOT, DAWN_MID],
  crusader: false,
  trim: GOLD,
  tabard: IVORY,
  seraph: true,
};

/** The Crusader's Oathbreaker skin: black-violet plate, horns, tatters and violet flame. */
export const OATH_LOOK: PaladinLook = {
  key: 'paladin_oath',
  plate: OATH_PLATE,
  plateDark: OATH_PLATE_DARK,
  cape: OATH_CLOTH,
  emblem: VOIDFIRE,
  light: [ECLIPSE_CORE, ECLIPSE_HOT, ECLIPSE_MID],
  crusader: true,
  trim: TARNISH,
  tabard: OATH_CLOTH,
  oath: true,
};

/** The Templar's Lionheart skin: white-and-gold plate, a lion's face and mane on the helm, crimson and gold. */
export const LION_LOOK: PaladinLook = {
  key: 'paladin_lion',
  plate: LION_PLATE,
  plateDark: LION_PLATE_DARK,
  cape: LION_RED,
  emblem: LION_FIRE,
  light: [LION_CORE, LION_HOT, LION_MID],
  crusader: false,
  trim: GOLD,
  tabard: LION_RED,
  lion: true,
};

/** The Crusader's Inquisitor skin: dark steel and black leather, a brimmed hat, a crimson sash and white fire. */
export const INQUISITOR_LOOK: PaladinLook = {
  key: 'paladin_inquisitor',
  plate: INQ_STEEL,
  plateDark: INQ_LEATHER,
  cape: INQ_COAT,
  emblem: PURGE,
  light: [PURGE_CORE, PURGE_HOT, PURGE_EMBER],
  crusader: true,
  trim: SILVER,
  tabard: INQ_RED,
  inquisitor: true,
};

export const PALADIN_LOOKS = [HOLY_LOOK, CRUSADER_LOOK, SERAPH_LOOK, OATH_LOOK, LION_LOOK, INQUISITOR_LOOK];

/** The look being drawn; set by buildPaladinFrames. */
let S: PaladinLook = HOLY_LOOK;

export interface Mace {
  /** Hand (grip) position in body pixels. */
  hx: number;
  hy: number;
  /** Degrees; 0 = head straight up, positive turns clockwise. */
  angle: number;
  /** Hand to the centre of the head. */
  len: number;
}

export interface Pose {
  /** Whole body raised (walk passing frames, rising on the toes). */
  lift: number;
  /** Upper body lowered (breathing, crouching). */
  breath: number;
  /** Foot offsets. Side view: forward (+) / back (-). Front/back: lift. */
  footA: number;
  footB: number;
  /** Cape hem sway in pixels. */
  cape: number;
  /** Upper body shifted forward (side view), in pixels. */
  lean: number;
  mace: Mace;
  /** Mace, its arm and hand drawn behind the body. */
  maceBehind?: boolean;
  /** The shield hand, in body pixels. */
  shield: { x: number; y: number };
  blink?: boolean;
  /** 0..1 holy light in the mace head and the shield's sun. */
  glow: number;
  // The idle moment's extras (see `rest`), left unset by every other move.
  /** Down on one knee (the upper body lowered by `lift` going negative). */
  kneel?: boolean;
  /** The head nudged by whole pixels: bowed, lifted. */
  head?: { x: number; y: number };
  /** The shield set down here (its centre, in body pixels) with the hand resting on its rim, instead of held. */
  shieldAt?: { x: number; y: number };
  /** 0..1 a prayer's soft light: the shield's sun and the Seraph's halo brighten, the wings lift. */
  holy?: number;
  /** Light laid over the finished figure (glints, motes), in body pixels. */
  fx?: (c: PixelCanvas) => void;
}

export interface PaladinMeta {
  /** Centre of the mace head in frame pixels. */
  headX: number;
  headY: number;
  glow: number;
}

const RAD = Math.PI / 180;

// ---------------------------------------------------------------------------
// Shared parts

function each(x0: number, y0: number, x1: number, y1: number, fn: (x: number, y: number) => void): void {
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) fn(x, y);
}

/** A flanged mace: leather grip, gold-banded haft, a round steel head with gold flanges and a spike. */
function drawMace(c: PixelCanvas, m: Mace, glow: number): { x: number; y: number } {
  if (S.crusader) return drawHammer(c, m, glow);
  const a = m.angle * RAD;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const px = -dy;
  const py = dx;
  const reach = m.len + 4;
  const box = (fn: (x: number, y: number, along: number, side: number) => void) =>
    each(m.hx - reach, m.hy - reach, m.hx + reach, m.hy + reach, (x, y) => {
      const rx = x + 0.5 - m.hx;
      const ry = y + 0.5 - m.hy;
      fn(x, y, rx * dx + ry * dy, rx * px + ry * py);
    });
  const facing = (sx: number, sy: number, z: number): Vec3 => {
    const l = Math.hypot(sx, sy, z) || 1;
    return { x: sx / l, y: -sy / l, z: z / l };
  };
  const head = { x: m.hx + dx * m.len, y: m.hy + dy * m.len };

  // Pommel, grip, haft.
  c.part();
  box((x, y, along, side) => {
    if (Math.hypot(along + 2.2, side) < 0.8) c.px(x, y, S.trim, sphere(-0.4, -0.4), { bias: 1 });
  });
  c.part();
  box((x, y, along, side) => {
    if (along < -1.7 || along > m.len - 1.2 || Math.abs(side) > 0.6) return;
    const n = facing(px * side - 0.3, py * side + 0.3, 0.8);
    if (along < 1.1) c.px(x, y, LEATHER, n);
    else if (Math.abs(along - (m.len - 2)) < 0.55) c.px(x, y, S.trim, n);
    else c.px(x, y, S.lion ? S.plate : WOOD, n, { bias: 1 });
  });
  if (S.lion) lionHead(c, head, dx, dy, glow);
  else {
    // Flanges across the head and a spike on top, then the head over them.
    c.part();
    box((x, y, along, side) => {
      const flange = Math.abs(along - m.len) < 0.6 && Math.abs(side) < 2.7;
      const spike = along > m.len && along < m.len + 3 && Math.abs(side) < 0.6;
      if (flange || spike) c.px(x, y, glow > 0.5 ? S.emblem : S.trim, facing(px * side * 0.4 - 0.2, py * side * 0.4 - 0.3, 0.85), { glow: glow * 0.9 });
    });
    c.part();
    c.ellipse(head.x, head.y, 1.8, 1.8, glow > 0.5 ? S.emblem : S.plate, { glow: glow * 0.9 });
  }

  if (glow > 0) {
    // Motes of light circling the head.
    for (let k = 0; k < 6; k++) {
      const t = (k / 6) * Math.PI * 2 + m.angle * RAD;
      const r = 3 + (k % 2) * 0.8;
      c.spark(head.x + Math.cos(t) * r, head.y + Math.sin(t) * r * 0.85, k % 2 ? S.light[2] : S.light[1], glow * 0.6);
    }
    c.spark(head.x, head.y, S.light[0], glow);
  }
  return head;
}

/**
 * The Lionheart's mace head: a lion's face in gold inside a tufted mane, its
 * eyes toward the mace's tip; (dx, dy) is the way up the haft.
 */
function lionHead(c: PixelCanvas, head: { x: number; y: number }, dx: number, dy: number, glow: number): void {
  c.part();
  for (let y = Math.floor(head.y - 4); y <= Math.ceil(head.y + 4); y++) {
    for (let x = Math.floor(head.x - 4); x <= Math.ceil(head.x + 4); x++) {
      const rx = x + 0.5 - head.x;
      const ry = y + 0.5 - head.y;
      const tuft = 0.5 + 0.5 * Math.cos(Math.atan2(ry, rx) * 6);
      if (Math.hypot(rx, ry) > 2.4 + tuft * 0.6) continue;
      c.px(x, y, MANE, sphere(rx / 3, ry / 3, 1), { bias: tuft < 0.3 ? -1 : 0 });
    }
  }
  c.part();
  c.ellipse(head.x, head.y, 1.7, 1.7, glow > 0.5 ? S.emblem : S.trim, { glow: glow * 0.9 });
  // Two eyes a pixel toward the tip, either side of the nose.
  for (const k of [-1, 1]) c.shade(head.x + dx * 0.7 - dy * k * 0.9, head.y + dy * 0.7 + dx * k * 0.9, -2);
}

/** The Crusader's warhammer: a long haft, a squared steel head banded in gold, and a spike above it. */
function drawHammer(c: PixelCanvas, m: Mace, glow: number): { x: number; y: number } {
  const a = m.angle * RAD;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const px = -dy;
  const py = dx;
  const reach = m.len + 5;
  const box = (fn: (x: number, y: number, along: number, side: number) => void) =>
    each(m.hx - reach, m.hy - reach, m.hx + reach, m.hy + reach, (x, y) => {
      const rx = x + 0.5 - m.hx;
      const ry = y + 0.5 - m.hy;
      fn(x, y, rx * dx + ry * dy, rx * px + ry * py);
    });
  const facing = (sx: number, sy: number, z: number): Vec3 => {
    const l = Math.hypot(sx, sy, z) || 1;
    return { x: sx / l, y: -sy / l, z: z / l };
  };
  const head = { x: m.hx + dx * m.len, y: m.hy + dy * m.len };
  const lit = glow > 0.5;

  // Pommel, grip, haft.
  c.part();
  box((x, y, along, side) => {
    if (Math.hypot(along + 2.2, side) < 0.8) c.px(x, y, S.trim, sphere(-0.4, -0.4), { bias: 1 });
  });
  c.part();
  box((x, y, along, side) => {
    if (along < -1.7 || along > m.len - 1.4 || Math.abs(side) > 0.6) return;
    const n = facing(px * side - 0.3, py * side + 0.3, 0.8);
    if (along < 1.1) c.px(x, y, LEATHER, n);
    else c.px(x, y, S.inquisitor ? S.plate : WOOD, n, { bias: 1 });
  });
  // The spike, then the head across the haft: steel faces with gold bands at each end.
  c.part();
  box((x, y, along, side) => {
    if (along > m.len + 1.9 && along < m.len + 4.0 && Math.abs(side) < 0.6) c.px(x, y, lit ? S.emblem : S.trim, facing(-0.2, -0.3, 0.9), { glow: glow * 0.9 });
  });
  c.part();
  box((x, y, along, side) => {
    const u = along - m.len;
    if (Math.abs(u) > 2.0 || Math.abs(side) > 3.7) return;
    const n = facing(px * side * 0.3 - 0.2 + dx * u * 0.3, py * side * 0.3 - 0.3 + dy * u * 0.3, 0.85);
    const band = Math.abs(side) > 2.7 || Math.abs(u) < 0.5;
    const mat = lit ? S.emblem : band ? S.trim : S.plate;
    c.px(x, y, mat, n, { glow: lit ? glow * 0.9 : 0, bias: u > 1 ? 1 : u < -1 ? -1 : 0 });
  });

  if (glow > 0) {
    // Embers circling the head.
    for (let k = 0; k < 6; k++) {
      const t = (k / 6) * Math.PI * 2 + m.angle * RAD;
      const r = 3.6 + (k % 2) * 0.8;
      c.spark(head.x + Math.cos(t) * r, head.y + Math.sin(t) * r * 0.85, k % 2 ? S.light[2] : S.light[1], glow * 0.6);
    }
    c.spark(head.x, head.y, S.light[0], glow);
  }
  return head;
}

function limb(c: PixelCanvas, sx: number, sy: number, hx: number, hy: number, bias = 0): void {
  c.part();
  const vx = hx - sx;
  const vy = hy - sy;
  const l = Math.hypot(vx, vy) || 1;
  c.capsule(sx, sy, hx - (vx / l) * 1.0, hy - (vy / l) * 1.0, 1.35, 1.15, S.plateDark, { bias });
}

function gauntlet(c: PixelCanvas, x: number, y: number): void {
  c.part();
  c.ellipse(x, y, 1.3, 1.25, S.plate, { bias: -1 });
}

function pauldron(c: PixelCanvas, x: number, y: number, rx = 2.8, ry = 2.0): void {
  c.part();
  c.ellipse(x, y, rx, ry, S.plate, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.3, 0.95) });
  // A gold lip on the lower edge.
  c.part();
  c.shape(Math.round(y + ry - 0.5), Math.round(y + ry - 0.5), () => [x - rx + 0.7, x + rx - 0.7], S.trim, (_x, _y, t) => cyl(t, -0.2));
  if (S.oath) {
    // A spike jutting up and out from each pauldron.
    const k = x < 12 ? -1 : 1;
    c.part();
    c.capsule(x + k * 0.4, y - ry + 0.8, x + k * 1.6, y - ry - 2.4, 0.9, 0.3, S.plate, { bias: 1 });
  }
}

function boot(c: PixelCanvas, x: number, y: number, side = false, bias = 0): void {
  c.part();
  if (side) c.ellipse(x, y, 2.3, 1.3, S.plateDark, { flatten: 0.8, bias });
  else c.ellipse(x, y, 1.85, 1.35, S.plateDark, { flatten: 0.8, bias });
}

function leg(c: PixelCanvas, hx: number, hy: number, fx: number, fy: number, bias = 0): void {
  c.part();
  c.capsule(hx, hy, fx, fy, 1.5, 1.3, S.plateDark, { bias });
}

/** Heater shield outline: flat top with rounded corners, tapering to a point. */
function heater(hw: number, y0: number, y1: number): (y: number) => [number, number] | null {
  return (y) => {
    const u = (y + 0.5 - y0) / (y1 + 1 - y0);
    let w = u < 0.45 ? hw : hw * (1 - Math.pow((u - 0.45) / 0.55, 1.5)) + 0.35;
    if (y === y0) w -= 0.6;
    return w < 0.4 ? null : [-w, w];
  };
}

/** The shield seen from the front: gold rim, azure field, a glowing sun cross. `hw` narrows it in profile. */
function shieldFront(c: PixelCanvas, cx: number, cy: number, hw: number, glow: number): void {
  const y0 = Math.round(cy - 5);
  const y1 = Math.round(cy + 5);
  const rim = heater(hw, y0, y1);
  const field = heater(hw - 1, y0 + 1, y1 - 1);
  const at = (f: (y: number) => [number, number] | null) => (y: number): [number, number] | null => {
    const e = f(y);
    return e ? [cx + e[0], cx + e[1]] : null;
  };
  const bulge = (_x: number, _y: number, t: number, u: number) => cyl(t * 0.7, 0.35 - u * 0.5);
  c.part();
  c.shape(y0, y1, at(rim), S.trim, bulge);
  c.part();
  c.shape(y0 + 1, y1 - 1, at(field), S.cape, bulge);
  // The sun: a cross with a bright boss, glowing faintly even at rest.
  c.part();
  const sy = Math.round(cy - 1);
  const sx = Math.floor(cx);
  const g = { glow: 0.3 + glow * 0.7 };
  const arm = hw > 2.5 ? 2 : 1;
  if (S.lion) {
    lionBoss(c, sx, sy, arm === 2, glow);
    return;
  }
  if (S.inquisitor) {
    // A white flame, the purging fire, with an ember flying off its tip.
    const flame = arm === 2 ? [[0, -2], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1], [0, 2]] : [[0, -2], [0, -1], [-1, 0], [0, 0], [-1, 1], [0, 1], [0, 2]];
    for (const [ox, oy] of flame) c.px(sx + ox, sy + oy, S.emblem, { x: ox * 0.3, y: 0.3 - oy * 0.15, z: 0.9 }, { glow: 0.4 + glow * 0.6, bias: oy < 0 ? 1 : 0 });
    c.spark(sx, sy + 1, S.light[0], 0.3 + glow * 0.7);
    c.spark(sx + 1, sy - 3, S.light[2], 0.45 + glow * 0.5);
    if (glow > 0) for (const [ox, oy] of [[0, -4], [-arm, -2], [arm, -1]]) c.spark(sx + ox, sy + oy, S.light[1], glow * 0.45);
    return;
  }
  if (S.oath) {
    // An eclipse: a ring of violet fire round a black heart.
    for (const [ox, oy] of [[0, -2], [1, -2], [-1, -1], [2, -1], [-1, 0], [2, 0], [0, 1], [1, 1]]) c.px(sx + ox - (arm === 1 ? 0 : 0), sy + oy, S.emblem, { x: (ox - 0.5) * 0.3, y: -(oy + 0.5) * 0.3, z: 0.9 }, g);
    if (glow > 0) c.spark(sx, sy - 1, S.light[1], glow * 0.6);
    return;
  }
  for (let i = -2; i <= 2; i++) c.px(sx, sy + i + (i > 0 ? 1 : 0), S.emblem, { x: -0.2, y: 0.2 - i * 0.1, z: 0.95 }, g);
  for (let i = -arm; i <= arm; i++) if (i) c.px(sx + i, sy, S.emblem, { x: i * 0.2 - 0.2, y: 0.25, z: 0.95 }, g);
  c.px(sx, sy, S.emblem, { x: -0.3, y: 0.4, z: 0.86 }, { glow: 0.5 + glow * 0.5, bias: 1 });
  if (glow > 0) {
    c.spark(sx, sy, S.light[0], glow);
    for (const [ox, oy] of [[0, -3], [0, 4], [-arm - 1, 0], [arm + 1, 0]]) c.spark(sx + ox, sy + oy, S.light[1], glow * 0.45);
  }
}

/** The Lionheart's shield boss: a lion's face of kindled gold in a ring of gold mane. */
function lionBoss(c: PixelCanvas, sx: number, sy: number, wide: boolean, glow: number): void {
  const g = { glow: 0.3 + glow * 0.7 };
  if (wide) {
    for (const [ox, oy] of [[-1, -2], [0, -2], [1, -2], [-2, -1], [2, -1], [-2, 0], [2, 0], [-2, 1], [2, 1], [-1, 2], [1, 2]]) {
      c.px(sx + ox, sy + oy, S.trim, { x: ox * 0.3, y: -oy * 0.3, z: 0.88 }, { bias: oy < 0 ? 1 : 0 });
    }
    for (const [ox, oy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [0, 1], [0, 2]]) c.px(sx + ox, sy + oy, S.emblem, { x: ox * 0.2 - 0.1, y: 0.3 - oy * 0.15, z: 0.92 }, g);
    c.shade(sx - 1, sy - 1, -2);
    c.shade(sx + 1, sy - 1, -2);
    c.shade(sx, sy + 1, -1);
  } else {
    for (const [ox, oy] of [[0, -2], [-1, -1], [-1, 0], [-1, 1], [0, 2]]) c.px(sx + ox, sy + oy, S.trim, { x: -0.3, y: -oy * 0.3, z: 0.88 });
    for (const [ox, oy] of [[0, -1], [0, 0], [0, 1]]) c.px(sx + ox, sy + oy, S.emblem, { x: -0.1, y: 0.3 - oy * 0.15, z: 0.92 }, g);
    c.shade(sx, sy - 1, -2);
  }
  if (glow > 0) {
    c.spark(sx, sy, S.light[0], glow);
    for (const [ox, oy] of [[0, -3], [0, 3], [-3, 0], [3, 0]]) c.spark(sx + ox, sy + oy, S.light[1], glow * 0.45);
  }
}

/** The shield from behind: a plate rim round oak boards, with the leather straps. */
function shieldBack(c: PixelCanvas, cx: number, cy: number, hw: number): void {
  const y0 = Math.round(cy - 5);
  const y1 = Math.round(cy + 5);
  const at = (f: (y: number) => [number, number] | null) => (y: number): [number, number] | null => {
    const e = f(y);
    return e ? [cx + e[0], cx + e[1]] : null;
  };
  const hollow = (_x: number, _y: number, t: number, u: number) => cyl(-t * 0.5, u * 0.3 - 0.1);
  c.part();
  c.shape(y0, y1, at(heater(hw, y0, y1)), S.plateDark, hollow);
  c.part();
  c.shape(y0 + 1, y1 - 1, at(heater(hw - 1, y0 + 1, y1 - 1)), WOOD, hollow, { bias: -1 });
  c.part();
  for (const y of [cy - 2, cy + 1]) c.shape(Math.round(y), Math.round(y), () => [cx - hw + 1.5, cx + hw - 1.5], LEATHER, (_x, _y, t) => cyl(t, 0.1));
}

/** Helmet dome rows y0..y1 (the rim is the last row), centred on cx. */
function dome(c: PixelCanvas, cx: number, y0: number, y1: number, hw: number, back = 0): void {
  c.part();
  c.shape(
    y0,
    y1 - 1,
    (y) => {
      const u = (y + 0.5 - y0) / (y1 - y0);
      const w = 1.4 + (hw - 1.4) * Math.sqrt(u);
      return [cx - w, cx + w + back * u];
    },
    S.plate,
    (_x, _y, t, u) => sphere(t * 0.95, u * 1.25 - 0.95, 1),
  );
  c.part();
  c.shape(y1, y1, () => [cx - hw - 0.3, cx + hw + 0.3 + back], S.trim, (_x, _y, t) => cyl(t, -0.2));
}

/** A small white wing on the helm, from its root sweeping up and out by (sx, sy). */
function wing(c: PixelCanvas, x: number, y: number, sx: number, sy: number): void {
  if (S.crusader || S.lion) return;
  c.part();
  c.capsule(x, y, x + sx, y + sy, 1.05, 0.55, IVORY, { bias: 1 });
  c.part();
  c.capsule(x + sx * 0.1, y + 1, x + sx * 0.95, y + sy * 0.45 + 1, 0.85, 0.5, IVORY);
}

/** Gold crest along the top of the helm. */
function crest(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number): void {
  c.part();
  c.capsule(x0, y0, x1, y1, 1.0, 0.8, S.trim, { bias: 1 });
}

/** The Crusader's crimson plume: full at its root on the helm, tapering to its tip. */
function plume(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number): void {
  if (S.oath) return;
  c.part();
  c.capsule(x0, y0, x1, y1, 1.5, 0.9, CRIMSON, { bias: 1 });
}

/** A small gold sun on the tabard or the cape, centred on row `y`. */
function sun(c: PixelCanvas, y: number): void {
  c.px(11, y - 1, S.trim, { x: -0.3, y: 0.5, z: 0.8 }, { bias: 1 });
  c.px(12, y - 1, S.trim, { x: 0.2, y: 0.5, z: 0.84 });
  c.px(10, y, S.trim, { x: -0.4, y: 0.1, z: 0.9 });
  c.px(11, y, S.trim, FLAT_DOWN, { bias: 1 });
  c.px(12, y, S.trim, FLAT_DOWN, { bias: 1 });
  c.px(13, y, S.trim, { x: 0.4, y: 0.1, z: 0.9 });
  c.px(11, y + 1, S.trim, FLAT_DOWN, { bias: -1 });
  c.px(12, y + 1, S.trim, FLAT_DOWN, { bias: -1 });
}

/** A two-pixel-wide cross whose arms meet on row `y`. */
function cross(c: PixelCanvas, y: number, m: Material): void {
  for (let r = y - 2; r <= y + 3; r++) {
    c.px(11, r, m, { x: -0.25, y: 0.3, z: 0.9 }, { bias: r === y - 2 ? 1 : 0 });
    c.px(12, r, m, { x: 0.2, y: 0.3, z: 0.9 }, { bias: r > y + 1 ? -1 : 0 });
  }
  for (const x of [9, 10, 13, 14]) c.px(x, y, m, { x: (x - 11.5) * 0.15, y: 0.35, z: 0.9 }, { bias: x < 11 ? 1 : 0 });
}

/**
 * The Crusader's great helm from the front: a flat-topped steel barrel over the
 * whole face, a gold brow band and nasal bar, an eye slit with sunfire behind
 * it, breathing holes and a crimson plume.
 */
function greatHelmFront(c: PixelCanvas, cx: number, U: number, blink: boolean): void {
  const y0 = 5 + U;
  const y1 = 14 + U;
  c.part();
  c.shape(y0, y1, (y) => {
    const hw = y === y0 ? 3.6 : y === y1 ? 3.9 : 4.4;
    return [cx - hw, cx + hw];
  }, S.plate, (_x, y, t) => cyl(t * 0.95, y === y0 ? 0.75 : y < y0 + 3 ? 0.3 : 0));
  c.part();
  c.shape(10 + U, 10 + U, () => [cx - 4.4, cx + 4.4], S.trim, (_x, _y, t) => cyl(t, 0.2));
  // Eye slit either side of the nasal bar.
  c.part();
  for (const x of [8, 9, 10, 13, 14, 15]) c.px(x, 11 + U, EYE);
  if (!blink) {
    c.spark(9, 11 + U, S.light[2], 0.8);
    c.spark(14, 11 + U, S.light[2], 0.8);
  }
  c.part();
  for (let y = 11 + U; y <= y1; y++) {
    c.px(11, y, S.trim, { x: -0.3, y: 0.1, z: 0.95 }, { bias: 1 });
    c.px(12, y, S.trim, { x: 0.3, y: 0.1, z: 0.95 });
  }
  for (const [x, y] of [[9, 13], [14, 13], [9, 14], [14, 14]]) c.shade(x, y + U, -2);
  if (S.oath) helmHorns(c, cx, U);
  else plume(c, cx, 2.6 + U, cx, 5.6 + U);
}

/** The great helm in profile, facing left: slit and breathing holes at the front, the plume sweeping back. */
function greatHelmSide(c: PixelCanvas, hx: number, U: number, blink: boolean): void {
  const y0 = 5 + U;
  const y1 = 14 + U;
  const back = hx + 3.4;
  c.part();
  c.shape(y0, y1, (y) => {
    const front = y === y0 ? hx - 4.0 : y > y1 - 3 ? hx - 4.4 - (y - (y1 - 3)) * 0.35 : hx - 4.6;
    return [front, y === y0 ? back - 0.6 : back];
  }, S.plate, (_x, y, t) => cyl(t * 0.9 - 0.1, y === y0 ? 0.75 : y < y0 + 3 ? 0.3 : 0));
  c.part();
  c.shape(10 + U, 10 + U, () => [hx - 4.6, back], S.trim, (_x, _y, t) => cyl(t, 0.2));
  c.part();
  for (const x of [hx - 5, hx - 4, hx - 3]) c.px(x, 11 + U, EYE);
  if (!blink) c.spark(hx - 4, 11 + U, S.light[2], 0.8);
  c.part();
  for (let y = 11 + U; y <= y1; y++) c.px(hx - 5, y, S.trim, { x: -0.6, y: 0.1, z: 0.8 }, { bias: 1 });
  for (const y of [13, 14]) c.shade(hx - 3, y + U, -2);
  if (S.oath) helmHornsSide(c, hx, U);
  else plume(c, hx - 1, 3.4 + U, hx + 4.8, 8.4 + U);
}

const FLAT_DOWN: Vec3 = { x: 0, y: -0.3, z: 0.95 };

// ---------------------------------------------------------------------------
// The Seraph and the Oathbreaker

/** A great feathered wing from the back, `k` = -1 to the screen left, 1 to the right; (rx, ry) is its root. */
function bigWing(c: PixelCanvas, rx: number, ry: number, k: number, lift: number, reach = 1): void {
  // Feathers from the lowest up, each overlapping the one below; then the leading edge.
  const tips: [number, number][] = [
    [6.8, 8.6],
    [8.6, 6.0],
    [9.8, 2.4],
    [10.2, -1.6],
    [9.4, -5.0],
  ];
  tips.forEach(([tx, ty], i) => {
    c.part();
    c.capsule(rx + k * 1.2, ry + i * 0.2 - 1, rx + k * tx * reach, ry + ty - lift * (i / 4), 1.7, 0.75, FEATHER, { bias: i % 2 ? 0 : -1 });
  });
  c.part();
  const ex = rx + k * 5.4 * reach;
  const ey = ry - 5.2 - lift;
  c.capsule(rx, ry, ex, ey, 1.5, 1.2, FEATHER, { bias: 1 });
  c.capsule(ex, ey, rx + k * 9.4 * reach, ry - 5.4 - lift, 1.2, 0.8, FEATHER, { bias: 1 });
}

/** The halo: a ring of light floating over the head, seen at a tilt. */
function halo(c: PixelCanvas, cx: number, cy: number, rx: number, ry: number, bright = 0): void {
  c.part();
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const q = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
      if (q > 1.05 || q < 0.55) continue;
      c.px(x, y, HALO, { x: 0, y: 0.3, z: 0.95 }, { bias: y + 0.5 > cy ? 1 : 0 });
      c.spark(x, y, S.light[1], 0.35 + bright * 0.5);
    }
  }
}

function seraphHeadFront(c: PixelCanvas, cx: number, U: number, blink: boolean, bright = 0): void {
  c.part();
  c.ellipse(cx, 12.6 + U, 3.2, 2.8, SKIN);
  c.part();
  c.px(11, 13 + U, SKIN, sphere(-0.4, -0.3), { bias: 1 });
  c.px(12, 13 + U, SKIN, sphere(0.35, -0.2));
  c.shade(12, 14 + U, -1);
  c.part();
  if (blink) {
    c.px(10, 12 + U, SKIN, FLAT_DOWN, { bias: -1 });
    c.px(13, 12 + U, SKIN, FLAT_DOWN, { bias: -1 });
  } else {
    c.px(10, 12 + U, EYE);
    c.px(13, 12 + U, EYE);
  }
  // Golden curls over the brow and down to the jaw.
  c.part();
  const widths = [2.6, 3.7, 4.2, 4.4];
  c.shape(7 + U, 10 + U, (y) => [cx - widths[y - 7 - U], cx + widths[y - 7 - U]], SERAPH_HAIR, (_x, _y, t, u) => sphere(t * 0.9, u * 1.2 - 0.9, 1));
  for (let y = 11; y <= 14; y++) {
    c.px(8, y + U, SERAPH_HAIR, cyl(-0.8, 0), { bias: y % 2 ? 0 : -1 });
    c.px(15, y + U, SERAPH_HAIR, cyl(0.8, 0), { bias: y % 2 ? 0 : -1 });
  }
  c.px(7, 12 + U, SERAPH_HAIR, cyl(-0.9, 0), { bias: -1 });
  c.px(16, 12 + U, SERAPH_HAIR, cyl(0.9, 0), { bias: -1 });
  c.shade(10, 9 + U, -1);
  c.shade(13, 8 + U, -1);
  c.px(11, 10 + U, SKIN, sphere(-0.1, -0.8));
  halo(c, cx, 4.8 + U, 3.6, 1.3, bright);
}

function seraphHeadBack(c: PixelCanvas, cx: number, U: number): void {
  c.part();
  c.ellipse(cx, 10.8 + U, 4.3, 4.0, SERAPH_HAIR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.95, dy * 0.9 - 0.2, 1) });
  c.part();
  c.shape(13 + U, 15 + U, (y) => {
    const hw = [3.6, 3.0, 2.0][y - 13 - U];
    return [cx - hw, cx + hw];
  }, SERAPH_HAIR, (_x, _y, t, u) => sphere(t * 0.8, u * 0.6, 1));
  for (const [x, y] of [[10, 9], [13, 10], [11, 12], [14, 13], [9, 13]]) c.shade(x, y + U, -1);
  halo(c, cx, 4.8 + U, 3.6, 1.3);
}

/** Facing left. */
function seraphHeadSide(c: PixelCanvas, hx: number, U: number, blink: boolean): void {
  c.part();
  c.ellipse(hx - 1.2, 12.8 + U, 2.9, 2.7, SKIN);
  c.part();
  c.px(hx - 5, 13 + U, SKIN, sphere(-0.6, -0.2), { bias: 1 });
  c.shade(hx - 4, 14 + U, -1);
  c.part();
  if (blink) c.px(hx - 3, 12 + U, SKIN, FLAT_DOWN, { bias: -1 });
  else c.px(hx - 3, 12 + U, EYE);
  c.part();
  const rows: [number, number][] = [
    [-2.9, 2.2],
    [-3.8, 2.9],
    [-4.2, 3.3],
    [-4.2, 3.4],
    [0.2, 3.4],
    [0.4, 3.3],
    [0.8, 3.0],
    [1.2, 2.4],
  ];
  c.shape(7 + U, 14 + U, (y) => {
    const [l, r] = rows[y - 7 - U];
    return [hx + l, hx + r];
  }, SERAPH_HAIR, (_x, _y, t, u) => sphere(t * 0.9, u * 1.4 - 0.9, 1));
  c.erase(hx - 5, 10 + U);
  for (const [x, y] of [[1, 9], [2, 11], [1, 13]]) c.shade(hx + x, y + U, -1);
  halo(c, hx - 0.4, 4.8 + U, 2.8, 1.2);
}

/** Two short horns on the great helm, curving up and out (front and back views). */
function helmHorns(c: PixelCanvas, cx: number, U: number): void {
  for (const k of [-1, 1]) {
    c.part();
    c.capsule(cx + k * 3.6, 7 + U, cx + k * 5.8, 5.4 + U, 1.2, 0.9, HORN, { bias: -1 });
    c.capsule(cx + k * 5.8, 5.4 + U, cx + k * 6.6, 3.0 + U, 0.9, 0.6, HORN);
    c.capsule(cx + k * 6.6, 3.0 + U, cx + k * 6.0, 1.0 + U, 0.6, 0.3, HORN, { bias: 1 });
  }
}

/** The horns in profile, facing left: the near one sweeping forward, the far one peeking over. */
function helmHornsSide(c: PixelCanvas, hx: number, U: number): void {
  c.part();
  c.capsule(hx + 1, 6.4 + U, hx - 0.8, 3.8 + U, 1.0, 0.6, HORN, { bias: -1 });
  c.capsule(hx - 0.8, 3.8 + U, hx - 1.2, 1.8 + U, 0.6, 0.3, HORN, { bias: -1 });
  c.part();
  c.capsule(hx - 0.6, 6.6 + U, hx - 3.4, 4.8 + U, 1.2, 0.9, HORN);
  c.capsule(hx - 3.4, 4.8 + U, hx - 4.4, 2.4 + U, 0.9, 0.55, HORN);
  c.capsule(hx - 4.4, 2.4 + U, hx - 3.8, 0.6 + U, 0.55, 0.3, HORN, { bias: 1 });
}

/** An eclipse on the tabard or cloak: a ring of violet fire round a black heart, on row `y`. */
function eclipse(c: PixelCanvas, y: number): void {
  for (const [x, yy] of [[11, y - 2], [12, y - 2], [10, y - 1], [13, y - 1], [10, y], [13, y], [11, y + 1], [12, y + 1]]) {
    c.px(x, yy, S.emblem, { x: (x - 11.5) * 0.25, y: -(yy - y + 0.5) * 0.25, z: 0.9 }, { glow: 0.7 });
  }
  for (const [x, yy] of [[11, y - 1], [12, y - 1], [11, y], [12, y]]) c.shade(x, yy, -2);
}

/** A torn hem: points of cloth hanging below row `y`, notches between them. */
function tatters(c: PixelCanvas, l: number, r: number, y: number, m: Material): void {
  c.part();
  for (let x = Math.round(l); x < Math.round(r); x++) {
    const k = ((x % 3) + 3) % 3;
    if (k === 0) c.px(x, y + 1, m, cyl(0, -0.3), { bias: -1 });
    else if (k === 1) c.erase(x, y);
  }
}

// ---------------------------------------------------------------------------
// The Lionheart and the Inquisitor

const MANE_TUFTS = 9;
/** How deep the notches between the mane's tufts cut, as a share of its radius. */
const MANE_NOTCH = 0.18;

/** A tufted mane round (cx, cy): tufts reach the full radius, notches cut in between. */
function maneRuff(c: PixelCanvas, cx: number, cy: number, rx: number, ry: number, phase = 0): void {
  c.part();
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const q = Math.hypot(dx, dy);
      const tuft = 0.5 + 0.5 * Math.cos(Math.atan2(dy, dx) * MANE_TUFTS + phase);
      if (q > 1 - MANE_NOTCH * (1 - tuft)) continue;
      // Strands darken into the notches, so the tufts read apart.
      c.px(x, y, MANE, sphere(dx * 0.9, dy * 0.9, 1), { bias: tuft < 0.35 && q > 0.6 ? -1 : 0 });
    }
  }
}

/** The short tawny plume on the crown of the lion helm, from its root up by (sx, sy). */
function maneTuft(c: PixelCanvas, x: number, y: number, sx: number, sy: number): void {
  c.part();
  c.capsule(x, y, x + sx, y + sy, 1.6, 0.9, MANE, { bias: 1 });
}

/** Small round gold ears on the helm. */
function lionEar(c: PixelCanvas, x: number, y: number): void {
  c.part();
  c.ellipse(x, y, 1.15, 1.1, S.trim, { bias: 1 });
  c.shade(Math.floor(x), Math.floor(y) + 1, -1);
}

/**
 * The lion helm from the front: a white dome ringed by a tawny mane, gold
 * ears, and a golden lion's face for a visor whose eyes burn amber.
 */
function lionHelmFront(c: PixelCanvas, cx: number, U: number, blink: boolean): void {
  maneRuff(c, cx, 10.4 + U, 6.6, 5.8);
  maneTuft(c, cx - 0.3, 5.2 + U, 0.6, -1.6);
  dome(c, cx, 5 + U, 10 + U, 4.6);
  lionEar(c, cx - 3.4, 6.4 + U);
  lionEar(c, cx + 3.4, 6.4 + U);
  c.part();
  c.shape(11 + U, 14 + U, (y) => {
    const hw = y === 14 + U ? 3.6 : 4.3;
    return [cx - hw, cx + hw];
  }, S.plate, (_x, _y, t) => cyl(t * 0.95, 0));
  // The face: a muzzle of gold, rounded so it catches the light at the brow and nose.
  c.part();
  const rows: [number, number][] = [[9, 14], [9, 14], [10, 13], [10, 13], [11, 12]];
  rows.forEach(([l, r], i) => {
    for (let x = l; x <= r; x++) c.px(x, 11 + i + U, S.trim, sphere((x + 0.5 - cx) / 3.2, (i - 1.6) / 2.8, 1), { bias: i === 0 ? 1 : 0 });
  });
  // Nose bridge, the nose pad, a snarling mouth and the eyes.
  c.shade(11, 12 + U, 1);
  c.shade(11, 13 + U, -1);
  c.shade(12, 13 + U, -1);
  c.shade(11, 14 + U, -2);
  c.shade(12, 14 + U, -2);
  if (!blink) {
    c.px(10, 11 + U, EYE);
    c.px(13, 11 + U, EYE);
    c.spark(10, 11 + U, S.light[1], 0.75);
    c.spark(13, 11 + U, S.light[1], 0.75);
  } else {
    c.shade(10, 11 + U, -2);
    c.shade(13, 11 + U, -2);
  }
}

/** The lion helm from behind: the mane all round, falling in three locks over the nape. */
function lionHelmBack(c: PixelCanvas, cx: number, U: number): void {
  maneRuff(c, cx, 10.6 + U, 6.6, 6.0, 0.4);
  c.part();
  c.ellipse(cx, 10.2 + U, 4.8, 4.5, S.plate, { normal: (_x, _y, dx, dy) => sphere(dx * 0.95, dy * 0.9 - 0.15, 1) });
  c.part();
  c.shape(Math.round(13 + U), Math.round(13 + U), () => [cx - 3.6, cx + 3.6], S.trim, (_x, _y, t) => cyl(t, -0.2));
  lionEar(c, cx - 3.4, 6.4 + U);
  lionEar(c, cx + 3.4, 6.4 + U);
  maneTuft(c, cx - 0.3, 5.2 + U, 0.6, -1.6);
  for (const k of [-1, 0, 1]) {
    c.part();
    c.capsule(cx + k * 1.7, 13.4 + U, cx + k * 2.2, 17.4 + U - Math.abs(k) * 0.9, 1.25, 0.7, MANE, { bias: k ? -1 : 0 });
  }
}

/** The lion helm in profile, facing left: the gold muzzle juts forward, the mane sweeps back. */
function lionHelmSide(c: PixelCanvas, hx: number, U: number, blink: boolean): void {
  maneRuff(c, hx + 1.6, 10.4 + U, 5.0, 5.8, 0.6);
  maneTuft(c, hx + 0.4, 5.0 + U, 1.4, -1.4);
  dome(c, hx - 0.2, 5 + U, 10 + U, 4.6, 0.6);
  lionEar(c, hx + 1.2, 6.0 + U);
  c.part();
  c.shape(11 + U, 14 + U, (y) => [hx - 2, hx + 3.4 - (y - 11 - U) * 0.3], S.plate, (_x, _y, t, u) => sphere(t * 0.7 + 0.2, u * 0.8, 1));
  c.part();
  const front = [-4.8, -5.0, -5.6, -5.6, -5.0, -3.8];
  c.shape(10 + U, 15 + U, (y) => [hx + front[y - 10 - U], hx - 1.2], S.trim, (_x, _y, t, u) => sphere(t * 0.8 - 0.2, u * 1.2 - 0.5, 1));
  c.shade(hx - 6, 12 + U, 1);
  c.shade(hx - 6, 13 + U, -1);
  c.shade(hx - 5, 14 + U, -2);
  c.shade(hx - 4, 14 + U, -1);
  if (!blink) {
    c.px(hx - 3, 11 + U, EYE);
    c.spark(hx - 3, 11 + U, S.light[1], 0.75);
  } else c.shade(hx - 3, 11 + U, -2);
}

/** A gold lion rampant (rearing, facing the viewer's left), six pixels wide, rows y-2..y+3. */
const RAMPANT = ['.XX...', 'XXX..X', 'XXXX.X', '.XXXX.', '..XXX.', '.XX.XX'];
function rampant(c: PixelCanvas, y: number): void {
  RAMPANT.forEach((row, r) => {
    for (let i = 0; i < row.length; i++) {
      if (row[i] !== 'X') continue;
      c.px(9 + i, y - 2 + r, S.trim, { x: (i - 2.5) * 0.12, y: 0.35 - r * 0.08, z: 0.9 }, { bias: r < 2 ? 1 : 0 });
    }
  });
}

/** A swinging censer on its chain from the belt at (x, y): a silver ball with a coal of white fire. */
function censer(c: PixelCanvas, x: number, y: number, sway = 0): void {
  c.part();
  c.px(x, y, S.trim, { x: -0.3, y: 0.3, z: 0.9 });
  c.px(x + (sway > 0 ? 1 : 0), y + 1, S.trim, { x: -0.3, y: 0.3, z: 0.9 });
  c.part();
  const bx = x + 0.5 + sway;
  c.ellipse(bx, y + 3.4, 1.4, 1.3, S.trim);
  c.px(Math.floor(bx), y + 3, S.emblem, { x: 0, y: 0.3, z: 0.95 }, { glow: 0.6 });
  c.spark(Math.floor(bx), y + 3, S.light[1], 0.5);
  c.spark(Math.floor(bx), y + 1, S.light[2], 0.3);
}

/** Two crimson sash tails hanging from a knot at (x, y) down to row `y1`, swaying by `sway`; `k` the way they spread. */
function sashTails(c: PixelCanvas, x: number, y: number, y1: number, sway: number, k = 1): void {
  c.part();
  c.capsule(x, y + 0.5, x + k * 0.4 + sway * 0.6, y1, 0.95, 0.75, INQ_RED, { bias: -1 });
  c.capsule(x + k * 1.2, y + 0.5, x + k * 2.2 + sway, y1 - 1.2, 0.9, 0.7, INQ_RED);
  c.part();
  c.ellipse(x + k * 0.6, y + 0.4, 1.3, 1.0, INQ_RED, { bias: 1 });
}

/** The Inquisitor's seal on his sash: a silver ring round a coal of white fire, on row `y`. */
function seal(c: PixelCanvas, y: number): void {
  for (const [x, yy] of [[11, y - 1], [12, y - 1], [10, y], [13, y], [11, y + 1], [12, y + 1]]) {
    c.px(x, yy, S.trim, { x: (x - 11.5) * 0.3, y: -(yy - y) * 0.35, z: 0.88 }, { bias: yy < y ? 1 : 0 });
  }
  c.px(11, y, S.emblem, { x: -0.2, y: 0.3, z: 0.93 }, { glow: 0.6 });
  c.px(12, y, S.emblem, { x: 0.2, y: 0.3, z: 0.93 }, { glow: 0.5 });
  c.spark(11, y, S.light[1], 0.35);
}

/** A hem of silver studs: the trimmed row darkened between studs. */
function studs(c: PixelCanvas, l: number, r: number, y: number): void {
  for (let x = Math.round(l); x < Math.round(r); x++) if (x % 2) c.shade(x, y, -3);
}

/** The Inquisitor's hat brim, a broad flat ellipse of felt centred on (cx, cy). */
function brim(c: PixelCanvas, cx: number, cy: number, rx: number, ry: number): void {
  c.part();
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      // The top of the brim faces the sky; its front lip turns down into shade.
      c.px(x, y, HAT, { x: dx * 0.35, y: dy < 0 ? 0.75 : -0.25, z: 0.65 }, { bias: dy > 0.35 ? -1 : 0 });
    }
  }
}

/** The hat's crown, rows 3..8 between l and r, with a crimson band and (seen from the front) a silver buckle at `buckle`. */
function crown(c: PixelCanvas, l: number, r: number, U: number, buckle?: number): void {
  c.part();
  c.shape(3 + U, 8 + U, (y) => {
    const top = y === 3 + U ? 0.6 : 0;
    const flare = (y - 3 - U) * 0.06;
    return [l + top - flare, r - top + flare];
  }, HAT, (_x, y, t) => cyl(t * 0.95, y === 3 + U ? 0.8 : 0.15));
  c.part();
  c.shape(7 + U, 7 + U, () => [l - 0.5, r + 0.5], INQ_RED, (_x, _y, t) => cyl(t, 0.1));
  if (buckle !== undefined) {
    c.part();
    c.px(buckle, 7 + U, S.trim, { x: -0.3, y: 0.4, z: 0.85 }, { bias: 1 });
    c.px(buckle + 1, 7 + U, S.trim, { x: 0.2, y: 0.4, z: 0.85 });
  }
}

/**
 * The Inquisitor from the front: a lean face in the brim's shadow, grey hair
 * at the temples, eyes catching an ember's glint, a steel half-mask from the
 * nose down, the coat's high collar, and the broad black hat.
 */
function hatFront(c: PixelCanvas, cx: number, U: number, blink: boolean): void {
  c.part();
  c.ellipse(cx, 12.4 + U, 3.1, 2.7, SKIN, { bias: -1 });
  c.part();
  for (let y = 10; y <= 12; y++) {
    c.px(8, y + U, INQ_HAIR, cyl(-0.8, 0.1));
    c.px(15, y + U, INQ_HAIR, cyl(0.8, 0.1));
  }
  c.part();
  if (blink) {
    c.px(10, 11 + U, SKIN, FLAT_DOWN, { bias: -2 });
    c.px(13, 11 + U, SKIN, FLAT_DOWN, { bias: -2 });
  } else {
    c.px(10, 11 + U, EYE);
    c.px(13, 11 + U, EYE);
    c.spark(10, 11 + U, S.light[2], 0.5);
    c.spark(13, 11 + U, S.light[2], 0.5);
  }
  c.part();
  const mask = [3.3, 3.1, 2.3];
  c.shape(12 + U, 14 + U, (y) => [cx - mask[y - 12 - U], cx + mask[y - 12 - U]], S.plate, (_x, _y, t, u) => sphere(t * 0.9, u * 0.9 - 0.2, 1));
  c.shade(11, 12 + U, 1);
  c.shade(10, 13 + U, -2);
  c.shade(13, 13 + U, -2);
  c.px(9, 12 + U, S.trim, { x: -0.5, y: 0.3, z: 0.8 }, { bias: 1 });
  c.px(14, 12 + U, S.trim, { x: 0.5, y: 0.3, z: 0.8 });
  // The coat's standing collar either side of the jaw.
  c.part();
  c.shape(12 + U, 15 + U, (y) => [cx - 4.7, cx - 3.3 + (y - 12 - U) * 0.15], S.cape, (_x, _y, t) => cyl(t * 0.6 - 0.4, 0.2));
  c.shape(12 + U, 15 + U, (y) => [cx + 3.3 - (y - 12 - U) * 0.15, cx + 4.7], S.cape, (_x, _y, t) => cyl(t * 0.6 + 0.4, 0.2));
  brim(c, cx, 8.9 + U, 7.6, 1.35);
  crown(c, cx - 3, cx + 3, U, 11);
}

/** The Inquisitor from behind: grey hair at the nape over the high collar, under the hat. */
function hatBack(c: PixelCanvas, cx: number, U: number): void {
  c.part();
  c.ellipse(cx, 11.6 + U, 3.6, 2.6, INQ_HAIR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8, 1) });
  c.shade(11, 12 + U, -1);
  c.shade(13, 11 + U, -1);
  c.part();
  c.shape(13 + U, 15 + U, (y) => [cx - 4.4 + (15 + U - y) * 0.2, cx + 4.4 - (15 + U - y) * 0.2], S.cape, (_x, _y, t) => cyl(t, 0.3));
  brim(c, cx, 8.9 + U, 7.6, 1.35);
  crown(c, cx - 3, cx + 3, U);
}

/** The Inquisitor in profile, facing left: the mask's beak, the long brim reaching forward. */
function hatSide(c: PixelCanvas, hx: number, U: number, blink: boolean): void {
  c.part();
  c.ellipse(hx - 1.2, 12.6 + U, 2.9, 2.6, SKIN, { bias: -1 });
  c.part();
  c.shape(10 + U, 13 + U, (y) => [hx + 0.2, hx + 3.2 - (y - 10 - U) * 0.2], INQ_HAIR, (_x, _y, t, u) => sphere(t * 0.8 + 0.1, u - 0.4, 1));
  c.part();
  if (blink) c.px(hx - 3, 11 + U, SKIN, FLAT_DOWN, { bias: -2 });
  else {
    c.px(hx - 3, 11 + U, EYE);
    c.spark(hx - 3, 11 + U, S.light[2], 0.5);
  }
  c.part();
  const nose = [0, 0.2, 1.0];
  c.shape(12 + U, 14 + U, (y) => [hx - 4.6 + nose[y - 12 - U], hx - 0.4], S.plate, (_x, _y, t, u) => sphere(t * 0.8 - 0.2, u * 0.9 - 0.2, 1));
  c.shade(hx - 3, 13 + U, -2);
  c.px(hx - 1, 12 + U, S.trim, { x: -0.3, y: 0.3, z: 0.9 }, { bias: 1 });
  c.part();
  c.shape(12 + U, 15 + U, () => [hx + 0.6, hx + 3.0], S.cape, (_x, _y, t) => cyl(t * 0.6 + 0.2, 0.2));
  brim(c, hx - 0.6, 8.9 + U, 6.8, 1.2);
  crown(c, hx - 3, hx + 2.6, U);
}

// ---------------------------------------------------------------------------
// Directions

function drawDown(c: PixelCanvas, p: Pose): PaladinMeta {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  let head = { x: 0, y: 0 };
  const sh = { x: 7.2, y: 16.9 + U }; // mace shoulder (screen left)
  const macing = () => {
    head = drawMace(c, p.mace, p.glow);
    limb(c, sh.x, sh.y, p.mace.hx, p.mace.hy, p.maceBehind ? -1 : 0);
    gauntlet(c, p.mace.hx, p.mace.hy);
  };
  if (S.seraph) {
    const rise = (p.holy ?? 0) * 2;
    bigWing(c, cx - 2.6, 17.2 + U, -1, p.breath + p.cape * 0.3 + rise);
    bigWing(c, cx + 2.6, 17.2 + U, 1, p.breath - p.cape * 0.3 + rise);
  }
  if (p.maceBehind) macing();

  // Cape lining behind the legs.
  const ct = 15 + U;
  const cb = 28 + L;
  c.part();
  c.shape(ct, cb, (y) => {
    const u = (y + 0.5 - ct) / (cb + 1 - ct);
    const hw = 5.2 + 1.9 * u;
    const x = cx + p.cape * u * u;
    return [x - hw, x + hw];
  }, S.cape, (_x, _y, t, u) => cyl(t, 0.2 - u * 0.3), { bias: -2 });

  if (p.kneel) {
    // Down on one knee: the right knee on the ground, its shin folded away
    // behind; the left knee up, its foot planted forward.
    leg(c, 9.8, 24 + L, 9.2, 29.2);
    c.part();
    c.ellipse(9.2, 29.6, 1.7, 1.2, S.plate, { flatten: 0.8 });
    leg(c, 14.2, 24 + L, 14.9, 27.6);
    leg(c, 14.9, 27.6, 15.0, 29.4);
    boot(c, 15.1, 30.4);
  } else {
    leg(c, 9.8, 24 + L, 9.7, 28.4 - p.footA);
    leg(c, 14.2, 24 + L, 14.3, 28.4 - p.footB);
    boot(c, 9.5, 29.7 - p.footA);
    boot(c, 14.5, 29.7 - p.footB);
  }

  // Breastplate: broad and rounded, catching the light at the upper left.
  const top = 15 + U;
  const waist = 22 + U;
  c.part();
  c.shape(top, waist - 1, (y) => {
    const u = (y + 0.5 - top) / (waist - top);
    const hw = 5.0 - 1.0 * u * u;
    return [cx - hw, cx + hw];
  }, S.plate, (_x, _y, t, u) => sphere(t * 0.9, (u - 0.35) * 1.1, 1));

  // Faulds: overlapping plate bands over the hips.
  const hem = 26 + L;
  c.part();
  c.shape(waist, hem, (y) => {
    const u = (y + 0.5 - waist) / (hem + 1 - waist);
    const hw = 4.2 + 1.2 * u;
    const x = cx + p.cape * 0.3 * u;
    return [x - hw, x + hw];
  }, S.plateDark, (_x, _y, t, u) => cyl(t, 0.25 - u * 0.2));
  for (let y = waist + 2; y <= hem; y += 2) for (let x = cx - 5; x <= cx + 5; x++) c.shade(x, y, -1);

  // Ivory tabard down the middle, trimmed in gold, with a gold sun.
  c.part();
  const tab = (y: number): [number, number] => {
    const u = Math.max(0, (y - waist) / (hem - waist));
    const hw = (S.lion ? 2.6 : 2.0) + u * 0.5;
    const x = cx + p.cape * 0.4 * u * u;
    return [x - hw, x + hw];
  };
  c.shape(top + (S.lion ? 1 : 2), hem, tab, S.tabard, (_x, _y, t, u) => cyl(t * 0.6, 0.2 - u * 0.3));
  c.part();
  const te = tab(hem + 1);
  c.shape(hem + 1, hem + 1, () => te, S.trim, (_x, _y, t) => cyl(t, -0.1));
  c.part();
  c.shape(waist, waist, () => [cx - 4.2, cx + 4.2], LEATHER, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(11, waist, S.trim, { x: -0.3, y: 0.3, z: 0.9 }, { bias: 1 });
  c.px(12, waist, S.trim, { x: 0.2, y: 0.3, z: 0.9 });
  c.part();
  if (S.oath) eclipse(c, 18 + U);
  else if (S.inquisitor) seal(c, 18 + U);
  else if (S.crusader) cross(c, 18 + U, CRIMSON);
  else if (S.lion) rampant(c, 18 + U);
  else sun(c, 18 + U);
  if (S.inquisitor) censer(c, 8, waist + 1, p.cape > 0 ? 0.5 : p.cape < 0 ? -0.5 : 0);

  // Gorget between chin and breastplate.
  c.part();
  c.shape(15 + U, 15 + U, () => [cx - 2.6, cx + 2.6], S.plateDark, (_x, _y, t) => cyl(t, 0.2));

  // Head: face in an open helm with cheek guards, a gold crest and little wings,
  // or the Crusader's great helm.
  // The idle moment may nudge the head (bowed in prayer): drawn through a shifted canvas.
  const hd = p.head;
  if (hd) c.offset(BODY_X + hd.x, BODY_Y + hd.y);
  if (S.inquisitor) hatFront(c, cx, U, !!p.blink);
  else if (S.crusader) greatHelmFront(c, cx, U, !!p.blink);
  else if (S.seraph) seraphHeadFront(c, cx, U, !!p.blink, p.holy ?? 0);
  else if (S.lion) lionHelmFront(c, cx, U, !!p.blink);
  else {
  c.part();
  c.ellipse(cx, 12.6 + U, 3.2, 2.8, SKIN);
  c.part();
  c.px(11, 13 + U, SKIN, sphere(-0.4, -0.3), { bias: 1 });
  c.px(12, 13 + U, SKIN, sphere(0.35, -0.2));
  c.shade(11, 14 + U, -1);
  c.shade(12, 14 + U, -1);
  c.part();
  if (p.blink) {
    c.px(10, 12 + U, SKIN, FLAT_DOWN, { bias: -1 });
    c.px(13, 12 + U, SKIN, FLAT_DOWN, { bias: -1 });
  } else {
    c.px(10, 12 + U, EYE);
    c.px(13, 12 + U, EYE);
  }
  dome(c, cx, 5 + U, 10 + U, 4.8);
  c.part();
  const guard = [2.0, 1.8, 1.4, 0.9];
  c.shape(11 + U, 14 + U, (y) => [7.4, 7.4 + guard[y - 11 - U]], S.plate, (_x, _y, t) => cyl(t * 0.4 - 0.6, 0.1));
  c.shape(11 + U, 14 + U, (y) => [16.6 - guard[y - 11 - U], 16.6], S.plate, (_x, _y, t) => cyl(t * 0.4 + 0.6, 0.1));
  crest(c, cx, 3.6 + U, cx, 6 + U);
  wing(c, cx - 4.3, 8.4 + U, -2.6, -4.2);
  wing(c, cx + 4.3, 8.4 + U, 2.6, -4.2);
  }
  if (hd) c.offset(BODY_X, BODY_Y);

  // Shield arm (character's left, screen right), then the shield before it;
  // or, set down, the shield first and the hand resting on its rim.
  const s = { x: p.shield.x, y: p.shield.y + U };
  const shine = Math.max(p.glow, p.holy ?? 0);
  if (p.shieldAt) shieldFront(c, p.shieldAt.x, p.shieldAt.y, 3.7, shine);
  limb(c, 16.8, 16.9 + U, s.x, s.y);
  gauntlet(c, s.x, s.y);
  pauldron(c, 17.1, 16.3 + U);
  if (!p.shieldAt) shieldFront(c, s.x + 0.5, s.y - 0.5, 3.7, shine);

  if (!p.maceBehind) macing();
  pauldron(c, 6.9, 16.3 + U);
  p.fx?.(c);
  return { headX: head.x, headY: head.y, glow: p.glow };
}

function drawUp(c: PixelCanvas, p: Pose): PaladinMeta {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  let head = { x: 0, y: 0 };
  const sh = { x: 16.8, y: 16.9 + U }; // mace shoulder (screen right)
  const macing = () => {
    head = drawMace(c, p.mace, p.glow);
    limb(c, sh.x, sh.y, p.mace.hx, p.mace.hy, p.maceBehind ? -1 : 0);
    gauntlet(c, p.mace.hx, p.mace.hy);
  };
  if (p.maceBehind) macing();

  // The shield faces away, in front of him: only its back shows past his side.
  const s = { x: p.shield.x, y: p.shield.y + U };
  shieldBack(c, s.x - 0.5, s.y - 0.5, 3.7);

  leg(c, 9.8, 24 + L, 9.7, 28.4 - p.footB);
  leg(c, 14.2, 24 + L, 14.3, 28.4 - p.footA);
  boot(c, 9.5, 29.7 - p.footB);
  boot(c, 14.5, 29.7 - p.footA);

  const top = 15 + U;
  const waist = 22 + U;
  const hem = 26 + L;
  c.part();
  c.shape(top, waist - 1, (y) => {
    const u = (y + 0.5 - top) / (waist - top);
    const hw = 5.0 - 1.0 * u * u;
    return [cx - hw, cx + hw];
  }, S.plate, (_x, _y, t, u) => sphere(t * 0.9, (u - 0.35) * 1.1, 1));
  c.part();
  c.shape(waist, hem, (y) => {
    const u = (y + 0.5 - waist) / (hem + 1 - waist);
    const hw = 4.2 + 1.2 * u;
    return [cx - hw, cx + hw];
  }, S.plateDark, (_x, _y, t, u) => cyl(t, 0.25 - u * 0.2));

  // Shield arm (character's left, now screen left), gripping the straps.
  limb(c, 7.2, 16.9 + U, s.x, s.y);
  gauntlet(c, s.x, s.y);

  // Cape: falls from the shoulders, gold-trimmed, with soft folds.
  const ct = 14.5 + U;
  const cb = 27 + L;
  const capeEdges = (y: number): [number, number] => {
    const u = Math.max(0, (y + 0.5 - ct) / (cb + 1 - ct));
    const hw = 4.6 + 1.8 * Math.pow(u, 1.2);
    const x = cx + p.cape * u * u;
    return [x - hw, x + hw];
  };
  c.part();
  c.shape(ct, cb, capeEdges, S.cape, (_x, _y, t, u) => cyl(t * 0.6, 0.2 - u * 0.3));
  const ce = capeEdges(cb + 1);
  if (S.oath) tatters(c, ce[0], ce[1], cb, S.cape);
  else {
    c.part();
    c.shape(cb + 1, cb + 1, () => ce, S.trim, (_x, _y, t) => cyl(t, -0.1));
    if (S.inquisitor) studs(c, ce[0], ce[1], cb + 1);
  }
  for (let y = Math.round(ct + 5); y <= cb; y++) {
    const [l, r] = capeEdges(y);
    c.shade(Math.round(l + (r - l) * 0.3), y, -1);
    c.shade(Math.round(l + (r - l) * 0.68), y, -1);
  }
  // A gold sun (a gold cross for the Crusader) on the cape's back.
  c.part();
  const sy = Math.round(19 + U);
  if (S.oath) eclipse(c, sy);
  else if (S.inquisitor) {
    // The coat's back seam studded in silver, and the sash knotted at the small of the back.
    for (let y = sy - 3; y <= cb; y++) {
      const [l, r] = capeEdges(y);
      const mid = Math.round((l + r) / 2);
      c.shade(mid, y, -1);
      if ((y - sy) % 3 === 0) c.px(mid - 1, y, S.trim, { x: -0.3, y: 0.3, z: 0.9 }, { bias: 1 });
    }
    sashTails(c, cx + 0.6, waist, cb - 1 + Math.max(0, p.cape), p.cape * 0.5);
  } else if (S.crusader) cross(c, sy, S.trim);
  else if (S.lion) rampant(c, sy - 1);
  else sun(c, sy);
  // The Seraph's wings spread from the shoulder blades, over the cape.
  if (S.seraph) {
    bigWing(c, cx - 2.2, 17.6 + U, -1, p.breath - p.cape * 0.3);
    bigWing(c, cx + 2.2, 17.6 + U, 1, p.breath + p.cape * 0.3);
  }

  // Helm from behind: plate over the nape, the crest running down its back.
  c.part();
  c.shape(13 + U, 15 + U, () => [cx - 3.4, cx + 3.4], S.plateDark, (_x, _y, t) => cyl(t, 0));
  if (S.seraph) seraphHeadBack(c, cx, U);
  else if (S.lion) lionHelmBack(c, cx, U);
  else if (S.inquisitor) hatBack(c, cx, U);
  else {
    c.part();
    c.ellipse(cx, 10.2 + U, 4.8, 4.5, S.plate, { normal: (_x, _y, dx, dy) => sphere(dx * 0.95, dy * 0.9 - 0.15, 1) });
    c.part();
    c.shape(Math.round(13 + U), Math.round(13 + U), () => [cx - 3.6, cx + 3.6], S.trim, (_x, _y, t) => cyl(t, -0.2));
    if (S.oath) helmHorns(c, cx, U);
    else if (S.crusader) plume(c, cx, 3.4 + U, cx, 7.5 + U);
    else crest(c, cx, 5.4 + U, cx, 12 + U);
    wing(c, cx - 4.3, 8.6 + U, -2.6, -4.2);
    wing(c, cx + 4.3, 8.6 + U, 2.6, -4.2);
  }

  pauldron(c, 6.9, 16.1 + U);
  pauldron(c, 17.1, 16.1 + U);
  if (!p.maceBehind) macing();
  return { headX: head.x, headY: head.y, glow: p.glow };
}

/** Facing left. Right-facing frames are mirrored from these. */
function drawSide(c: PixelCanvas, p: Pose): PaladinMeta {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const LN = -p.lean; // lean forward = toward the left
  const hx = cx + LN; // upper body centre

  // The mace is in the far hand, so it and its arm are always behind the body.
  const m = { ...p.mace, hx: p.mace.hx + LN };
  const head = drawMace(c, m, p.glow);
  limb(c, hx + 1.8, 17 + U, m.hx, m.hy, -1);
  gauntlet(c, m.hx, m.hy);
  // The Seraph's near wing, folded half open behind the back.
  if (S.seraph) bigWing(c, hx + 2.2, 17.4 + U, 1, p.breath + p.cape * 0.3, 0.72);

  // Cape streaming behind.
  const ct = 15 + U;
  const cb = 28 + L;
  const capeEdge = (y: number): [number, number] => {
    const u = Math.max(0, (y + 0.5 - ct) / (cb + 1 - ct));
    const l = hx + 1 - 1.6 * u - LN * u;
    const r = hx + 3.6 + 2.8 * Math.pow(u, 1.2) + p.cape * u * u - LN * u;
    return [l, r];
  };
  c.part();
  c.shape(ct, cb, capeEdge, S.cape, (_x, _y, t, u) => cyl(t * 0.8 + 0.15, 0.25 - u * 0.3), { bias: -1 });
  const ce = capeEdge(cb);
  if (S.oath) tatters(c, ce[0], ce[1], cb, S.cape);
  else {
    c.part();
    c.shape(cb + 1, cb + 1, () => ce, S.trim, (_x, _y, t) => cyl(t, -0.1), { bias: -1 });
    if (S.inquisitor) studs(c, ce[0], ce[1], cb + 1);
  }

  // Legs: back leg in shade first, then the front leg.
  const lift = (f: number) => Math.max(0, f) * 0.35;
  leg(c, cx + 0.9, 24 + L, cx + 1.3 - p.footB, 28.4 - lift(p.footB), -1);
  boot(c, cx + 0.6 - p.footB, 29.7 - lift(p.footB), true, -1);
  leg(c, cx - 0.2, 24 + L, cx + 0.2 - p.footA, 28.4 - lift(p.footA));
  boot(c, cx - 0.5 - p.footA, 29.7 - lift(p.footA), true);

  // Breastplate in profile, chest pushed forward.
  const top = 15 + U;
  const waist = 22 + U;
  const hem = 26 + L;
  const torso = (y: number): [number, number] => {
    const chest = y >= top + 1 && y <= top + 3 ? 0.6 : 0;
    return [hx - 3.1 - chest, hx + 3.0];
  };
  c.part();
  c.shape(top, waist - 1, torso, S.plate, (_x, _y, t, u) => sphere(t * 0.9 - 0.1, (u - 0.35) * 1.1, 1));
  const skirt = (y: number): [number, number] => {
    const u = (y + 0.5 - waist) / (hem + 1 - waist);
    return [cx - 3.3 + LN * 0.5 - u * 0.6, cx + 3.2 + u * 0.9];
  };
  c.part();
  c.shape(waist, hem, skirt, S.plateDark, (_x, _y, t, u) => cyl(t * 0.9 - 0.1, 0.25 - u * 0.2));
  for (let y = waist + 2; y <= hem; y += 2) for (let x = cx - 5; x <= cx + 5; x++) c.shade(x, y, -1);
  // Tabard front edge down chest and skirt.
  c.part();
  const tab = (y: number): [number, number] => {
    const [l] = y < waist ? torso(y) : skirt(y);
    return [l, l + 1.7];
  };
  c.shape(top + 2, hem, tab, S.tabard, (_x, _y, t, u) => cyl(t * 0.6 - 0.2, 0.2 - u * 0.3));
  c.part();
  const te = tab(hem);
  c.shape(hem + 1, hem + 1, () => te, S.trim, (_x, _y, t) => cyl(t, -0.1));
  c.part();
  const [bl, br] = torso(waist - 1);
  c.shape(waist, waist, () => [bl - 0.1, br + 0.2], LEATHER, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(Math.round(bl), waist, S.trim, { x: -0.5, y: 0.3, z: 0.8 }, { bias: 1 });
  if (S.inquisitor) {
    // The sash's tails trail from a knot at his back; the censer swings at his hip.
    sashTails(c, br - 0.6, waist, hem + 2, 0.6 + p.cape * 0.5);
    censer(c, Math.round(cx - 0.6 + LN * 0.5), waist + 1, p.cape > 1 ? 0.5 : 0);
  }

  // Head: profile face under the helm, cheek guard, crest and wing.
  c.part();
  c.shape(15 + U, 15 + U, () => [hx - 2.2, hx + 1.8], S.plateDark, (_x, _y, t) => cyl(t, 0.2));
  if (S.inquisitor) hatSide(c, hx, U, !!p.blink);
  else if (S.crusader) greatHelmSide(c, hx, U, !!p.blink);
  else if (S.seraph) seraphHeadSide(c, hx, U, !!p.blink);
  else if (S.lion) lionHelmSide(c, hx, U, !!p.blink);
  else {
  c.part();
  c.ellipse(hx - 1.2, 12.8 + U, 2.9, 2.7, SKIN);
  c.part();
  c.px(hx - 5, 13 + U, SKIN, sphere(-0.6, -0.2), { bias: 1 });
  c.shade(hx - 4, 14 + U, -1);
  c.part();
  if (p.blink) c.px(hx - 3, 12 + U, SKIN, FLAT_DOWN, { bias: -1 });
  else c.px(hx - 3, 12 + U, EYE);
  dome(c, hx - 0.2, 5 + U, 10 + U, 4.6, 0.6);
  c.part();
  c.shape(11 + U, 14 + U, (y) => [hx + 0.8, hx + 4.6 - (y - 11 - U) * 0.35], S.plate, (_x, _y, t, u) => sphere(t * 0.7 + 0.2, u * 0.8, 1));
  c.shape(11 + U, 13 + U, (y) => [hx - 0.6 + (y - 11 - U) * 0.3, hx + 0.9], S.plate, (_x, _y, t) => cyl(t * 0.5, 0.1), { bias: 1 });
  c.px(hx - 5, 10 + U, S.plate, { x: -0.3, y: 0.2, z: 0.93 });
  crest(c, hx - 2.6, 4.7 + U, hx + 2.8, 4.9 + U);
  wing(c, hx + 1.6, 8.4 + U, 3.4, -3.6);
  }

  // Near arm with the shield held forward, its face turned half toward us.
  const s = { x: p.shield.x + LN, y: p.shield.y + U };
  limb(c, hx + 0.4, 17 + U, s.x, s.y);
  gauntlet(c, s.x, s.y);
  pauldron(c, hx + 0.9, 17 + U, 2.3, 1.8);
  shieldFront(c, s.x - 0.6, s.y - 0.5, 2.2, p.glow);
  return { headX: head.x, headY: head.y, glow: p.glow };
}

// ---------------------------------------------------------------------------
// Animations

type View = 'down' | 'up' | 'side';

interface Key {
  hx: number;
  hy: number;
  angle: number;
  behind?: boolean;
}

const mc = (hx: number, hy: number, angle: number, behind = false): Key => ({ hx, hy, angle, behind });
const LEN = 6.5;

/** At rest the heavy mace hangs low at his side. */
const IDLE_MACE: Record<View, Key> = {
  down: mc(5, 22.5, 190),
  up: mc(19, 22.5, 170),
  side: mc(14.4, 22, 160),
};

const SHIELD: Record<View, { x: number; y: number }> = {
  down: { x: 17.9, y: 21.6 },
  up: { x: 6.1, y: 21.6 },
  side: { x: 7.6, y: 21 },
};

const base = (view: View): Pose => {
  const k = IDLE_MACE[view];
  return {
    lift: 0,
    breath: 0,
    footA: 0,
    footB: 0,
    cape: 0,
    lean: 0,
    mace: { hx: k.hx, hy: k.hy, angle: k.angle, len: LEN },
    maceBehind: k.behind,
    shield: { ...SHIELD[view] },
    glow: 0,
  };
};

function idle(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 8;
  for (let f = 0; f < N; f++) {
    const ph = (f / N) * Math.PI * 2;
    const p = base(view);
    p.breath = Math.sin(ph - 0.6) > 0.1 ? 1 : 0;
    p.mace.hy += p.breath * 0.5;
    p.shield.y += p.breath * 0.5;
    p.cape = Math.sin(ph - 2.2) > 0.5 ? 1 : 0;
    p.blink = f === 5;
    frames.push(p);
  }
  return frames;
}

/** A heavy, steady march. */
function walk(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = ((f + 0.5) / N) * Math.PI * 2;
    const s = Math.sin(ph);
    const p = base(view);
    p.lift = Math.abs(s) < 0.6 ? 1 : 0;
    p.cape = view === 'side' ? 1 + (p.lift ? 0 : 1) : Math.round(-s);
    if (view === 'side') {
      p.footA = Math.round(s * 2.4);
      p.footB = -p.footA;
      p.mace.angle += s * 14;
      p.mace.hx += s * 1;
      p.shield.x += Math.round(-s * 0.8);
    } else {
      p.footA = s > 0.3 ? 1 : 0;
      p.footB = s < -0.3 ? 1 : 0;
      p.mace.angle += (view === 'down' ? 1 : -1) * s * 8;
      p.shield.y += s > 0 ? 0 : -1;
    }
    p.mace.hy -= p.lift;
    frames.push(p);
  }
  return frames;
}

/** Overhead blow, per view: lift, cocked high, strike the ground ahead, hold, recover. */
const SMITE_KEYS: Record<View, Key[]> = {
  down: [mc(5.5, 14.5, -40), mc(8.5, 9, -8, true), mc(9, 23.5, 186), mc(9, 24.2, 180), mc(5.5, 21.5, 205)],
  up: [mc(18.5, 16, 35), mc(17.5, 9.5, 118), mc(15.5, 13, 12, true), mc(15.5, 13.8, 14, true), mc(18.5, 21.5, 160)],
  side: [mc(15, 15, 30), mc(14, 10, 70), mc(7.5, 21, -115), mc(7.5, 22, -130), mc(14.4, 22, 160)],
};

function strike(view: View, k: Key, i: number): Pose {
  const p = base(view);
  p.mace = { hx: k.hx, hy: k.hy, angle: k.angle, len: LEN };
  p.maceBehind = k.behind;
  const down = i === 2 || i === 3;
  p.breath = down ? 1 : 0;
  p.lift = i === 1 ? 1 : 0;
  p.cape = i === 1 ? -1 : down ? 1 : 0;
  if (view === 'side') {
    p.lean = down ? 1 : i === 1 ? -1 : 0;
    p.footA = down ? 2 : 0;
    p.footB = down ? -1 : 0;
    p.cape = down ? 2 : 1;
    p.shield = { x: SHIELD.side.x + (down ? 1.2 : 0), y: SHIELD.side.y - (i === 1 ? 1 : 0) };
  } else {
    if (down) p.footA = 1;
    p.shield = { x: SHIELD[view].x + (view === 'down' ? -0.4 : 0.4), y: SHIELD[view].y - 0.8 };
  }
  return p;
}

const smite = (view: View): Pose[] => SMITE_KEYS[view].map((k, i) => strike(view, k, i));

/** Special: the mace is raised high and kindles, then driven into the ground. */
function consecrate(view: View): Pose[] {
  const K = SMITE_KEYS[view];
  const seq: [Key, number, number][] = [
    // key, strike frame it borrows the body from, glow
    [K[0], 0, 0.4],
    [K[1], 1, 0.8],
    [{ ...K[1], hy: K[1].hy - 1 }, 1, 1],
    [K[2], 2, 1],
    [K[3], 3, 0.85],
    [K[3], 3, 0.5],
    [K[4], 4, 0.2],
  ];
  return seq.map(([k, body, g], i) => {
    const p = strike(view, k, body);
    p.glow = g;
    if (i === 2) p.lift = 1;
    if (i === 5) p.breath = 0;
    return p;
  });
}

// ---------------------------------------------------------------------------
// The idle moment (`rest`): a short performance when the hero has stood still
// a while, drawn facing the viewer only, starting and ending on the idle's
// first frame. The Templar kneels behind his shield in a short prayer while
// a soft light gathers round him; the Crusader raises his warhammer to the
// sky, where the sun flashes on it, and shoulders it before he lets it down.
// Both are eleven frames played to the same beat (every look shares one
// animation list), so they share REST_ORDER.

const REST_FPS = 7;
/**
 * Frame indices in play order: stand, three frames into it, a held pose, the
 * light (or the glint) in three beats, a long hold, a closing beat, two
 * frames out, stand.
 */
const REST_ORDER = [0, 1, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 7, 7, 8, 8, 8, 9, 10, 0] as const;

/** A four-pointed twinkle at (x, y) in the look's light, its rays `ray` pixels long. */
function twinkle(c: PixelCanvas, x: number, y: number, a: number, ray = 2): void {
  c.spark(x, y, S.light[0], a);
  for (let i = 1; i <= ray; i++) {
    const k = a * (i === 1 ? 0.8 : i === 2 ? 0.45 : 0.25);
    for (const [dx, dy] of [[i, 0], [-i, 0], [0, i], [0, -i]]) c.spark(x + dx, y + dy, S.light[1], k);
  }
  if (ray >= 2) for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) c.spark(x + dx, y + dy, S.light[2], a * 0.3);
}

/** Motes of light drifting up round him as he prays, `t` how far they have risen (0..1). */
const MOTES: [number, number][] = [[3, 29], [21, 28], [5.5, 23], [19, 22], [1.5, 25], [22.5, 25], [8, 19], [16.5, 18]];
function motes(c: PixelCanvas, t: number, a: number): void {
  MOTES.forEach(([x, y], i) => {
    const rise = (t * 6 + (i % 3) * 1.5) % 7;
    const fade = Math.min(1, a * 1.3 * (1 - rise / 9));
    c.spark(x + (i % 2 ? 0.5 : -0.5) * Math.sin(rise), y - rise, i % 2 ? S.light[1] : S.light[2], fade);
  });
}

/** A copy of `from` with some things changed (the mace merged, not replaced). */
function vary(from: Pose, patch: Partial<Omit<Pose, 'mace'>> & { mace?: Partial<Mace> } = {}): Pose {
  const { mace, ...rest } = patch;
  return { ...from, shield: { ...from.shield }, ...rest, mace: { ...from.mace, ...mace } };
}

/**
 * The Templar: steps in, sinks onto one knee with his shield set before him
 * and his mace grounded at his side, bows his head, and a soft holy light
 * gathers (motes rising, the shield's sun and the Seraph's halo brightening,
 * her wings lifting); then he looks up and rises.
 */
function templarRest(): Pose[] {
  const stand = idle('down')[0];
  // Kneeling lowers him four pixels; the shield stands on the ground before him.
  const kneel = vary(stand, {
    lift: -4,
    kneel: true,
    shieldAt: { x: 13.3, y: 26 },
    shield: { x: 15.4, y: 17.3 },
    mace: { hx: 5.3, hy: 22.3, angle: 180 },
  });
  const bow = vary(kneel, { head: { x: 0, y: 1 }, blink: true });
  return [
    stand,
    vary(stand, { breath: 1, shield: { x: 16.6, y: 21 }, mace: { angle: 184 }, cape: -1 }),
    vary(stand, { lift: -2, shield: { x: 15.6, y: 20.4 }, mace: { hx: 5.2, hy: 23.5, angle: 180 }, cape: 1 }),
    kneel,
    bow,
    vary(bow, { holy: 0.35, fx: (c) => motes(c, 0, 0.5) }),
    vary(bow, { holy: 0.7, fx: (c) => motes(c, 0.33, 0.75) }),
    // At its height the sun on the shield (its boss at 13, 25) flares.
    vary(bow, { holy: 1, fx: (c) => { motes(c, 0.66, 1); twinkle(c, 13, 25, 0.9, 2); } }),
    vary(kneel, { holy: 0.3, fx: (c) => motes(c, 1, 0.4) }),
    vary(stand, { lift: -2, shield: { x: 16.2, y: 20.6 }, mace: { hx: 5.2, hy: 23.5, angle: 182 }, cape: 1 }),
    vary(stand, { breath: 1, cape: -1 }),
  ];
}

/**
 * The Crusader: gathers himself, raises his warhammer high to the sky where
 * the sun flashes on it, brings it down to rest across his shoulder a while,
 * then swings it back down to his side.
 */
function crusaderRest(): Pose[] {
  const stand = idle('down')[0];
  const high = { hx: 5, hy: 11, angle: -12 };
  // Where the light catches: the top corner of the hammer's head, raised high.
  const corner = () => {
    const a = high.angle * RAD;
    const along = LEN + 1.6;
    return { x: high.hx + Math.sin(a) * along - Math.cos(a) * 3, y: high.hy - Math.cos(a) * along - Math.sin(a) * 3 };
  };
  const g = corner();
  const shoulder = vary(stand, { mace: { hx: 9.5, hy: 20, angle: -44 } });
  return [
    stand,
    vary(stand, { breath: 1, mace: { hx: 5.5, hy: 23.5, angle: 214 }, cape: -1 }),
    vary(stand, { mace: { hx: 4.5, hy: 16, angle: -62 }, cape: -1 }),
    vary(stand, { lift: 1, mace: high, cape: 1 }),
    vary(stand, { lift: 1, mace: high, fx: (c) => twinkle(c, g.x, g.y, 1, 3) }),
    vary(stand, { lift: 1, mace: high, fx: (c) => twinkle(c, g.x, g.y, 0.5, 1) }),
    vary(stand, { mace: { hx: 7.5, hy: 16, angle: -24 }, cape: -1 }),
    vary(shoulder, { breath: 1, mace: { hy: 20.5 }, cape: 1 }),
    vary(shoulder, { blink: true }),
    vary(stand, { mace: { hx: 6, hy: 20, angle: -115 }, cape: -1 }),
    vary(stand, { breath: 1, mace: { hx: 5, hy: 23, angle: 200 }, cape: 1 }),
  ];
}

/** The idle moment's poses, facing the viewer only; other views have none. */
const rest = (view: View): Pose[] => (view !== 'down' ? [] : S.crusader ? crusaderRest() : templarRest());

export type PaladinAnim = 'idle' | 'walk' | 'smite' | 'consecrate' | 'rest';

export interface PaladinAnimDef {
  name: PaladinAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => Pose[];
  /** Frame indices to play in order, holds repeated (the idle moment's). */
  order?: readonly number[];
}

export const PALADIN_ANIMS: PaladinAnimDef[] = [
  { name: 'idle', fps: 5, loop: true, poses: idle },
  { name: 'walk', fps: 9, loop: true, poses: walk },
  { name: 'smite', fps: 15, loop: false, poses: smite },
  { name: 'consecrate', fps: 10, loop: false, poses: consecrate },
  { name: 'rest', fps: REST_FPS, loop: false, poses: rest, order: REST_ORDER },
];

/** Frame index at which the smite lands. */
export const SMITE_HIT = 2;
/** Frame index at which the consecration strikes the ground. */
export const CONSECRATE_HIT = 3;

export interface PaladinFrame {
  key: string; // e.g. "walk_left_3"
  anim: PaladinAnim;
  dir: Dir;
  canvas: PixelCanvas;
  meta: PaladinMeta;
}

export function drawPaladinFrame(dir: Dir, pose: Pose): { canvas: PixelCanvas; meta: PaladinMeta } {
  const c = new PixelCanvas(PALADIN_W, PALADIN_H).offset(BODY_X, BODY_Y);
  let meta: PaladinMeta;
  if (dir === 'down') meta = drawDown(c, pose);
  else if (dir === 'up') meta = drawUp(c, pose);
  else meta = drawSide(c, pose);
  meta = { ...meta, headX: meta.headX + BODY_X, headY: meta.headY + BODY_Y };
  if (dir === 'right') return { canvas: c.mirrored(), meta: { ...meta, headX: PALADIN_W - meta.headX } };
  return { canvas: c, meta };
}

export function buildPaladinFrames(look: PaladinLook = HOLY_LOOK): PaladinFrame[] {
  S = look;
  const out: PaladinFrame[] = [];
  for (const a of PALADIN_ANIMS) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, index) => {
        const { canvas, meta } = drawPaladinFrame(dir, pose);
        out.push({ key: `${a.name}_${dir}_${index}`, anim: a.name, dir, canvas, meta });
      });
    }
  }
  return out;
}
