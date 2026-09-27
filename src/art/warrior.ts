// The warrior, drawn procedurally from a small rig like the wizard.
//
// The body keeps to the same 24x32 box as the wizard. Frames are larger than
// that so the sword can reach past the body during swings: the box sits at
// (BODY_X, BODY_Y) inside a WARRIOR_W x WARRIOR_H frame, and every drawing
// function works in body-box coordinates.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB, type Vec3 } from './pixel';
import {
  BLADE,
  BOOT,
  BRASS,
  CRIMSON,
  EMBER_CORE,
  EMBER_HOT,
  EMBER_MID,
  EYE,
  GOLD,
  HAKAMA,
  JADE,
  KATANA,
  LACQUER,
  LACQUER_DARK,
  LEATHER,
  MAIL,
  SKIN,
  STEEL,
  TROUSER,
  WIND_CORE,
  WIND_HOT,
  WIND_MID,
} from './palette';
import { BRONZE, PTERUGES, SPARTAN_RED, TAN_SKIN } from './heroSkins';
import { DIRS, type Dir } from './wizard';

// ---------------------------------------------------------------------------
// Looks (skins). Every look shares the rig and poses, so the blade sits on the
// same pixels in every frame and gameplay is identical.

export interface WarriorLook {
  /** Texture and animation key prefix, e.g. "warrior" or "warrior_jade". */
  key: string;
  plate: Material;
  mail: Material;
  /** Cape and tabard. */
  cloth: Material;
  /** Plume, or the headband's tails. */
  plume: Material;
  trim: Material;
  belt: Material;
  glove: Material;
  boot: Material;
  trouser: Material;
  skin: Material;
  blade: Material;
  grip: Material;
  /** Crossguard and pommel. */
  guard: Material;
  /** The blade's glow during the special (light-only colours). */
  glow: { core: RGB; hot: RGB; mid: RGB };
  /**
   * false: round helm with a horsehair plume, round pauldrons, broadsword.
   * true: a kabuto with a crescent crest and flared neck guard, headband
   * tails, square laced shoulder plates and a long-gripped katana.
   */
  samurai: boolean;
  /**
   * A Corinthian helm with a tall crest arcing over it, a bronze muscle
   * cuirass, bare arms and legs with bronze greaves, a skirt of leather
   * strips, a round bronze shield on the free arm and a leaf-bladed sword.
   */
  spartan?: boolean;
  /** Arms (default: the mail). */
  arms?: Material;
}

export const KNIGHT_LOOK: WarriorLook = {
  key: 'warrior',
  plate: STEEL,
  mail: MAIL,
  cloth: CRIMSON,
  plume: CRIMSON,
  trim: GOLD,
  belt: LEATHER,
  glove: LEATHER,
  boot: BOOT,
  trouser: TROUSER,
  skin: SKIN,
  blade: BLADE,
  grip: LEATHER,
  guard: GOLD,
  glow: { core: EMBER_CORE, hot: EMBER_HOT, mid: EMBER_MID },
  samurai: false,
};

export const JADE_LOOK: WarriorLook = {
  key: 'warrior_jade',
  plate: LACQUER,
  mail: LACQUER_DARK,
  cloth: JADE,
  plume: JADE,
  trim: BRASS,
  belt: JADE,
  glove: LACQUER_DARK,
  boot: BOOT,
  trouser: HAKAMA,
  skin: SKIN,
  blade: KATANA,
  grip: JADE,
  guard: GOLD,
  glow: { core: WIND_CORE, hot: WIND_HOT, mid: WIND_MID },
  samurai: true,
};

/** The Knight's Spartan skin: bronze, crimson and a round shield. */
export const SPARTAN_LOOK: WarriorLook = {
  key: 'warrior_spartan',
  plate: BRONZE,
  mail: PTERUGES,
  cloth: SPARTAN_RED,
  plume: SPARTAN_RED,
  trim: BRONZE,
  belt: LEATHER,
  glove: TAN_SKIN,
  boot: LEATHER,
  trouser: TAN_SKIN,
  skin: TAN_SKIN,
  blade: BLADE,
  grip: LEATHER,
  guard: BRONZE,
  glow: { core: hex('#fff0e8'), hot: hex('#ff9a80'), mid: hex('#f03a3a') },
  samurai: false,
  spartan: true,
  arms: TAN_SKIN,
};

export const WARRIOR_LOOKS = [KNIGHT_LOOK, JADE_LOOK, SPARTAN_LOOK];

/** The look being drawn. Frame drawing is synchronous, so a module slot is enough. */
let LK: WarriorLook = KNIGHT_LOOK;

export const WARRIOR_W = 48;
export const WARRIOR_H = 50;
export const BODY_X = 12;
export const BODY_Y = 12;
/** Sprite origin in the frame: body centre, just under the boots. */
export const WARRIOR_ORIGIN_X = BODY_X + 12;
export const WARRIOR_ORIGIN_Y = BODY_Y + 31;
/** The chest's height above the origin, where swings are centred. */
export const CHEST_Y = 11;

export interface Sword {
  /** Hand (grip) position in body pixels. */
  hx: number;
  hy: number;
  /** Degrees; 0 = blade straight up, positive turns clockwise. */
  angle: number;
  /** Blade length past the guard. */
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
  /** Cape hem sway in pixels. */
  cape: number;
  /** Plume tip sway in pixels. */
  plume: number;
  /** Free-arm swing in pixels. */
  arm: number;
  /** Upper body shifted forward (side view lunges), in pixels. */
  lean: number;
  sword: Sword;
  /** Sword, sword arm and hand drawn behind the body (reaching away from the camera). */
  swordBehind?: boolean;
  /** Free hand placed here instead of hanging at the side. */
  free?: { x: number; y: number };
  blink?: boolean;
  /** 0..1 blade glow, for the special. */
  glow: number;
}

export interface WarriorMeta {
  /** Blade tip in frame pixels. */
  tipX: number;
  tipY: number;
  glow: number;
}

const RAD = Math.PI / 180;
const BLADE_START = 2.2;

// ---------------------------------------------------------------------------
// Shared parts

/** Run `fn` over every pixel in a box, in body coordinates. */
function each(x0: number, y0: number, x1: number, y1: number, fn: (x: number, y: number) => void): void {
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) fn(x, y);
}

function drawSword(c: PixelCanvas, s: Sword, glow: number): { x: number; y: number } {
  const a = s.angle * RAD;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  // Perpendicular, to the blade's right.
  const px = -dy;
  const py = dx;
  const end = BLADE_START + s.len;
  const tip = { x: s.hx + dx * end, y: s.hy + dy * end };
  const reach = end + 1;
  const box = (fn: (x: number, y: number, along: number, side: number) => void) =>
    each(s.hx - reach, s.hy - reach, s.hx + reach, s.hy + reach, (x, y) => {
      const rx = x + 0.5 - s.hx;
      const ry = y + 0.5 - s.hy;
      fn(x, y, rx * dx + ry * dy, rx * px + ry * py);
    });
  // Screen-space direction -> normal (normals point up for +y).
  const facing = (sx: number, sy: number, z: number): Vec3 => {
    const l = Math.hypot(sx, sy, z) || 1;
    return { x: sx / l, y: -sy / l, z: z / l };
  };

  // Grip and pommel; the katana's grip is long enough for two hands.
  const gripEnd = LK.samurai ? -2.9 : -1.7;
  c.part();
  box((x, y, along, side) => {
    if (along > gripEnd && along < 1.1 && Math.abs(side) < 0.62) c.px(x, y, LK.grip, facing(px * side - 0.3, py * side + 0.3, 0.8));
  });
  c.part();
  box((x, y, along, side) => {
    if (Math.hypot(along - gripEnd + 0.7, side) < (LK.samurai ? 0.7 : 0.85)) c.px(x, y, LK.guard, sphere(-0.4, -0.4), { bias: 1 });
  });
  // Blade: two bevels either side of a ridge, one catching the light, tapering to a point.
  c.part();
  box((x, y, along, side) => {
    if (along < BLADE_START - 0.2 || along > end) return;
    const rest = end - along;
    const u = (along - BLADE_START) / Math.max(1, s.len);
    const hw = LK.samurai
      ? rest < 1.8 ? 0.2 + rest * 0.4 : 0.8
      : LK.spartan
        ? rest < 1.6 ? 0.2 + rest * 0.5 : 0.7 + 0.55 * Math.sin(Math.min(1, u / 0.8) * Math.PI * 0.85)
        : rest < 2.4 ? 0.25 + rest * 0.33 : 0.98;
    if (Math.abs(side) > hw) return;
    const k = side >= 0 ? 1 : -1;
    c.px(x, y, LK.blade, facing(px * k * 0.7, py * k * 0.7, 0.72), { glow: glow * 0.85 });
  });
  // Crossguard, or the katana's small round tsuba.
  const guardW = LK.samurai ? 1.6 : LK.spartan ? 1.7 : 2.5;
  c.part();
  box((x, y, along, side) => {
    if (Math.abs(along - 1.6) < 0.62 && Math.abs(side) < guardW) c.px(x, y, LK.guard, facing(px * side * 0.25 - 0.25, py * side * 0.25 - 0.35, 0.85));
  });

  if (glow > 0) {
    // Embers licking along the edges and a hot point at the tip.
    for (let t = BLADE_START + 1; t < end; t += 1.5) {
      const w = 1.6 + ((t * 7) % 3) * 0.3;
      c.spark(s.hx + dx * t + px * w, s.hy + dy * t + py * w, LK.glow.hot, glow * 0.55);
      c.spark(s.hx + dx * t - px * w, s.hy + dy * t - py * w, LK.glow.mid, glow * 0.45);
      c.spark(s.hx + dx * t, s.hy + dy * t, LK.glow.mid, glow * 0.35);
    }
    c.spark(tip.x, tip.y, LK.glow.core, glow);
  }
  return tip;
}

function arm(c: PixelCanvas, sx: number, sy: number, hx: number, hy: number, bias = 0): void {
  c.part();
  const vx = hx - sx;
  const vy = hy - sy;
  const l = Math.hypot(vx, vy) || 1;
  c.capsule(sx, sy, hx - (vx / l) * 1.0, hy - (vy / l) * 1.0, 1.3, 1.1, LK.arms ?? LK.mail, { bias });
  if (LK.spartan) {
    // A bronze bracer on the forearm.
    c.part();
    c.capsule(sx + vx * 0.55, sy + vy * 0.55, hx - (vx / l) * 1.2, hy - (vy / l) * 1.2, 1.2, 1.15, LK.plate, { bias });
  }
}

function glove(c: PixelCanvas, x: number, y: number): void {
  c.part();
  c.ellipse(x, y, 1.25, 1.2, LK.glove);
}

function pauldron(c: PixelCanvas, x: number, y: number, rx = 2.3, ry = 1.75): void {
  if (LK.samurai) {
    sode(c, x, y, rx, ry);
    return;
  }
  if (LK.spartan) {
    // No pauldron: a bare, sunburnt shoulder.
    c.part();
    c.ellipse(x, y + 0.2, rx * 0.72, ry * 0.9, LK.arms ?? LK.skin, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.3, 0.95) });
    return;
  }
  c.part();
  c.ellipse(x, y, rx, ry, LK.plate, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.25, 0.95) });
}

/** Samurai shoulder plate: a squarer stack of lacquered lames, laced in brass. */
function sode(c: PixelCanvas, x: number, y: number, rx: number, ry: number): void {
  const y0 = Math.round(y - ry + 0.3);
  const y1 = Math.round(y + ry + 0.8);
  c.part();
  c.shape(y0, y1, (yy) => {
    const u = (yy - y0) / Math.max(1, y1 - y0);
    const hw = rx - 0.25 + u * 0.45;
    return [x - hw, x + hw];
  }, LK.plate, (_x, _y, t, u) => sphere(t * 0.8, u * 0.9 - 0.45, 1));
  c.part();
  const lace = (y1 + y0) / 2;
  c.shape(Math.round(lace), Math.round(lace), () => [x - rx + 0.4, x + rx - 0.4], LK.trim, (_x, _y, t) => cyl(t * 0.8, 0));
  c.shade(Math.round(x), y1, -1);
}

function boot(c: PixelCanvas, x: number, y: number, side = false, bias = 0): void {
  c.part();
  if (side) c.ellipse(x, y, 2.2, 1.25, LK.boot, { flatten: 0.8, bias });
  else c.ellipse(x, y, 1.75, 1.3, LK.boot, { flatten: 0.8, bias });
}

function leg(c: PixelCanvas, hx: number, hy: number, fx: number, fy: number, bias = 0): void {
  c.part();
  c.capsule(hx, hy, fx, fy, 1.4, 1.2, LK.trouser, { bias });
  if (LK.spartan) {
    // Bronze greaves over the shins.
    c.part();
    c.capsule(hx + (fx - hx) * 0.5, hy + (fy - hy) * 0.5, fx, fy - 0.2, 1.4, 1.25, LK.plate, { bias });
  }
}

/** A strip of cloth (tabard panel) between rows, `edges` per row, trimmed in gold at the bottom. */
function cloth(c: PixelCanvas, y0: number, y1: number, edges: (y: number) => [number, number], m: Material, trim: boolean, bias = 0): void {
  c.part();
  c.shape(y0, y1, edges, m, (_x, _y, t, u) => cyl(t * 0.6, 0.2 - u * 0.3), { bias });
  if (trim) {
    c.part();
    const e = edges(y1 + 1);
    c.shape(y1 + 1, y1 + 1, () => e, LK.trim, (_x, _y, t) => cyl(t, -0.1));
  }
}

/** Plume of crimson horsehair: a chain of tapering capsules through the given points. */
function plume(c: PixelCanvas, pts: [number, number][], r0 = 1.35, r1 = 0.9): void {
  c.part();
  for (let i = 0; i < pts.length - 1; i++) {
    const ra = r0 + ((r1 - r0) * i) / (pts.length - 1);
    const rb = r0 + ((r1 - r0) * (i + 1)) / (pts.length - 1);
    c.capsule(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], ra, rb, LK.plume, { bias: 1 });
  }
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
    LK.plate,
    (_x, _y, t, u) => sphere(t * 0.95, u * 1.25 - 0.95, 1),
  );
  // Rim: a brighter band just above the eyes.
  c.part();
  c.shape(y1, y1, () => [cx - hw - 0.3, cx + hw + 0.3 + back], LK.plate, (_x, _y, t) => cyl(t, -0.2), { bias: 1 });
}

/** The kabuto's gold crescent crest, horns sweeping up from the brow; `view` picks how it is seen. */
function crest(c: PixelCanvas, cx: number, y: number, view: 'front' | 'back' | 'side'): void {
  c.part();
  if (view === 'side') {
    // Edge-on: one horn curving forward, then back.
    c.capsule(cx, y, cx - 1, y - 2, 0.8, 0.65, LK.guard, { bias: 1 });
    c.capsule(cx - 1, y - 2, cx - 0.5, y - 4.2, 0.65, 0.45, LK.guard, { bias: 1 });
  } else {
    for (const k of [-1, 1]) {
      c.capsule(cx + k * 0.6, y, cx + k * 2.4, y - 1.6, 0.85, 0.7, LK.guard, { bias: 1 });
      c.capsule(cx + k * 2.4, y - 1.6, cx + k * 4.2, y - 4, 0.7, 0.45, LK.guard, { bias: 1 });
    }
  }
  if (view === 'back') return;
  // A jade boss where the horns meet.
  c.part();
  c.px(cx - 0.5, y + 0.2, LK.cloth, sphere(-0.3, -0.3), { bias: 1 });
}

const FLAT_DOWN: Vec3 = { x: 0, y: -0.3, z: 0.95 };

// ---------------------------------------------------------------------------
// The Spartan: Corinthian helm, crest, muscle cuirass and round shield

/** Dark of the helm's openings. */
const SLIT: Material = { ramp: [hex('#0a0604'), hex('#140a06')], outline: hex('#050302'), noAO: true };

/** The crest seen head-on: a tall narrow brush of horsehair above the helm. */
function crestFront(c: PixelCanvas, cx: number, U: number, sway: number): void {
  const top = 0 + U;
  const bottom = 6 + U;
  c.part();
  c.shape(top, bottom, (y) => {
    const u = (y - top) / (bottom - top);
    const hw = 1.0 + 0.5 * Math.sin(Math.min(1, u * 1.4) * Math.PI * 0.5);
    const x = cx + sway * (1 - u) * 0.5;
    return [x - hw, x + hw];
  }, LK.plume, (_x, _y, t, u) => sphere(t * 0.9, u * 0.8 - 0.5, 1), { bias: 1 });
  for (let y = top + 1; y < bottom; y += 2) c.shade(cx, y, -1);
}

/** The crest in profile (facing left): a great arc of horsehair from brow to nape. */
function crestSide(c: PixelCanvas, hx: number, U: number, sway: number): void {
  const ox = hx + 0.4;
  const oy = 9.6 + U;
  c.part();
  for (let y = Math.floor(oy - 9); y <= Math.ceil(oy + 1); y++) {
    for (let x = Math.floor(ox - 7); x <= Math.ceil(ox + 8); x++) {
      const dx = x + 0.5 - ox;
      const dy = y + 0.5 - oy;
      // The back of the arc sweeps further out and down, and sways with the run.
      const back = dx > 0 ? 1 + 0.18 + sway * 0.06 : 1;
      const outer = Math.hypot(dx / (6.0 * back), dy / 8.4);
      const inner = Math.hypot(dx / (4.7 * back), dy / 4.9);
      if (outer > 1 || inner < 1 || dy > 0.5) continue;
      if (dx < -4.8) continue;
      const a = Math.atan2(dy, dx);
      const strand = Math.floor(a * 7) % 2 === 0;
      c.px(x, y, LK.plume, sphere(dx / 7, dy / 8.4, 1), { bias: strand ? 0 : -1 });
    }
  }
}

/** The helm from the front: one bronze bowl down to the chin, the eyes and mouth a dark T. */
function corinthianFront(c: PixelCanvas, cx: number, U: number): void {
  const widths = [2.4, 3.6, 4.2, 4.5, 4.7, 4.7, 4.6, 4.4, 4.1, 3.5, 2.7];
  c.part();
  c.shape(5 + U, 15 + U, (y) => {
    const hw = widths[y - 5 - U];
    return [cx - hw, cx + hw];
  }, LK.plate, (_x, _y, t, u) => sphere(t * 0.95, u * 1.3 - 0.75, 1));
  // A raised brow over the eyes.
  for (let x = 8; x <= 15; x++) c.shade(x, 10 + U, 1);
  c.part();
  for (const x of [9, 10, 13, 14]) c.px(x, 11 + U, SLIT, FLAT_DOWN);
  c.px(10, 12 + U, SLIT, FLAT_DOWN);
  c.px(13, 12 + U, SLIT, FLAT_DOWN);
  for (let y = 13; y <= 15; y++) {
    c.px(11, y + U, SLIT, FLAT_DOWN);
    c.px(12, y + U, SLIT, FLAT_DOWN);
  }
  // The cheek plates curve back from the mouth.
  c.shade(9, 14 + U, -1);
  c.shade(14, 14 + U, -1);
}

/** The helm in profile, facing left: a jutting face plate, the eye hole, the flare over the nape. */
function corinthianSide(c: PixelCanvas, hx: number, U: number): void {
  c.part();
  c.shape(5 + U, 15 + U, (y) => {
    const r = y - 5 - U;
    const front = r < 4 ? hx - [1.8, 3.4, 4.2, 4.6][r] : r > 8 ? hx - 4.9 : hx - 4.6;
    const back = r < 3 ? hx + [1.8, 3.2, 3.8][r] : r > 7 ? hx + 3.8 + (r - 7) * 0.5 : hx + 4.0;
    return [front, back];
  }, LK.plate, (_x, _y, t, u) => sphere(t * 0.9 - 0.1, u * 1.3 - 0.75, 1));
  for (let x = Math.round(hx - 4); x <= Math.round(hx + 1); x++) c.shade(x, 10 + U, 1);
  c.part();
  c.px(hx - 4, 11 + U, SLIT, FLAT_DOWN);
  c.px(hx - 3, 11 + U, SLIT, FLAT_DOWN);
  c.px(hx - 3, 12 + U, SLIT, FLAT_DOWN);
  for (let y = 13; y <= 14; y++) c.px(hx - 5, y + U, SLIT, FLAT_DOWN);
  // The cheek plate's back edge.
  for (let y = 11; y <= 14; y++) c.shade(hx, y + U, -1);
}

/** The round shield, its bronze face toward us with a crimson lambda, or its leather back. */
function aspis(c: PixelCanvas, x: number, y: number, face: boolean, rx = 3.7, ry = 4.1): void {
  c.part();
  c.ellipse(x, y, rx, ry, LK.plate, {
    normal: (_x, _y, dx, dy) => {
      const q = Math.hypot(dx, dy);
      // A rolled rim round a shallow dome.
      return q > 0.78 ? sphere(dx * 0.95, dy * 0.95 - 0.1, 0.8) : sphere(dx * 0.45, dy * 0.45 - 0.15, 1);
    },
    bias: face ? 0 : -1,
  });
  if (!face) {
    c.part();
    c.ellipse(x, y, rx - 1, ry - 1, LK.mail, { normal: (_x, _y, dx, dy) => sphere(-dx * 0.4, -dy * 0.4, 1), bias: -1 });
    c.part();
    c.shape(Math.round(y), Math.round(y), () => [x - rx + 1.5, x + rx - 1.5], LEATHER, (_x, _y, t) => cyl(t, 0.1));
    return;
  }
  // The lambda.
  c.part();
  const ax = Math.floor(x);
  const ay = Math.floor(y) - 2;
  c.px(ax, ay, LK.cloth, { x: -0.1, y: 0.5, z: 0.85 }, { bias: 1 });
  for (let i = 1; i <= 4; i++) {
    const d = Math.round(i * 0.55);
    c.px(ax - d, ay + i, LK.cloth, { x: -0.3, y: 0.3, z: 0.9 }, { bias: 1 });
    c.px(ax + d, ay + i, LK.cloth, { x: 0.3, y: 0.3, z: 0.9 });
  }
}

/** The shield edge-on in profile (facing left), held up before the chest. */
function aspisSide(c: PixelCanvas, x: number, y: number): void {
  c.part();
  c.ellipse(x, y, 1.6, 4.3, LK.plate, { normal: (_x, _y, dx, dy) => sphere(-0.6 + dx * 0.3, dy * 0.9, 0.8) });
  c.part();
  for (let yy = Math.round(y - 3); yy <= Math.round(y + 3); yy++) c.px(Math.floor(x - 1.2), yy, LK.plate, { x: -0.8, y: (y - yy) * 0.1, z: 0.6 }, { bias: 1 });
}

/** The muscle cuirass: a groove down the sternum, the line under the chest and the belly. */
function musclesFront(c: PixelCanvas, top: number): void {
  for (let y = top + 1; y <= top + 5; y++) c.shade(12, y, -1);
  for (const x of [9, 10, 13, 14]) c.shade(x, top + 3, -1);
  for (const x of [10, 14]) c.shade(x, top + 5, -1);
  c.shade(9, top + 1, 1);
  c.shade(13, top + 1, 1);
}

// ---------------------------------------------------------------------------
// Directions

function drawDown(c: PixelCanvas, p: Pose): WarriorMeta {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  let tip = { x: 0, y: 0 };
  const sh = { x: 7.4, y: 16.8 + U }; // sword shoulder (screen left)
  if (p.swordBehind) {
    tip = drawSword(c, p.sword, p.glow);
    arm(c, sh.x, sh.y, p.sword.hx, p.sword.hy, -1);
    glove(c, p.sword.hx, p.sword.hy);
  }

  // Cape lining, seen behind the shoulders and legs.
  const ct = 15 + U;
  const cb = 28 + L;
  c.part();
  c.shape(ct, cb, (y) => {
    const u = (y + 0.5 - ct) / (cb + 1 - ct);
    const hw = 4.8 + 1.8 * u;
    const x = cx + p.cape * u * u;
    return [x - hw, x + hw];
  }, LK.cloth, (_x, _y, t, u) => cyl(t, 0.2 - u * 0.3), { bias: -2 });

  leg(c, 9.9, 24 + L, 9.8, 28.4 - p.footA);
  leg(c, 14.1, 24 + L, 14.2, 28.4 - p.footB);
  boot(c, 9.6, 29.7 - p.footA);
  boot(c, 14.4, 29.7 - p.footB);

  // Breastplate, rounded so it catches the light at the upper left.
  const top = 15 + U;
  const waist = 22 + U;
  c.part();
  c.shape(top, waist - 1, (y) => {
    const u = (y + 0.5 - top) / (waist - top);
    const hw = 4.5 - 0.9 * u * u;
    return [cx - hw, cx + hw];
  }, LK.plate, (_x, _y, t, u) => sphere(t * 0.9, (u - 0.35) * 1.1, 1));
  if (LK.spartan) musclesFront(c, top);

  // Mail skirt, then the tabard falling over chest and skirt.
  const hem = 26 + L;
  c.part();
  c.shape(waist, hem, (y) => {
    const u = (y + 0.5 - waist) / (hem + 1 - waist);
    const hw = 3.9 + 1.1 * u;
    const x = cx + p.cape * 0.3 * u;
    return [x - hw, x + hw];
  }, LK.mail, (_x, _y, t, u) => cyl(t, 0.1 - u * 0.2));
  if (LK.spartan) {
    // A skirt of leather strips: a dark seam between each.
    for (let y = waist + 1; y <= hem; y++) for (let x = cx - 5; x <= cx + 5; x += 2) c.shade(x, y, -1);
  } else for (let y = waist + 1; y <= hem; y += 2) c.shade(cx - 3, y, -1);
  if (!LK.spartan) cloth(c, top + 2, hem, (y) => {
    const u = Math.max(0, (y - waist) / (hem - waist));
    const hw = 1.7 + u * 0.4;
    const x = cx + p.cape * 0.4 * u * u;
    return [x - hw, x + hw];
  }, LK.cloth, true);
  // Belt and buckle.
  c.part();
  c.shape(waist, waist, () => [cx - 3.9, cx + 3.9], LK.belt, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(11, waist, LK.trim, { x: -0.3, y: 0.3, z: 0.9 }, { bias: 1 });
  c.px(12, waist, LK.trim, { x: 0.2, y: 0.3, z: 0.9 });
  // Crest on the tabard: a small gold chevron.
  if (!LK.spartan) {
    c.part();
    c.px(11, 18 + U, LK.trim, { x: -0.4, y: 0.4, z: 0.8 }, { bias: 1 });
    c.px(12, 18 + U, LK.trim, { x: 0.3, y: 0.4, z: 0.85 });
    c.px(11, 19 + U, LK.trim, FLAT_DOWN, { bias: -1 });
    c.px(12, 19 + U, LK.trim, FLAT_DOWN, { bias: -1 });
  }

  // Free arm (character's left, screen right).
  const fh = p.free ? { x: p.free.x, y: p.free.y + U } : { x: 17.6, y: 22.2 + U + p.arm };
  arm(c, 16.6, 16.8 + U, fh.x, fh.y);
  glove(c, fh.x, fh.y);
  pauldron(c, 16.9, 16.3 + U);
  if (LK.spartan) aspis(c, fh.x + 0.6, fh.y - 2.2, true);

  // Mail gorget between chin and breastplate (a bare neck under the Spartan's helm).
  c.part();
  c.shape(15 + U, 15 + U, () => [cx - 2.4, cx + 2.4], LK.spartan ? LK.skin : LK.mail, (_x, _y, t) => cyl(t, 0.2));
  if (LK.spartan) {
    crestFront(c, cx, U, p.plume);
    corinthianFront(c, cx, U);
  } else {
    // Head: face framed by the helmet's cheek guards, a plume on top.
    c.part();
    c.ellipse(cx, 12.6 + U, 3.2, 2.8, LK.skin);
    c.part();
    c.px(11, 13 + U, LK.skin, sphere(-0.4, -0.3), { bias: 1 });
    c.px(12, 13 + U, LK.skin, sphere(0.35, -0.2));
    c.shade(11, 14 + U, -1);
    c.shade(12, 14 + U, -1);
    c.part();
    if (p.blink) {
      c.px(10, 12 + U, LK.skin, FLAT_DOWN, { bias: -1 });
      c.px(13, 12 + U, LK.skin, FLAT_DOWN, { bias: -1 });
    } else {
      c.px(10, 12 + U, EYE);
      c.px(13, 12 + U, EYE);
    }
    if (!LK.samurai) {
      plume(c, [
        [cx, 6 + U],
        [cx + p.plume * 0.4, 3.4 + U],
        [cx + p.plume, 1.8 + U],
      ], 1.7, 1.15);
    }
    dome(c, cx, 5 + U, 10 + U, 4.7);
    c.part();
    if (LK.samurai) {
      // Shikoro: lames flaring out and down past the cheeks.
      const flare = [0.2, 0.7, 1.2, 1.7];
      const guard = [1.6, 1.6, 1.5, 1.3];
      c.shape(11 + U, 14 + U, (y) => [7.6 - flare[y - 11 - U], 7.6 - flare[y - 11 - U] + guard[y - 11 - U]], LK.plate, (_x, _y, t) => cyl(t * 0.4 - 0.6, 0.1));
      c.shape(11 + U, 14 + U, (y) => [16.4 + flare[y - 11 - U] - guard[y - 11 - U], 16.4 + flare[y - 11 - U]], LK.plate, (_x, _y, t) => cyl(t * 0.4 + 0.6, 0.1));
      c.shade(6, 13 + U, -1);
      c.shade(18, 13 + U, -1);
      crest(c, cx, 5.4 + U, 'front');
    } else {
      const guard = [1.9, 1.7, 1.3, 0.8];
      c.shape(11 + U, 14 + U, (y) => [7.6, 7.6 + guard[y - 11 - U]], LK.plate, (_x, _y, t) => cyl(t * 0.4 - 0.6, 0.1));
      c.shape(11 + U, 14 + U, (y) => [16.4 - guard[y - 11 - U], 16.4], LK.plate, (_x, _y, t) => cyl(t * 0.4 + 0.6, 0.1));
    }
  }

  // Sword arm (character's right, screen left).
  if (!p.swordBehind) {
    tip = drawSword(c, p.sword, p.glow);
    arm(c, sh.x, sh.y, p.sword.hx, p.sword.hy);
    glove(c, p.sword.hx, p.sword.hy);
  }
  pauldron(c, 7.1, 16.3 + U);
  return { tipX: tip.x, tipY: tip.y, glow: p.glow };
}

function drawUp(c: PixelCanvas, p: Pose): WarriorMeta {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  let tip = { x: 0, y: 0 };
  const sh = { x: 16.6, y: 16.8 + U }; // sword shoulder (screen right)
  if (p.swordBehind) {
    tip = drawSword(c, p.sword, p.glow);
    arm(c, sh.x, sh.y, p.sword.hx, p.sword.hy, -1);
    glove(c, p.sword.hx, p.sword.hy);
  }

  // The Spartan's shield, held out before him, shows its back past his side.
  const fh = p.free ? { x: 24 - p.free.x, y: p.free.y + U } : { x: 6.4, y: 22.2 + U + p.arm };
  if (LK.spartan) aspis(c, fh.x - 0.6, fh.y - 2.2, false);

  leg(c, 9.9, 24 + L, 9.8, 28.4 - p.footB);
  leg(c, 14.1, 24 + L, 14.2, 28.4 - p.footA);
  boot(c, 9.6, 29.7 - p.footB);
  boot(c, 14.4, 29.7 - p.footA);

  // Backplate and mail skirt, mostly hidden by the cape.
  const top = 15 + U;
  const waist = 22 + U;
  const hem = 26 + L;
  c.part();
  c.shape(top, waist - 1, (y) => {
    const u = (y + 0.5 - top) / (waist - top);
    const hw = 4.5 - 0.9 * u * u;
    return [cx - hw, cx + hw];
  }, LK.plate, (_x, _y, t, u) => sphere(t * 0.9, (u - 0.35) * 1.1, 1));
  c.part();
  c.shape(waist, hem, (y) => {
    const u = (y + 0.5 - waist) / (hem + 1 - waist);
    const hw = 3.9 + 1.1 * u;
    return [cx - hw, cx + hw];
  }, LK.mail, (_x, _y, t, u) => cyl(t, 0.1 - u * 0.2));

  // Free arm (character's left, now screen left), under the cape's edge.
  arm(c, 7.4, 16.8 + U, fh.x, fh.y);
  glove(c, fh.x, fh.y);

  // Cape: falls from the shoulders, gold-trimmed, with two soft folds.
  const ct = 14.5 + U;
  const cb = 27 + L;
  const capeEdges = (y: number): [number, number] => {
    const u = Math.max(0, (y + 0.5 - ct) / (cb + 1 - ct));
    const hw = 4.2 + 1.6 * Math.pow(u, 1.2);
    const x = cx + p.cape * u * u;
    return [x - hw, x + hw];
  };
  cloth(c, ct, cb, capeEdges, LK.cloth, true);
  for (let y = Math.round(ct + 5); y <= cb; y++) {
    const [l, r] = capeEdges(y);
    c.shade(Math.round(l + (r - l) * 0.3), y, -1);
    c.shade(Math.round(l + (r - l) * 0.68), y, -1);
  }

  // Helmet from behind, with a mail neck guard; the plume runs down its back.
  c.part();
  c.shape(13 + U, 15 + U, () => [cx - 3.4, cx + 3.4], LK.spartan ? LK.skin : LK.mail, (_x, _y, t) => cyl(t, 0));
  if (LK.samurai) crest(c, cx, 5.8 + U, 'back'); // behind the helmet: only the horns show
  c.part();
  c.ellipse(cx, 10.2 + U, 4.7, 4.5, LK.plate, { normal: (_x, _y, dx, dy) => sphere(dx * 0.95, dy * 0.9 - 0.15, 1) });
  if (LK.spartan) {
    // The bowl flares over the nape; the crest runs from the brow down the back.
    c.part();
    c.shape(13 + U, 14 + U, (y) => {
      const f = (y - 13 - U) * 0.5;
      return [cx - 4.4 - f, cx + 4.4 + f];
    }, LK.plate, (_x, _y, t, u) => cyl(t, 0.2 - u * 0.4));
    crestFront(c, cx, U, p.plume);
    c.part();
    c.shape(6 + U, 12 + U, (y) => {
      const u = (y - 6 - U) / 6;
      const hw = 1.5 - u * 0.6;
      const x = cx + p.plume * u * 0.4;
      return [x - hw, x + hw];
    }, LK.plume, (_x, _y, t, u) => sphere(t * 0.9, u * 0.6 - 0.1, 1), { bias: 1 });
    for (let y = 7; y <= 12; y += 2) c.shade(cx, y + U, -1);
  } else if (LK.samurai) {
    // Flared neck guard, then the headband's knot and two tails.
    c.part();
    c.shape(12 + U, 14 + U, (y) => {
      const f = (y - 12 - U) * 0.6;
      return [cx - 5 - f, cx + 5 + f];
    }, LK.plate, (_x, _y, t, u) => cyl(t, 0.2 - u * 0.4));
    c.shade(cx - 3, 13 + U, -1);
    c.shade(cx + 3, 13 + U, -1);
    plume(c, [
      [cx - 0.5, 10.5 + U],
      [cx - 1.2 + p.plume * 0.4, 13 + U],
      [cx - 1.6 + p.plume, 16 + U],
    ], 0.8, 0.55);
    plume(c, [
      [cx + 0.5, 10.5 + U],
      [cx + 1.4 + p.plume * 0.5, 12.6 + U],
      [cx + 2.2 + p.plume, 15 + U],
    ], 0.8, 0.55);
  } else {
    plume(c, [
      [cx, 5.2 + U],
      [cx + p.plume * 0.3, 8.5 + U],
      [cx + p.plume * 0.7, 11.5 + U],
      [cx + p.plume, 14.5 + U],
    ], 1.3, 0.8);
  }

  if (!p.swordBehind) {
    tip = drawSword(c, p.sword, p.glow);
    arm(c, sh.x, sh.y, p.sword.hx, p.sword.hy);
    glove(c, p.sword.hx, p.sword.hy);
  }
  pauldron(c, 7.1, 16.1 + U);
  pauldron(c, 16.9, 16.1 + U);
  return { tipX: tip.x, tipY: tip.y, glow: p.glow };
}

/** Facing left. Right-facing frames are mirrored from these. */
function drawSide(c: PixelCanvas, p: Pose): WarriorMeta {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const S = -p.lean; // lean forward = toward the left
  const hx = cx + S; // upper body centre
  let tip = { x: 0, y: 0 };
  const sh = { x: hx + 0.6, y: 17.4 + U };
  if (p.swordBehind) tip = drawSword(c, p.sword, p.glow);

  // Cape streaming behind.
  const ct = 15 + U;
  const cb = 28 + L;
  c.part();
  c.shape(ct, cb, (y) => {
    const u = Math.max(0, (y + 0.5 - ct) / (cb + 1 - ct));
    const l = hx + 1 - 1.6 * u - S * u;
    const r = hx + 3.4 + 2.6 * Math.pow(u, 1.2) + p.cape * u * u - S * u;
    return [l, r];
  }, LK.cloth, (_x, _y, t, u) => cyl(t * 0.8 + 0.15, 0.25 - u * 0.3), { bias: -1 });
  c.part();
  {
    const u = 1;
    c.shape(cb + 1, cb + 1, () => [hx + 1 - 1.6 * u - S, hx + 3.4 + 2.6 + p.cape - S], LK.trim, (_x, _y, t) => cyl(t, -0.1), { bias: -1 });
  }

  // Far arm, mostly hidden behind the body.
  const fh = p.free ? { x: p.free.x + S, y: p.free.y + U } : { x: hx + 2.6 - p.arm, y: 22.2 + U };
  arm(c, hx + 1.8, 17 + U, fh.x, fh.y, -1);
  glove(c, fh.x, fh.y);

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
    const chest = y >= top + 1 && y <= top + 3 ? 0.5 : 0;
    return [hx - 2.9 - chest, hx + 2.8];
  };
  c.part();
  c.shape(top, waist - 1, torso, LK.plate, (_x, _y, t, u) => sphere(t * 0.9 - 0.1, (u - 0.35) * 1.1, 1));
  const skirt = (y: number): [number, number] => {
    const u = (y + 0.5 - waist) / (hem + 1 - waist);
    return [cx - 3.1 + S * 0.5 - u * 0.5, cx + 3.0 + u * 0.8];
  };
  c.part();
  c.shape(waist, hem, skirt, LK.mail, (_x, _y, t, u) => cyl(t * 0.9 - 0.1, 0.1 - u * 0.2));
  if (LK.spartan) {
    // Leather strips, and the cuirass's chest and belly.
    for (let y = waist + 1; y <= hem; y++) for (let x = cx - 4; x <= cx + 4; x += 2) c.shade(x, y, -1);
    c.shade(Math.round(hx - 2), top + 3, -1);
    c.shade(Math.round(hx - 1), top + 3, -1);
    c.shade(Math.round(hx - 2), top + 5, -1);
  } else {
    // Tabard front edge down chest and skirt.
    cloth(c, top + 2, hem, (y) => {
      const [l] = y < waist ? torso(y) : skirt(y);
      return [l, l + 1.6];
    }, LK.cloth, true);
  }
  c.part();
  const [bl, br] = torso(waist - 1);
  c.shape(waist, waist, () => [bl - 0.1, br + 0.2], LK.belt, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(Math.round(bl), waist, LK.trim, { x: -0.5, y: 0.3, z: 0.8 }, { bias: 1 });

  // The Spartan's shield, up before his chest.
  if (LK.spartan) aspisSide(c, hx - 4.4, 19.2 + U);

  // Head: profile face under the helmet, cheek guard, plume streaming back.
  c.part();
  c.shape(15 + U, 15 + U, () => [hx - 2.2, hx + 1.6], LK.spartan ? LK.skin : LK.mail, (_x, _y, t) => cyl(t, 0.2));
  if (LK.spartan) {
    crestSide(c, hx, U, p.plume);
    corinthianSide(c, hx, U);
  } else {
    c.part();
    c.ellipse(hx - 1.2, 12.8 + U, 2.9, 2.7, LK.skin);
    c.part();
    c.px(hx - 5, 13 + U, LK.skin, sphere(-0.6, -0.2), { bias: 1 });
    c.shade(hx - 4, 14 + U, -1);
    c.part();
    if (p.blink) c.px(hx - 3, 12 + U, LK.skin, FLAT_DOWN, { bias: -1 });
    else c.px(hx - 3, 12 + U, EYE);
    if (LK.samurai) {
      plume(c, [
        [hx + 3.2, 9.4 + U],
        [hx + 5.4 + p.plume * 0.4, 10.2 + U],
        [hx + 7.2 + p.plume, 12.4 + U],
      ], 0.8, 0.55);
    } else {
      plume(c, [
        [hx + 0.6, 5.4 + U],
        [hx + 3.4 + p.plume * 0.3, 5.2 + U],
        [hx + 5.6 + p.plume * 0.7, 7.6 + U],
        [hx + 6.4 + p.plume, 10.6 + U],
      ], 1.35, 0.8);
    }
    dome(c, hx - 0.2, 5 + U, 10 + U, 4.5, 0.6);
    c.part();
    // Back of the helmet over the nape, and the cheek guard.
    c.shape(11 + U, 14 + U, (y) => [hx + 0.8, hx + 4.4 - (y - 11 - U) * 0.35], LK.plate, (_x, _y, t, u) => sphere(t * 0.7 + 0.2, u * 0.8, 1));
    c.shape(11 + U, 13 + U, (y) => [hx - 0.6 + (y - 11 - U) * 0.3, hx + 0.9], LK.plate, (_x, _y, t) => cyl(t * 0.5, 0.1), { bias: 1 });
    c.px(hx - 5, 10 + U, LK.plate, { x: -0.3, y: 0.2, z: 0.93 }); // brow lip
    if (LK.samurai) {
      // The neck guard flares further back, and the crest rises from the brow.
      c.shape(13 + U, 14 + U, (y) => [hx + 2, hx + 5 + (y - 13 - U) * 0.8], LK.plate, (_x, _y, t, u) => cyl(t * 0.6 + 0.3, 0.2 - u * 0.4));
      c.shade(Math.round(hx + 4), 14 + U, -1);
      crest(c, hx - 2.8, 6 + U, 'side');
    }
  }

  // Near arm and sword.
  if (!p.swordBehind) tip = drawSword(c, p.sword, p.glow);
  arm(c, sh.x, sh.y, p.sword.hx, p.sword.hy);
  glove(c, p.sword.hx, p.sword.hy);
  pauldron(c, hx + 1.0, 17 + U, 2.1, 1.6);
  return { tipX: tip.x, tipY: tip.y, glow: p.glow };
}

// ---------------------------------------------------------------------------
// Animations

type View = 'down' | 'up' | 'side';

const sw = (hx: number, hy: number, angle: number, len = 10): Sword => ({ hx, hy, angle, len });

const IDLE_SWORD: Record<View, Sword> = {
  down: sw(5, 22, -14),
  up: sw(19, 22, 14),
  side: sw(9, 22, -40),
};

const base = (view: View): Pose => ({
  lift: 0,
  breath: 0,
  footA: 0,
  footB: 0,
  cape: 0,
  plume: 0,
  arm: 0,
  lean: 0,
  sword: { ...IDLE_SWORD[view] },
  glow: 0,
});

function idle(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 8;
  for (let f = 0; f < N; f++) {
    const ph = (f / N) * Math.PI * 2;
    const p = base(view);
    p.breath = Math.sin(ph - 0.6) > 0.1 ? 1 : 0;
    p.sword.hy += p.breath * 0.5;
    p.plume = Math.sin(ph - 1.4) > 0.3 ? 1 : 0;
    p.cape = Math.sin(ph - 2.2) > 0.5 ? 1 : 0;
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
    // The cape and plume trail the stride.
    p.plume = p.lift ? 1 : 2;
    p.cape = view === 'side' ? 1 + (p.lift ? 0 : 1) : Math.round(-s);
    if (view === 'side') {
      p.footA = Math.round(s * 2.4);
      p.footB = -p.footA;
      p.arm = Math.round(s * 1.5);
      p.sword.angle = -40 - s * 8;
      p.sword.hx += -s * 1;
    } else {
      p.footA = s > 0.3 ? 1 : 0;
      p.footB = s < -0.3 ? 1 : 0;
      p.arm = Math.round(-s);
      p.sword.hy += s > 0 ? -1 : 0;
      p.plume = 0;
    }
    p.sword.hy -= p.lift;
    frames.push(p);
  }
  return frames;
}

/** Sword keyframes per view: wind-up, strike, follow-through, follow-through, recover. */
const SWINGS: Record<'slash1' | 'slash2', Record<View, (Sword & { behind?: boolean })[]>> = {
  // Forehand: across the body from the sword side.
  slash1: {
    down: [sw(3.5, 16.5, -70), sw(9.5, 25, 190), sw(14.5, 24, 130), sw(15.5, 22, 104), sw(6.5, 21, -30)],
    up: [sw(20.5, 16.5, 70), { ...sw(14.5, 14, -8), behind: true }, { ...sw(8, 15.5, -60), behind: true }, { ...sw(6, 19, -86), behind: true }, sw(17.5, 21, 30)],
    side: [sw(15, 15, 25), sw(5.5, 20, -88), sw(8.5, 24, -140), sw(10.5, 25, -175), sw(9, 22, -50)],
  },
  // Backhand: back the other way.
  slash2: {
    down: [sw(14.5, 19, 75), sw(13.5, 25, 172), sw(5.5, 24, 232), sw(3.5, 21, 262), sw(5, 21.5, -20)],
    up: [{ ...sw(6, 17, -70), behind: true }, { ...sw(9.5, 14, 5), behind: true }, sw(17, 16, 60), sw(19.5, 19.5, 88), sw(19, 21.5, 20)],
    side: [sw(11, 25, 165), sw(5.5, 20.5, -92), sw(7.5, 15.5, -38), sw(10.5, 13.5, -8), sw(9, 22, -40)],
  },
};

function slash(kind: 'slash1' | 'slash2') {
  return (view: View): Pose[] =>
    SWINGS[kind][view].map((s, i) => {
      const p = base(view);
      p.sword = { hx: s.hx, hy: s.hy, angle: s.angle, len: s.len };
      p.swordBehind = s.behind;
      // Body language: crouch into the strike, cape and plume whipping after it.
      p.breath = i === 1 || i === 2 ? 1 : 0;
      const dirSign = kind === 'slash1' ? 1 : -1;
      p.cape = i === 0 ? 0 : i < 4 ? -dirSign * (view === 'side' ? -1 : 1) : 0;
      p.plume = i === 0 ? dirSign : i < 4 ? -dirSign * 2 : 0;
      if (view === 'side') {
        p.lean = i === 1 || i === 2 ? 1 : 0;
        p.footA = i >= 1 && i <= 3 ? 2 : 0;
        p.footB = i >= 1 && i <= 3 ? -1 : 0;
        p.cape = i >= 1 && i <= 3 ? 2 : 1;
        p.plume = i >= 1 && i <= 3 ? 2 : 1;
      } else {
        p.free = view === 'down' ? { x: 18.6, y: 20.4 } : { x: 18.6, y: 20.4 };
        if (i >= 1 && i <= 3) p.footA = 1;
      }
      return p;
    });
}

/** Finisher: draw back, then lunge and drive the point forward. */
function thrust(view: View): Pose[] {
  const keys: Record<View, Sword[]> = {
    down: [sw(6, 18.5, 180), sw(6.5, 17.5, 182), sw(10.5, 24, 180, 11), sw(10.5, 24, 180, 11), sw(10, 23.5, 180), sw(6, 21, -10)],
    up: [sw(18.5, 22, 0), sw(19, 23, 2), sw(17.5, 14, -3, 11), sw(17.5, 14, -3, 11), sw(17.5, 15, -3), sw(18.5, 21.5, 10)],
    side: [sw(15.5, 20.5, -90), sw(16, 20, -90), sw(4.5, 20, -90, 11), sw(4.5, 20, -90, 11), sw(5, 20.5, -92), sw(9, 22, -45)],
  };
  return keys[view].map((s, i) => {
    const p = base(view);
    p.sword = { ...s };
    const lunge = i >= 2 && i <= 4;
    p.swordBehind = view === 'up' && lunge;
    if (view === 'side') {
      p.lean = lunge ? 2 : i < 2 ? -1 : 0;
      p.footA = lunge ? 3 : i < 2 ? -1 : 0;
      p.footB = lunge ? -2 : i < 2 ? 1 : 0;
      p.free = lunge ? { x: 17, y: 19.5 } : undefined;
      p.cape = lunge ? 3 : 1;
      p.plume = lunge ? 3 : 0;
    } else {
      p.breath = i < 2 || lunge ? 1 : 0;
      p.footA = lunge ? 1 : 0;
      p.free = { x: 18.8, y: lunge ? 19.5 : 21 };
      p.cape = lunge ? (view === 'down' ? 1 : -1) : 0;
      p.plume = lunge ? 2 : -1;
      if (view === 'up') p.free = { x: 18.8, y: 21 };
    }
    return p;
  });
}

/** Special, part 1: crouch and draw the blade back as it kindles. */
function rise(view: View): Pose[] {
  const keys: Record<View, Sword[]> = {
    down: [sw(4.5, 21, -95), sw(4, 21.5, -100), sw(4, 21.5, -106)],
    up: [sw(19.5, 21, 95), sw(20, 21.5, 100), sw(20, 21.5, 106)],
    side: [sw(15, 21, 95), sw(15.5, 21.5, 100), sw(15.5, 21.5, 104)],
  };
  return keys[view].map((s, i) => {
    const p = base(view);
    p.sword = { ...s };
    p.breath = i > 0 ? 1 : 0;
    p.glow = 0.35 + i * 0.33;
    p.free = view === 'side' ? undefined : { x: 18.4, y: 20.2 };
    p.footA = view === 'side' ? 1 : 0;
    p.footB = view === 'side' ? -1 : 0;
    p.cape = i;
    p.plume = -i;
    return p;
  });
}

/** Special, part 3: the blade cools as he straightens up. */
function settle(view: View): Pose[] {
  const keys: Record<View, Sword> = { down: sw(5, 23, -160), up: sw(19, 23, 160), side: sw(10, 23, -145) };
  return [0.5, 0.15].map((g, i) => {
    const p = base(view);
    p.sword = { ...keys[view] };
    p.breath = i === 0 ? 1 : 0;
    p.glow = g;
    p.cape = i === 0 ? -2 : -1;
    p.plume = i === 0 ? -2 : -1;
    return p;
  });
}

/** Screen angle (0 = right, 90 = down) the warrior faces in each direction. */
export const FACING_DEG: Record<Dir, number> = { right: 0, down: 90, left: 180, up: 270 };

/** Special, part 2: one pose of the whirlwind, sword held straight out at screen angle `phi`. */
export const SPIN_FRAMES = 8;

function spinFrame(k: number): { dir: Dir; pose: Pose } {
  const phi = (k * 360) / SPIN_FRAMES;
  const dir: Dir = phi >= 45 && phi < 135 ? 'down' : phi >= 135 && phi < 225 ? 'left' : phi >= 225 && phi < 315 ? 'up' : 'right';
  // Right-facing frames are drawn facing left and mirrored.
  const a = (dir === 'right' ? 180 - phi : phi) * RAD;
  const view: View = dir === 'down' || dir === 'up' ? dir : 'side';
  const p = base(view);
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  p.sword = sw(12 + ca * 5.5, 20 + sa * 3.5, (dir === 'right' ? 180 - phi : phi) + 90, 11);
  p.swordBehind = sa < -0.35;
  p.glow = 1;
  p.breath = 1;
  p.cape = Math.round(-ca * 2);
  p.plume = Math.round(-ca * 2);
  if (view !== 'side') p.free = { x: 12 - ca * 6, y: 19.5 - sa * 2 };
  p.footA = k % 2;
  p.footB = 1 - (k % 2);
  if (view === 'side') {
    p.footA = 1;
    p.footB = -1;
  }
  return { dir, pose: p };
}

// ---------------------------------------------------------------------------
// Frame generation

export type WarriorAnim = 'idle' | 'walk' | 'slash1' | 'slash2' | 'thrust' | 'rise' | 'settle';

export interface WarriorAnimDef {
  name: WarriorAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => Pose[];
}

export const WARRIOR_ANIMS: WarriorAnimDef[] = [
  { name: 'idle', fps: 6, loop: true, poses: idle },
  { name: 'walk', fps: 10, loop: true, poses: walk },
  { name: 'slash1', fps: 18, loop: false, poses: slash('slash1') },
  { name: 'slash2', fps: 18, loop: false, poses: slash('slash2') },
  { name: 'thrust', fps: 16, loop: false, poses: thrust },
  { name: 'rise', fps: 11, loop: false, poses: rise },
  { name: 'settle', fps: 8, loop: false, poses: settle },
];

/** Frame index at which each swing lands its blow. */
export const HIT_FRAME: Record<'slash1' | 'slash2' | 'thrust', number> = { slash1: 1, slash2: 1, thrust: 2 };

export interface WarriorFrame {
  key: string; // e.g. "walk_left_3", or "spin_5"
  anim: WarriorAnim | 'spin';
  dir: Dir | null;
  canvas: PixelCanvas;
  meta: WarriorMeta;
}

export function drawWarriorFrame(dir: Dir, pose: Pose, look: WarriorLook = KNIGHT_LOOK): { canvas: PixelCanvas; meta: WarriorMeta } {
  LK = look;
  const c = new PixelCanvas(WARRIOR_W, WARRIOR_H).offset(BODY_X, BODY_Y);
  let meta: WarriorMeta;
  if (dir === 'down') meta = drawDown(c, pose);
  else if (dir === 'up') meta = drawUp(c, pose);
  else meta = drawSide(c, pose);
  meta = { ...meta, tipX: meta.tipX + BODY_X, tipY: meta.tipY + BODY_Y };
  if (dir === 'right') return { canvas: c.mirrored(), meta: { ...meta, tipX: WARRIOR_W - meta.tipX } };
  return { canvas: c, meta };
}

export function buildWarriorFrames(look: WarriorLook = KNIGHT_LOOK): WarriorFrame[] {
  const out: WarriorFrame[] = [];
  for (const a of WARRIOR_ANIMS) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, index) => {
        const { canvas, meta } = drawWarriorFrame(dir, pose, look);
        out.push({ key: `${a.name}_${dir}_${index}`, anim: a.name, dir, canvas, meta });
      });
    }
  }
  for (let k = 0; k < SPIN_FRAMES; k++) {
    const { dir, pose } = spinFrame(k);
    const { canvas, meta } = drawWarriorFrame(dir, pose, look);
    out.push({ key: `spin_${k}`, anim: 'spin', dir: null, canvas, meta });
  }
  return out;
}
