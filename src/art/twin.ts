// The Twin Blade, the Jedi class's third type: a quick Jar'Kai duelist with a
// saber in each hand, drawn on a rig of his own (the Jedi's robes would bury
// the footwork). He is lean and light on his feet: bare arms, forearms bound
// in leather bracers, linen wraps round his chest and shins, a short
// sleeveless tabard belted at the waist, his hair tied up in a knot with its
// tail falling behind. A long cyan blade in his right hand and a short
// magenta shoto in his left.
//
// His skin, the Dune Wanderer, is a desert nomad: sand wraps over everything,
// a headwrap with brass goggles pushed up on it, an indigo scarf over the
// face, a sun-bleached cloak hanging to his calves, bronze hilts, and blades
// of amber and violet.
//
// Like the Jedi, the body keeps to the 24x32 box inside a larger frame, so
// the blades can reach past it; drawing works in body-box coordinates.
// Right-facing frames are the left-facing ones mirrored.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB, type Vec3 } from './pixel';
import { blade, BOOT, EYE, HILT_DARK, LEATHER, SILVER } from './palette';
import { DIRS, type Dir } from './wizard';
import type { JediMeta } from './jedi';

export const TWIN_W = 48;
export const TWIN_H = 50;
const BODY_X = 12;
const BODY_Y = 12;
/** Sprite origin in the frame: body centre, just under the boots (the Jedi's, so the class shares a footing). */
export const TWIN_ORIGIN_X = BODY_X + 12;
export const TWIN_ORIGIN_Y = BODY_Y + 31;
/** The chest's height above the origin, where his cuts are centred. */
export const TWIN_CHEST_Y = 11;

/** Blade lengths past the emitter: the long saber and the shoto. */
const MAIN_LEN = 10;
const SHOTO_LEN = 6.5;

const ramp = (...c: string[]): RGB[] => c.map(hex);

// ---------------------------------------------------------------------------
// Materials: the Twin Blade

const TWIN_SKIN: Material = {
  ramp: ramp('#4a2a22', '#7a4632', '#a8684a', '#cf916a', '#e8b58c'),
  outline: hex('#24120e'),
  outlineLit: hex('#3e2018'),
};

const TWIN_HAIR: Material = {
  ramp: ramp('#100a0b', '#1e1517', '#302226', '#463438'),
  outline: hex('#070405'),
};

/** The tabard: deep sea-ink, cool against the warm skin and between the two blades. */
const TWIN_TABARD: Material = {
  ramp: ramp('#0b161e', '#142a38', '#1e4052', '#2a586c', '#3e7688'),
  outline: hex('#050b10'),
  outlineLit: hex('#0e1e28'),
};

/** Dull brass: the tabard's edging, the buckle, the studs on the bracers. */
const TWIN_BRASS: Material = {
  ramp: ramp('#3a2a14', '#6a4c22', '#a07a3a', '#cfa95c', '#f0d890'),
  outline: hex('#1a1006'),
  shine: true,
};

/** Linen wraps round the chest and shins. */
const TWIN_WRAP: Material = {
  ramp: ramp('#5e5446', '#8c8070', '#b6aa92', '#d8ceb4', '#eee6d0'),
  outline: hex('#26201a'),
  outlineLit: hex('#3a3228'),
};

const TWIN_BRACER: Material = {
  ramp: ramp('#1a100c', '#2e1c14', '#4a2e1e', '#684430', '#82583c'),
  outline: hex('#0a0604'),
};

const TWIN_TROUSER: Material = {
  ramp: ramp('#141419', '#22222b', '#33333f', '#474756'),
  outline: hex('#08080b'),
};

const SABER_CYAN = blade(['#dcfcff', '#f6ffff'], ['#0a9ec4', '#22d0ec', '#7aeeff']);
const SABER_CYAN_GLOW = hex('#2ee0ff');
const SABER_ROSE = blade(['#ffe0f2', '#fff6fb'], ['#b81274', '#ea2e9c', '#ff7ac8']);
const SABER_ROSE_GLOW = hex('#ff3aa8');

// ---------------------------------------------------------------------------
// Materials: the Dune Wanderer

const DUNE_SKIN: Material = {
  ramp: ramp('#38201a', '#5e362a', '#86523e', '#ac7656', '#c8946c'),
  outline: hex('#1a0c08'),
  outlineLit: hex('#2e1810'),
};

/** Sand-coloured cloth: the headwrap, the arm and chest wraps. */
const DUNE_SAND: Material = {
  ramp: ramp('#5a4630', '#8a7050', '#b89a70', '#dcc49a', '#f2e2bc'),
  outline: hex('#2a1e12'),
  outlineLit: hex('#3e2e1c'),
};

/** The tabard, a darker, dustier umber. */
const DUNE_TABARD: Material = {
  ramp: ramp('#2a1a10', '#46301e', '#664830', '#8a6844', '#ac8a60'),
  outline: hex('#140c06'),
  outlineLit: hex('#22160c'),
};

/** Indigo: the face scarf and the tabard's stripes, like the veils of the deep desert. */
const DUNE_INDIGO: Material = {
  ramp: ramp('#0c0c26', '#18183e', '#26285e', '#383c80', '#5058a2'),
  outline: hex('#06060f'),
  outlineLit: hex('#10102a'),
};

/** The cloak, bleached nearly white by the sun. */
const DUNE_CLOAK: Material = {
  ramp: ramp('#6e6050', '#9a8c78', '#c4b69e', '#e2d8c2', '#f6f0e2'),
  outline: hex('#2e261c'),
  outlineLit: hex('#463c30'),
};

const DUNE_BRONZE: Material = {
  ramp: ramp('#2a1608', '#5a3412', '#8e5a22', '#c48a3e', '#ecc074'),
  outline: hex('#140a02'),
  shine: true,
};

/** The goggles' lenses: dark glass that catches a glint. */
const DUNE_LENS: Material = {
  ramp: ramp('#0e1418', '#1e3038', '#3a5a64', '#7aa6ae'),
  outline: hex('#060a0c'),
  shine: true,
};

const SABER_AMBER = blade(['#fff2d0', '#fffaf0'], ['#c86206', '#f29a14', '#ffc858']);
const SABER_AMBER_GLOW = hex('#ffa020');
const SABER_VIOLET = blade(['#efe0ff', '#faf4ff'], ['#6420d0', '#9a4cff', '#c89aff']);
const SABER_VIOLET_GLOW = hex('#9a50ff');

// ---------------------------------------------------------------------------
// Looks

export interface TwinLook {
  /** Texture key; animations are `${key}_${anim}_${dir}`. */
  key: string;
  skin: Material;
  hair: Material;
  tabard: Material;
  /** The tabard's edging. */
  trim: Material;
  /** The buckle and the bracers' studs. */
  buckle: Material;
  /** Wraps round the chest and the shins. */
  wrap: Material;
  cuff: Material;
  trouser: Material;
  boot: Material;
  belt: Material;
  /** The hilts' metal. */
  hilt: Material;
  /** The long saber, in his right hand, and its halo. */
  main: { core: Material; edge: Material };
  mainGlow: RGB;
  /** The shoto, in his left. */
  shoto: { core: Material; edge: Material };
  shotoGlow: RGB;
  /** Upper arms wrapped in this instead of bare. */
  sleeve?: Material;
  /** The nomad: a headwrap over the hair (its tail the ponytail's), goggles on it, a scarf over the face. */
  nomad?: { headwrap: Material; scarf: Material; lens: Material };
  /** A cloak hanging from the shoulders to the calves, its hem worn ragged. */
  cloak?: Material;
}

export const TWIN_LOOK: TwinLook = {
  key: 'jedi_twin',
  skin: TWIN_SKIN,
  hair: TWIN_HAIR,
  tabard: TWIN_TABARD,
  trim: TWIN_BRASS,
  buckle: TWIN_BRASS,
  wrap: TWIN_WRAP,
  cuff: TWIN_BRACER,
  trouser: TWIN_TROUSER,
  boot: BOOT,
  belt: LEATHER,
  hilt: SILVER,
  main: SABER_CYAN,
  mainGlow: SABER_CYAN_GLOW,
  shoto: SABER_ROSE,
  shotoGlow: SABER_ROSE_GLOW,
};

/** The Dune Wanderer: sand wraps, an indigo face scarf, a bleached cloak, bronze hilts, amber and violet blades. */
export const DUNE_LOOK: TwinLook = {
  key: 'jedi_dune',
  skin: DUNE_SKIN,
  hair: DUNE_SAND,
  tabard: DUNE_TABARD,
  trim: DUNE_INDIGO,
  buckle: DUNE_BRONZE,
  wrap: DUNE_SAND,
  cuff: DUNE_SAND,
  trouser: DUNE_TABARD,
  boot: LEATHER,
  belt: DUNE_INDIGO,
  hilt: DUNE_BRONZE,
  main: SABER_AMBER,
  mainGlow: SABER_AMBER_GLOW,
  shoto: SABER_VIOLET,
  shotoGlow: SABER_VIOLET_GLOW,
  sleeve: DUNE_SAND,
  nomad: { headwrap: DUNE_SAND, scarf: DUNE_INDIGO, lens: DUNE_LENS },
  cloak: DUNE_CLOAK,
};

export const TWIN_LOOKS = [TWIN_LOOK, DUNE_LOOK];

/** The look being drawn; set by buildTwinFrames. */
let S: TwinLook = TWIN_LOOK;

// ---------------------------------------------------------------------------
// Poses

/** A saber in a hand: the grip in body pixels, the blade's angle (0 up, clockwise in degrees) and length. */
export interface Grip {
  hx: number;
  hy: number;
  angle: number;
  len: number;
}

interface Pose {
  /** Whole body raised (on his toes, walk passing frames). */
  lift: number;
  /** Upper body lowered (breathing, crouching). */
  breath: number;
  /** Foot offsets. Side view: forward (+) / back (-). Front and back: lift. */
  footA: number;
  footB: number;
  /** Upper body shifted forward (side view). */
  lean: number;
  /** The tabard's flap (and the cloak) swinging, in pixels. */
  flap: number;
  /** The ponytail swinging, in pixels. */
  tail: number;
  /** The long saber, in his right hand, and the shoto in his left. */
  main: Grip;
  shoto: Grip;
  /** Either blade (and its arm) drawn behind the body. */
  mainBehind?: boolean;
  shotoBehind?: boolean;
  /** The shoto thrown up spinning (the idle moment): it hangs here, the left hand empty. */
  shotoAir?: { x: number; y: number; angle: number };
  blink?: boolean;
  /** 0..1 both blades flaring (the parry's flash, gathering for the Special). */
  flare?: number;
  /** The head bowed this many pixels. */
  headY?: number;
  /** Both blades raised over his head (the X-cut's wind-up): the shoto's arm is drawn over the head too. */
  overHead?: boolean;
}

type View = 'down' | 'up' | 'side';

const RAD = Math.PI / 180;
const MAIN_EMITTER = 1.8;
const SHOTO_EMITTER = 1.3;
const FLAT_DOWN: Vec3 = { x: 0, y: -0.3, z: 0.95 };

function each(x0: number, y0: number, x1: number, y1: number, fn: (x: number, y: number) => void): void {
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) fn(x, y);
}

/**
 * Halo pixels of blades drawn behind the body. Light pixels would shine
 * straight through him, so they wait until the frame is drawn and only land
 * where nothing solid covers them (as the Jedi's saberstaff does).
 */
let hiddenHalo: [number, number, number, RGB][] = [];

/**
 * A saber: a hilt with a dark grip and a blade of light with a white core,
 * rounded at its tip, in a halo. The shoto's hilt and blade are shorter.
 * Returns the tip.
 */
function drawBlade(c: PixelCanvas, s: Grip, kind: 'main' | 'shoto', hidden: boolean, flare = 0): { x: number; y: number } {
  const a = s.angle * RAD;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const px = -dy;
  const py = dx;
  const short = kind === 'shoto';
  const look = short ? S.shoto : S.main;
  const glow = short ? S.shotoGlow : S.mainGlow;
  const emitter = short ? SHOTO_EMITTER : MAIN_EMITTER;
  const butt = short ? -1.5 : -2.2;
  const end = emitter + s.len;
  const reach = end + 3.5;
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

  c.part();
  // Flaring, the halo swells a pixel and burns brighter.
  const haloR = 2.3 + flare * 0.9;
  if (s.len > 0)
    box((x, y, along, side) => {
      if (along < emitter - 0.3 || along > end + haloR) return;
      const rest = end - along;
      const d = Math.abs(side);
      const halo = rest < 0 ? Math.hypot(rest, side) : d;
      if (halo < haloR && (halo >= 1.05 || rest < -0.9)) {
        const k = (halo < 1.6 ? 0.42 : 0.2) + flare * 0.3;
        if (hidden) hiddenHalo.push([x, y, k, glow]);
        else c.spark(x, y, glow, k);
      }
      if (rest < -0.9) return;
      const hw = rest < 0.6 ? 0.75 : 1.05;
      if (d < 0.5 && rest > 0.1) c.px(x, y, look.core, facing(-0.2, 0.3, 0.9));
      else if (d < hw) c.px(x, y, look.edge, facing(-0.2, 0.3, 0.9), { bias: d > 0.8 ? -1 : 0 });
    });
  // The hilt: the metal with a dark grip in the middle and a darker emitter ring.
  c.part();
  box((x, y, along, side) => {
    if (along < butt || along > emitter || Math.abs(side) > 0.62) return;
    const n = facing(px * side - 0.3, py * side + 0.3, 0.8);
    if (along > -0.9 && along < 0.7) c.px(x, y, HILT_DARK, n);
    else if (along > emitter - 0.5) c.px(x, y, HILT_DARK, n, { bias: 1 });
    else c.px(x, y, S.hilt, n, { bias: along > 0 ? 1 : 0 });
  });
  return { x: s.hx + dx * end, y: s.hy + dy * end };
}

/**
 * An arm from the shoulder to the hand: the upper arm bare (or wrapped), the
 * forearm in a bracer with a stud of brass at its top.
 */
function arm(c: PixelCanvas, sx: number, sy: number, hx: number, hy: number, bias = 0): void {
  const vx = hx - sx;
  const vy = hy - sy;
  const l = Math.hypot(vx, vy) || 1;
  c.part();
  c.capsule(sx, sy, hx, hy, 1.25, 1.0, S.sleeve ?? S.skin, { bias });
  const k = l > 4 ? 0.45 : 0.2;
  const mx = sx + vx * k;
  const my = sy + vy * k;
  c.part();
  c.capsule(mx, my, hx - (vx / l) * 0.9, hy - (vy / l) * 0.9, 1.3, 1.2, S.cuff, { bias });
  if (!S.nomad) c.px(mx + vx / l, my + vy / l, S.buckle, sphere(-0.3, -0.4, 1), { bias });
}

function hand(c: PixelCanvas, x: number, y: number, bias = 0): void {
  c.part();
  c.ellipse(x, y, 1.1, 1.1, S.skin, { bias });
}

/** A round shoulder: bare skin, or the nomad's wrapped cloth. */
function shoulder(c: PixelCanvas, x: number, y: number, rx = 1.8, ry = 1.5): void {
  c.part();
  c.ellipse(x, y, rx, ry, S.sleeve ?? S.skin, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.3, 0.95) });
}

function leg(c: PixelCanvas, hx: number, hy: number, fx: number, fy: number, bias = 0): void {
  c.part();
  c.capsule(hx, hy, fx, fy, 1.3, 1.1, S.trouser, { bias });
  // Linen bound round the shin above the boot, two turns of it.
  c.part();
  c.capsule(fx + (hx - fx) * 0.08, fy - 2.1, fx, fy - 0.6, 1.35, 1.25, S.wrap, { bias });
  c.shade(Math.round(fx), Math.round(fy - 1.4), -1);
}

function boot(c: PixelCanvas, x: number, y: number, side = false, bias = 0): void {
  c.part();
  if (side) c.ellipse(x, y, 2.1, 1.2, S.boot, { flatten: 0.8, bias });
  else c.ellipse(x, y, 1.6, 1.25, S.boot, { flatten: 0.8, bias });
}

function eyes(c: PixelCanvas, pts: [number, number][], blink: boolean | undefined): void {
  c.part();
  for (const [x, y] of pts) {
    if (blink) c.px(x, y, S.skin, FLAT_DOWN, { bias: -1 });
    else c.px(x, y, EYE);
  }
}

/**
 * The ponytail (or the nomad's headwrap tail): from the knot down behind the
 * head, swinging by `sway`. Tapered, a tie of brass at its root.
 */
function tail(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, cloth: boolean): void {
  c.part();
  const m = cloth ? S.nomad!.headwrap : S.hair;
  c.capsule(x0, y0, x1, y1, cloth ? 1.25 : 1.15, cloth ? 0.9 : 0.55, m, { bias: -1 });
  if (!cloth) {
    c.part();
    c.px(x0, y0, S.buckle, sphere(-0.2, -0.3, 1));
  }
}

/**
 * The cloak's hem, worn ragged: the row's ends nibbled away in a fixed
 * pattern so the tatters don't crawl from frame to frame.
 */
const ragged = (x: number): boolean => ((x * 7 + 3) % 5) < 2;

// ---------------------------------------------------------------------------
// Directions

type Meta = { tip: { x: number; y: number }; hand: { x: number; y: number }; palm: { x: number; y: number } };

function drawDown(c: PixelCanvas, p: Pose): Meta {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const flare = p.flare ?? 0;
  let tip = { x: 0, y: 0 };
  let tip2 = { x: 0, y: 0 };
  const shR = { x: 7.4, y: 16.6 + U }; // his right shoulder, screen left: the long saber
  const shL = { x: 16.6, y: 16.6 + U }; // his left, screen right: the shoto
  const mainArm = (behind: boolean) => {
    tip = drawBlade(c, p.main, 'main', behind, flare);
    arm(c, shR.x, shR.y, p.main.hx, p.main.hy, behind ? -1 : 0);
    hand(c, p.main.hx, p.main.hy);
  };
  const shotoArm = (behind: boolean) => {
    if (p.shotoAir) {
      arm(c, shL.x, shL.y, p.shoto.hx, p.shoto.hy, behind ? -1 : 0);
      hand(c, p.shoto.hx, p.shoto.hy);
      return;
    }
    tip2 = drawBlade(c, p.shoto, 'shoto', behind, flare);
    arm(c, shL.x, shL.y, p.shoto.hx, p.shoto.hy, behind ? -1 : 0);
    hand(c, p.shoto.hx, p.shoto.hy);
  };

  // Behind him: the cloak's back, and the ponytail peeking past his neck.
  if (S.cloak) {
    const top = 15 + U;
    const bot = 29 + L;
    c.part();
    c.shape(top, bot, (y) => {
      const u = (y + 0.5 - top) / (bot + 1 - top);
      const hw = 4.6 + 1.9 * u;
      const x = cx + p.flap * u * u;
      return [x - hw, x + hw];
    }, S.cloak, (_x, _y, t, u) => cyl(t, 0.2 - u * 0.3), { bias: -2 });
    for (let x = 4; x <= 20; x++) if (ragged(x)) c.erase(x, bot);
  }
  tail(c, 13.6, 9 + U, 15.2 + p.tail * 0.6, 15.6 + U, !!S.nomad);
  if (p.mainBehind) mainArm(true);
  if (p.shotoBehind) shotoArm(true);

  // Legs: trousers, the wrapped shins, soft boots.
  leg(c, 10.1, 23.6 + L, 10, 28.4 - p.footA);
  leg(c, 13.9, 23.6 + L, 14, 28.4 - p.footB);
  boot(c, 9.7, 29.7 - p.footA);
  boot(c, 14.3, 29.7 - p.footB);

  // The chest bound in wraps, a turn of linen every couple of rows.
  const top = 15 + U;
  const waist = 22 + U;
  c.part();
  c.shape(top, waist, (y) => {
    const u = (y + 0.5 - top) / (waist + 1 - top);
    const hw = 3.9 - 0.7 * u * u;
    return [cx - hw, cx + hw];
  }, S.wrap, (_x, _y, t, u) => sphere(t * 0.9, (u - 0.35) * 1.1, 1));
  for (let y = top + 1; y < waist; y++) {
    for (let x = cx - 4; x <= cx + 4; x++) if ((x + y * 2) % 4 === 0) c.shade(x, y, -1);
  }
  // The neck, between the wraps and the jaw.
  c.part();
  c.shape(top - 0.5, top, () => [cx - 1.4, cx + 1.4], S.skin, (_x, _y, t) => cyl(t, 0.1), { bias: -1 });

  // The tabard: a narrow front panel from the collar to the thigh, edged, swinging below the belt.
  const tt = 16 + U;
  const hem = 27 + L;
  const panel = (y: number): [number, number] => {
    const below = y > waist;
    const u = below ? (y - waist) / (hem - waist) : 0;
    const hw = below ? 2.6 + 0.6 * u : 2.5 - 0.2 * Math.max(0, (waist - y) / (waist - tt) - 0.6);
    const x = cx + (below ? p.flap * 0.5 * u * u : 0);
    return [x - hw, x + hw];
  };
  c.part();
  c.shape(tt, hem, panel, S.tabard, (_x, _y, t, u) => cyl(t * 0.8, 0.25 - u * 0.4));
  for (let y = tt; y <= hem; y++) {
    const [l, r] = panel(y);
    c.px(Math.round(l), y, S.trim, cyl(-0.6, 0.2));
    c.px(Math.round(r) - 1, y, S.trim, cyl(0.6, 0.2), { bias: -1 });
  }
  // A stripe down the middle of the nomad's, a fold down the other's; the hem turned up in the trim.
  for (let y = tt + 1; y < hem; y++) {
    const [l, r] = panel(y);
    const mid = Math.round((l + r) / 2 - 0.5);
    if (S.nomad) c.px(mid, y, S.trim, cyl(0, 0.2), { bias: -1 });
    else if (y > waist + 1) c.shade(mid, y, -1);
  }
  {
    const [l, r] = panel(hem);
    for (let x = Math.round(l); x < Math.round(r); x++) c.px(x, hem, S.trim, cyl(0, -0.2), { bias: -1 });
  }
  // The collar: a V of the wraps showing at the throat.
  c.part();
  c.px(cx - 1, tt, S.wrap, sphere(-0.2, -0.5, 1));
  c.px(cx, tt, S.wrap, sphere(0.2, -0.5, 1));
  c.px(cx - 1, tt + 1, S.wrap, sphere(0, -0.3, 1), { bias: -1 });
  // The belt, a pouch on his right hip, the buckle.
  c.part();
  c.shape(waist, waist, () => [cx - 3.6, cx + 3.6], S.belt, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.ellipse(cx - 3.4, waist + 1.2, 1.2, 1.1, S.belt, { bias: -1 });
  c.part();
  c.px(cx - 1, waist, S.buckle, { x: -0.3, y: 0.3, z: 0.9 }, { bias: 1 });
  c.px(cx, waist, S.buckle, { x: 0.2, y: 0.3, z: 0.9 });

  // Shoulders, then the arms that aren't behind him.
  shoulder(c, 16.9, 16.3 + U);
  if (!p.shotoBehind && !p.overHead) shotoArm(false);
  if (p.shotoAir) tip2 = drawBlade(c, { hx: p.shotoAir.x, hy: p.shotoAir.y, angle: p.shotoAir.angle, len: SHOTO_LEN }, 'shoto', false, flare);

  // Head.
  c.offset(BODY_X, BODY_Y + (p.headY ?? 0));
  c.part();
  c.ellipse(cx, 12.6 + U, 3.0, 2.8, S.skin);
  c.part();
  c.px(11, 13 + U, S.skin, sphere(-0.4, -0.3), { bias: 1 });
  c.px(12, 13 + U, S.skin, sphere(0.35, -0.2));
  c.shade(11, 14 + U, -1);
  c.shade(12, 14 + U, -1);
  if (S.nomad) nomadFront(c, cx, U);
  else {
    // Hair pulled back tight from a low widow's peak, a knot on the crown.
    c.part();
    const widths = [2.4, 3.3, 3.7, 3.9];
    c.shape(7 + U, 10 + U, (y) => [cx - widths[y - 7 - U], cx + widths[y - 7 - U]], S.hair, (_x, _y, t, u) => sphere(t * 0.9, u * 1.2 - 0.9, 1));
    c.part();
    c.px(8, 11 + U, S.hair, cyl(-0.8, 0));
    c.px(15, 11 + U, S.hair, cyl(0.8, 0));
    c.px(11, 10 + U, S.skin, sphere(-0.1, -0.8));
    c.px(12, 10 + U, S.skin, sphere(0.1, -0.8));
    c.shade(10, 8 + U, 1);
    c.part();
    c.ellipse(cx, 6.3 + U, 1.5, 1.2, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.2, 1) });
    c.part();
    c.px(cx - 1, 7 + U, S.buckle, sphere(-0.3, 0, 1));
    c.px(cx, 7 + U, S.buckle, sphere(0.3, 0, 1), { bias: -1 });
    // Brows, set low and level.
    c.shade(10, 11 + U, -2);
    c.shade(13, 11 + U, -2);
  }
  eyes(c, [[10, 12 + U], [13, 12 + U]], p.blink);
  c.offset(BODY_X, BODY_Y);

  shoulder(c, 7.1, 16.3 + U);
  if (!p.shotoBehind && p.overHead) shotoArm(false);
  if (!p.mainBehind) mainArm(false);
  return { tip, hand: { x: p.main.hx, y: p.main.hy }, palm: tip2 };
}

/**
 * The nomad's head from the front: a headwrap wound round the crown (its
 * folds slanting), brass goggles pushed up on it, and the indigo scarf drawn
 * up over the nose so only the eyes show.
 */
function nomadFront(c: PixelCanvas, cx: number, U: number): void {
  const n = S.nomad!;
  c.part();
  const widths = [2.6, 3.6, 4.1, 4.3, 4.2];
  c.shape(6 + U, 10 + U, (y) => [cx - widths[y - 6 - U], cx + widths[y - 6 - U]], n.headwrap, (_x, _y, t, u) => sphere(t * 0.9, u * 1.1 - 0.85, 1));
  for (let y = 7; y <= 10; y++) for (let x = 8; x <= 16; x++) if ((x - y * 2) % 4 === 0) c.shade(x, y + U, -1);
  c.part();
  c.px(8, 11 + U, n.headwrap, cyl(-0.8, 0));
  c.px(15, 11 + U, n.headwrap, cyl(0.8, 0));
  // The goggles on the brow of the wrap: two lenses in a brass rim, a strap between.
  c.part();
  for (const x of [9, 10, 13, 14]) c.px(x, 8 + U, S.buckle, sphere((x - cx + 0.5) / 4, -0.3, 1));
  c.px(11, 8 + U, S.buckle, sphere(-0.1, -0.2, 1), { bias: -1 });
  c.px(12, 8 + U, S.buckle, sphere(0.1, -0.2, 1), { bias: -1 });
  c.part();
  c.px(10, 9 + U, n.lens, sphere(-0.4, -0.5, 1), { bias: 1 });
  c.px(13, 9 + U, n.lens, sphere(0.3, -0.5, 1));
  c.spark(10, 9 + U, hex('#e8f4ff'), 0.25);
  // The scarf over the nose and mouth, gathered round the neck.
  c.part();
  const sw = [3.0, 3.2, 3.0, 2.4];
  c.shape(13 + U, 16 + U, (y) => [cx - sw[y - 13 - U], cx + sw[y - 13 - U]], n.scarf, (_x, _y, t, u) => sphere(t * 0.85, u * 0.8 - 0.2, 1));
  c.shade(11, 14 + U, -1);
  c.shade(12, 15 + U, -1);
  c.shade(10, 15 + U, -1);
}

function drawUp(c: PixelCanvas, p: Pose): Meta {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const flare = p.flare ?? 0;
  let tip = { x: 0, y: 0 };
  let tip2 = { x: 0, y: 0 };
  // From behind, his right shoulder is on our right.
  const shR = { x: 16.6, y: 16.6 + U };
  const shL = { x: 7.4, y: 16.6 + U };
  const mainArm = (behind: boolean) => {
    tip = drawBlade(c, p.main, 'main', behind, flare);
    arm(c, shR.x, shR.y, p.main.hx, p.main.hy, behind ? -1 : 0);
    hand(c, p.main.hx, p.main.hy);
  };
  const shotoArm = (behind: boolean) => {
    tip2 = drawBlade(c, p.shoto, 'shoto', behind, flare);
    arm(c, shL.x, shL.y, p.shoto.hx, p.shoto.hy, behind ? -1 : 0);
    hand(c, p.shoto.hx, p.shoto.hy);
  };
  if (p.mainBehind) mainArm(true);
  if (p.shotoBehind) shotoArm(true);

  leg(c, 10.1, 23.6 + L, 10, 28.4 - p.footB);
  leg(c, 13.9, 23.6 + L, 14, 28.4 - p.footA);
  boot(c, 9.7, 29.7 - p.footB);
  boot(c, 14.3, 29.7 - p.footA);

  // The wrapped back, and the tabard's back panel over it.
  const top = 15 + U;
  const waist = 22 + U;
  c.part();
  c.shape(top, waist, (y) => {
    const u = (y + 0.5 - top) / (waist + 1 - top);
    const hw = 3.9 - 0.7 * u * u;
    return [cx - hw, cx + hw];
  }, S.wrap, (_x, _y, t, u) => sphere(t * 0.9, (u - 0.35) * 1.1, 1));
  for (let y = top + 1; y < waist; y++) {
    for (let x = cx - 4; x <= cx + 4; x++) if ((x - y * 2) % 4 === 0) c.shade(x, y, -1);
  }
  const tt = 15.5 + U;
  const hem = 27 + L;
  const panel = (y: number): [number, number] => {
    const below = y > waist;
    const u = below ? (y - waist) / (hem - waist) : 0;
    const hw = below ? 2.7 + 0.6 * u : 2.7;
    const x = cx + (below ? p.flap * 0.5 * u * u : 0);
    return [x - hw, x + hw];
  };
  c.part();
  c.shape(Math.round(tt), hem, panel, S.tabard, (_x, _y, t, u) => cyl(t * 0.8, 0.3 - u * 0.45));
  for (let y = Math.round(tt); y <= hem; y++) {
    const [l, r] = panel(y);
    c.px(Math.round(l), y, S.trim, cyl(-0.6, 0.2));
    c.px(Math.round(r) - 1, y, S.trim, cyl(0.6, 0.2), { bias: -1 });
  }
  c.part();
  c.shape(waist, waist, () => [cx - 3.6, cx + 3.6], S.belt, (_x, _y, t) => cyl(t, 0));
  // The belt's tail hanging from the knot at his back.
  c.part();
  c.px(cx + 1, waist + 1, S.belt, cyl(0.2, -0.3), { bias: -1 });
  c.px(cx + 1, waist + 2, S.belt, cyl(0.2, -0.3), { bias: -1 });

  if (S.cloak) {
    // The cloak over his back from the shoulders to the calves, its hem in tatters.
    const ct = 15 + U;
    const cb = 29 + L;
    const edges = (y: number): [number, number] => {
      const u = Math.max(0, (y + 0.5 - ct) / (cb + 1 - ct));
      const hw = 4.4 + 1.8 * Math.pow(u, 1.1);
      const x = cx + p.flap * u * u;
      return [x - hw, x + hw];
    };
    c.part();
    c.shape(ct, cb, edges, S.cloak, (_x, _y, t, u) => cyl(t * 0.9, 0.3 - u * 0.4));
    for (let y = ct + 4; y <= cb; y++) {
      const [l, r] = edges(y);
      c.shade(Math.round(l + (r - l) * 0.34), y, -1);
      c.shade(Math.round(l + (r - l) * 0.68), y, -1);
    }
    for (let x = 4; x <= 20; x++) if (ragged(x)) c.erase(x, cb);
  }

  // The back of the head and the tail falling from the knot down his back.
  if (S.nomad) {
    c.part();
    c.ellipse(cx, 10.8 + U, 4.1, 3.9, S.nomad.headwrap, { normal: (_x, _y, dx, dy) => sphere(dx * 0.95, dy * 0.9 - 0.2, 1) });
    for (let y = 8; y <= 13; y++) for (let x = 8; x <= 16; x++) if ((x + y * 2) % 4 === 0) c.shade(x, y + U, -1);
    // The goggles' strap round the back of the wrap, the scarf's knot at the nape.
    c.part();
    for (let x = 9; x <= 15; x++) c.px(x, 9 + U, S.buckle, cyl((x - cx) / 4, 0.1), { bias: -1 });
    c.part();
    c.ellipse(cx, 14.6 + U, 2.2, 1.1, S.nomad.scarf);
    tail(c, cx, 12 + U, cx + p.tail * 0.8 + 0.5, 21 + U, true);
  } else {
    c.part();
    c.ellipse(cx, 11 + U, 3.7, 3.8, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.95, dy * 0.9 - 0.2, 1) });
    c.shade(cx - 1, 8 + U, 1);
    for (let y = 9; y <= 13; y++) c.shade(y % 2 ? cx - 2 : cx + 1, y + U, -1);
    c.part();
    c.ellipse(cx, 6.6 + U, 1.5, 1.2, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.2, 1) });
    tail(c, cx, 8 + U, cx + p.tail * 0.8, 18.5 + U, false);
  }

  shoulder(c, 7.1, 16.3 + U);
  shoulder(c, 16.9, 16.3 + U);
  if (!p.shotoBehind) shotoArm(false);
  if (!p.mainBehind) mainArm(false);
  return { tip, hand: { x: p.main.hx, y: p.main.hy }, palm: tip2 };
}

/** Facing left. Right-facing frames are mirrored from these. */
function drawSide(c: PixelCanvas, p: Pose): Meta {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const Sx = -p.lean;
  const hx = cx + Sx; // upper body centre
  const flare = p.flare ?? 0;
  let tip = { x: 0, y: 0 };
  let tip2 = { x: 0, y: 0 };
  const near = { x: hx + 0.2, y: 17.2 + U };
  const far = { x: hx + 1.6, y: 16.9 + U };
  const shotoArm = (behind: boolean) => {
    tip2 = drawBlade(c, p.shoto, 'shoto', behind, flare);
    arm(c, far.x, far.y, p.shoto.hx, p.shoto.hy, -1);
    hand(c, p.shoto.hx, p.shoto.hy, -1);
  };

  // The cloak streaming behind him.
  if (S.cloak) {
    const ct = 15 + U;
    const cb = 29 + L;
    c.part();
    c.shape(ct, cb, (y) => {
      const u = Math.max(0, (y + 0.5 - ct) / (cb + 1 - ct));
      return [hx + 0.6 - Sx * u, hx + 3.2 + 2.8 * Math.pow(u, 1.2) + p.flap * u * u - Sx * u];
    }, S.cloak, (_x, _y, t, u) => cyl(t * 0.8 + 0.15, 0.25 - u * 0.3), { bias: -1 });
    for (let x = 10; x <= 22; x++) if (ragged(x)) c.erase(x, cb);
  }
  // The tail streaming out behind his head.
  tail(c, hx + 2.4, (S.nomad ? 10 : 7.6) + U, hx + 4.8 + p.tail, 14 + U + Math.abs(p.tail) * -0.3, !!S.nomad);

  // The far arm and the shoto, mostly behind him.
  if (p.shotoBehind !== false) shotoArm(true);

  const lift = (f: number) => Math.max(0, f) * 0.35;
  leg(c, cx + 0.9, 23.6 + L, cx + 1.3 - p.footB, 28.4 - lift(p.footB), -1);
  boot(c, cx + 0.6 - p.footB, 29.7 - lift(p.footB), true, -1);
  leg(c, cx - 0.2, 23.6 + L, cx + 0.2 - p.footA, 28.4 - lift(p.footA));
  boot(c, cx - 0.5 - p.footA, 29.7 - lift(p.footA), true);

  // The wrapped chest in profile, the tabard's front and back panels over it.
  const top = 15 + U;
  const waist = 22 + U;
  c.part();
  c.shape(top, waist, (y) => [hx - 2.6 - (y >= top + 1 && y <= top + 3 ? 0.3 : 0), hx + 2.4], S.wrap, (_x, _y, t, u) => sphere(t * 0.9 - 0.1, (u - 0.35) * 1.1, 1));
  for (let y = top + 1; y < waist; y++) for (let x = Math.round(hx - 3); x <= hx + 3; x++) if ((x + y * 2) % 4 === 0) c.shade(x, y, -1);
  c.part();
  c.shape(top - 0.5, top, () => [hx - 2.2, hx + 0.4], S.skin, (_x, _y, t) => cyl(t, 0.1), { bias: -1 });
  const hem = 27 + L;
  // The front panel hangs ahead of his thighs, the back one behind; each swings with the flap.
  const front = (y: number): [number, number] => {
    const u = y > waist ? (y - waist) / (hem - waist) : 0;
    return [hx - 2.9 - (y > waist ? u * 0.4 + Sx * -0.4 * u : 0), hx - 0.9 + (y > waist ? -p.flap * 0.2 * u : 0)];
  };
  const back = (y: number): [number, number] => {
    const u = y > waist ? (y - waist) / (hem - waist) : 0;
    return [hx + 1.0 + (y > waist ? p.flap * 0.3 * u : 0), hx + 2.6 + (y > waist ? u * 0.6 + p.flap * 0.5 * u : 0)];
  };
  c.part();
  c.shape(16 + U, hem, back, S.tabard, (_x, _y, t, u) => cyl(t * 0.6 + 0.3, 0.25 - u * 0.4), { bias: -1 });
  c.part();
  c.shape(16 + U, hem, front, S.tabard, (_x, _y, t, u) => cyl(t * 0.6 - 0.3, 0.25 - u * 0.4));
  for (let y = 16 + U; y <= hem; y++) c.px(Math.round(front(y)[0]), y, S.trim, cyl(-0.7, 0.2));
  c.part();
  c.shape(hem, hem, front, S.trim, (_x, _y, t) => cyl(t, -0.2), { bias: -1 });
  c.part();
  c.shape(waist, waist, () => [hx - 3.0, hx + 2.6], S.belt, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(Math.round(hx - 3.0), waist, S.buckle, { x: -0.5, y: 0.3, z: 0.8 }, { bias: 1 });
  c.part();
  c.ellipse(hx + 1.6, waist + 1.3, 1.1, 1.1, S.belt, { bias: -1 });

  // Head.
  c.offset(BODY_X, BODY_Y + (p.headY ?? 0));
  c.part();
  c.ellipse(hx - 1.2, 12.8 + U, 2.8, 2.6, S.skin);
  c.part();
  c.px(hx - 5, 13 + U, S.skin, sphere(-0.6, -0.2), { bias: 1 });
  c.shade(hx - 4, 14 + U, -1);
  if (S.nomad) {
    const n = S.nomad;
    // The headwrap round the crown, folds slanting back, the goggles on its brow.
    c.part();
    const rows: [number, number][] = [[-2.6, 2.0], [-3.8, 2.8], [-4.3, 3.2], [-4.4, 3.3], [-4.2, 3.3], [-0.2, 3.2]];
    c.shape(6 + U, 11 + U, (y) => {
      const [l, r] = rows[y - 6 - U];
      return [hx + l, hx + r];
    }, n.headwrap, (_x, _y, t, u) => sphere(t * 0.9, u * 1.2 - 0.9, 1));
    for (let y = 7; y <= 11; y++) for (let x = Math.round(hx - 4); x <= hx + 3; x++) if ((x + y * 2) % 4 === 1) c.shade(x, y + U, -1);
    c.part();
    c.px(hx - 4, 8 + U, S.buckle, sphere(-0.6, -0.3, 1));
    c.px(hx - 3, 8 + U, S.buckle, sphere(-0.2, -0.3, 1));
    for (let x = Math.round(hx - 2); x <= hx + 2; x++) c.px(x, 8 + U, S.buckle, cyl((x - hx) / 4, 0), { bias: -1 });
    c.part();
    c.px(hx - 4, 9 + U, n.lens, sphere(-0.6, -0.4, 1), { bias: 1 });
    // The scarf over the lower face, wrapped round to the nape.
    c.part();
    const srows: [number, number][] = [[-5.2, 1.4], [-5.0, 1.6], [-4.4, 1.6], [-3.4, 1.2]];
    c.shape(13 + U, 16 + U, (y) => {
      const [l, r] = srows[y - 13 - U];
      return [hx + l, hx + r];
    }, n.scarf, (_x, _y, t, u) => sphere(t * 0.85 - 0.1, u * 0.8 - 0.2, 1));
    c.shade(hx - 3, 14 + U, -1);
    c.shade(hx - 1, 15 + U, -1);
  } else {
    // Hair swept back to the knot at the crown.
    c.part();
    const rows: [number, number][] = [
      [-2.6, 2.0],
      [-3.6, 2.7],
      [-4.0, 3.0],
      [-4.1, 3.1],
      [-0.4, 3.1],
      [0.2, 2.9],
      [0.6, 2.4],
    ];
    c.shape(7 + U, 13 + U, (y) => {
      const [l, r] = rows[y - 7 - U];
      return [hx + l, hx + r];
    }, S.hair, (_x, _y, t, u) => sphere(t * 0.9, u * 1.4 - 0.9, 1));
    c.erase(hx - 5, 10 + U);
    c.shade(hx - 3, 11 + U, -2);
    c.part();
    c.ellipse(hx + 1.4, 6.6 + U, 1.4, 1.2, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.2, 1) });
  }
  eyes(c, [[hx - 3, 12 + U]], p.blink);
  c.offset(BODY_X, BODY_Y);

  if (p.shotoBehind === false) shotoArm(false);
  // The near arm and the long saber.
  if (p.mainBehind) tip = drawBlade(c, p.main, 'main', true, flare);
  else tip = drawBlade(c, p.main, 'main', false, flare);
  arm(c, near.x, near.y, p.main.hx, p.main.hy);
  hand(c, p.main.hx, p.main.hy);
  shoulder(c, hx + 0.5, 16.8 + U, 1.7, 1.5);
  return { tip, hand: { x: p.main.hx, y: p.main.hy }, palm: tip2 };
}

// ---------------------------------------------------------------------------
// Animations

const m = (hx: number, hy: number, angle: number, len = MAIN_LEN): Grip => ({ hx, hy, angle, len });
const s = (hx: number, hy: number, angle: number, len = SHOTO_LEN): Grip => ({ hx, hy, angle, len });

/**
 * His guard, Jar'Kai style: the long blade raised beside him, the shoto held
 * low and forward to catch what comes in under it.
 */
const GUARD: Record<View, { main: Grip; shoto: Grip }> = {
  down: { main: m(5.4, 21.6, -24), shoto: s(18.6, 22.4, 128) },
  up: { main: m(18.6, 21.6, 24), shoto: s(5.4, 22.4, -128) },
  side: { main: m(8.6, 21.6, -38), shoto: s(14.2, 22.4, 152) },
};

const base = (view: View): Pose => ({
  lift: 0,
  breath: 0,
  footA: 0,
  footB: 0,
  lean: 0,
  flap: 0,
  tail: 0,
  main: { ...GUARD[view].main },
  shoto: { ...GUARD[view].shoto },
  shotoBehind: view === 'side' ? true : undefined,
});

/** Standing, bouncing lightly on the balls of his feet, the blades bobbing with him. */
function idle(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 8;
  for (let f = 0; f < N; f++) {
    const ph = (f / N) * Math.PI * 2;
    const p = base(view);
    p.breath = Math.sin(ph) > 0.2 ? 1 : 0;
    p.main.hy += p.breath * 0.5;
    p.shoto.hy += p.breath * 0.5;
    p.main.angle += Math.sin(ph) * 3;
    p.shoto.angle -= Math.sin(ph + 1) * 4;
    p.tail = Math.sin(ph - 1.2) > 0.4 ? 1 : 0;
    p.flap = Math.sin(ph - 2.2) > 0.6 ? 1 : 0;
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
    const sn = Math.sin(ph);
    const p = base(view);
    p.lift = Math.abs(sn) < 0.6 ? 1 : 0;
    p.tail = Math.round(-sn * 1.2) + (view === 'side' ? 1 : 0);
    p.flap = view === 'side' ? 1 + (p.lift ? 0 : 1) : Math.round(-sn);
    if (view === 'side') {
      p.footA = Math.round(sn * 2.4);
      p.footB = -p.footA;
      p.main.angle -= sn * 9;
      p.main.hx -= sn;
      p.shoto.hx += sn * 0.8;
      p.shoto.angle += sn * 6;
    } else {
      p.footA = sn > 0.3 ? 1 : 0;
      p.footB = sn < -0.3 ? 1 : 0;
      // The hands swing opposite the feet.
      p.main.hy += sn > 0 ? -1 : 0;
      p.shoto.hy += sn < 0 ? -1 : 0;
      p.main.angle += sn * 5;
      p.shoto.angle += sn * 5;
    }
    p.main.hy -= p.lift;
    p.shoto.hy -= p.lift;
    frames.push(p);
  }
  return frames;
}

/** A cut's keyframe: a grip, drawn behind the body or not. */
type Key = Grip & { behind?: boolean };
const bk = (g: Grip): Key => ({ ...g, behind: true });

/**
 * The flurry's three crossing cuts, one hand after the other: the long blade
 * forehand, the shoto backhand the other way, the long blade back again. Each
 * is four frames (wind-up, strike, follow-through, recover); the idle hand
 * holds its blade out of the way. In side view the shoto, in the far hand,
 * is mostly hidden by his body.
 */
const CUTS: Record<'cut1' | 'cut2' | 'cut3', Record<View, { main: Key[]; shoto: Key[] }>> = {
  cut1: {
    down: {
      main: [m(3.6, 16.4, -68), m(9.6, 25, 188), m(15, 23.4, 118), m(6, 21.4, -32)],
      shoto: [s(18.8, 22.4, 140), s(19.2, 22.8, 152), s(19.4, 22.4, 146), s(18.6, 22.4, 132)],
    },
    up: {
      main: [m(20.4, 16.4, 68), bk(m(14.6, 14, -8)), bk(m(7, 17.4, -78)), m(18, 21.4, 32)],
      shoto: [s(5.2, 22.4, -140), s(4.8, 22.8, -150), s(4.6, 22.4, -146), s(5.4, 22.4, -132)],
    },
    side: {
      main: [m(15, 15, 25), m(5.5, 20, -88), m(9.5, 24.5, -160), m(9, 22, -48)],
      shoto: [s(14.6, 22.6, 156), s(15, 23, 162), s(14.8, 22.8, 158), s(14.4, 22.4, 152)],
    },
  },
  cut2: {
    down: {
      main: [m(5, 21, -14), m(4.6, 20.6, -8), m(4.8, 20.8, -12), m(5.4, 21.4, -22)],
      shoto: [s(10.4, 17.6, -62), s(15.4, 24.2, 172), s(20, 22.4, 106), s(18.8, 22.4, 126)],
    },
    up: {
      main: [m(19, 21, 14), m(19.4, 20.6, 8), m(19.2, 20.8, 12), m(18.6, 21.4, 22)],
      shoto: [bk(s(13.6, 17.6, 62)), bk(s(8.6, 15, 4)), s(4, 22.4, -106), s(5.2, 22.4, -126)],
    },
    side: {
      main: [m(11, 21, -18), m(11.6, 20.6, -10), m(11.2, 20.8, -14), m(9.4, 21.6, -34)],
      shoto: [bk(s(14, 15.6, 38)), s(5, 20.6, -94), s(7.6, 24.4, -152), s(14, 22.4, 156)],
    },
  },
  cut3: {
    down: {
      main: [m(14.4, 19, 76), m(12.6, 25, 180), m(4.6, 23.2, 244), m(5.6, 21.4, -26)],
      shoto: [s(19.4, 22.6, 148), s(19.6, 23, 156), s(19.4, 22.6, 150), s(18.6, 22.4, 130)],
    },
    up: {
      main: [bk(m(6, 17, -70)), bk(m(10, 14.4, 6)), m(19.6, 19.6, 88), m(18.4, 21.4, 26)],
      shoto: [s(4.6, 22.6, -148), s(4.4, 23, -156), s(4.6, 22.6, -150), s(5.4, 22.4, -130)],
    },
    side: {
      main: [m(11, 25, 165), m(5.5, 20.5, -92), m(7.5, 15.5, -38), m(9, 22, -40)],
      shoto: [s(14.6, 22.6, 158), s(15, 23, 164), s(14.8, 22.8, 160), s(14.4, 22.4, 152)],
    },
  },
};

function cut(kind: 'cut1' | 'cut2' | 'cut3') {
  return (view: View): Pose[] => {
    const k = CUTS[kind][view];
    return k.main.map((g, i) => {
      const p = base(view);
      const sg = k.shoto[i];
      p.main = { hx: g.hx, hy: g.hy, angle: g.angle, len: g.len };
      p.shoto = { hx: sg.hx, hy: sg.hy, angle: sg.angle, len: sg.len };
      p.mainBehind = g.behind;
      if (view !== 'side') p.shotoBehind = sg.behind;
      // In side view the shoto comes round in front of him as it cuts.
      else p.shotoBehind = !(kind === 'cut2' && (i === 1 || i === 2));
      // Into the strike low and forward, the tabard and the tail whipping after it.
      const way = kind === 'cut2' ? -1 : kind === 'cut1' ? 1 : -1;
      p.breath = i === 1 || i === 2 ? 1 : 0;
      p.flap = i === 0 ? 0 : i < 3 ? -way : 0;
      p.tail = i === 1 ? -way * 2 : i === 2 ? -way : 0;
      if (view === 'side') {
        p.lean = i === 1 || i === 2 ? 1 : 0;
        p.footA = i === 1 || i === 2 ? 2 : 0;
        p.footB = i === 1 || i === 2 ? -1 : 0;
        p.flap = i === 1 || i === 2 ? 2 : 1;
        p.tail = i === 1 || i === 2 ? 2 : 1;
      } else if (i === 1 || i === 2) p.footA = 1;
      return p;
    });
  };
}

/**
 * The X-cut, the flurry's finisher: both blades lifted and crossed over his
 * head, a coil up onto his toes, then both brought down at once and flung
 * apart, carving an X through whatever stands before him.
 */
function xcut(view: View): Pose[] {
  const keys: Record<View, [Grip, Grip][]> = {
    down: [
      [m(8, 11.4, 46), s(16, 11.4, -46)],
      [m(8.6, 10.4, 36), s(15.4, 10.4, -36)],
      [m(4.2, 23.4, -146), s(19.8, 23.4, 146)],
      [m(3.6, 23.6, -124), s(20.4, 23.6, 124)],
      [m(3.8, 23.4, -128), s(20.2, 23.4, 128)],
      [m(5.2, 21.6, -40), s(18.8, 22, 120)],
    ],
    up: [
      [m(16, 11.4, -46), s(8, 11.4, 46)],
      [m(15.4, 10.4, -36), s(8.6, 10.4, 36)],
      [m(19.8, 23.4, 146), s(4.2, 23.4, -146)],
      [m(20.4, 23.6, 124), s(3.6, 23.6, -124)],
      [m(20.2, 23.4, 128), s(3.8, 23.4, -128)],
      [m(18.8, 21.6, 40), s(5.2, 22, -120)],
    ],
    side: [
      [m(12.6, 10.6, 22), s(14, 10.8, -16)],
      [m(13, 9.8, 30), s(14.4, 10, -8)],
      [m(4.4, 21, -122), s(5.8, 22.4, -146)],
      [m(5.4, 24, -150), s(7, 24.6, -166)],
      [m(5.6, 23.8, -146), s(7.2, 24.4, -162)],
      [m(8.8, 21.8, -46), s(14, 22.4, 154)],
    ],
  };
  return keys[view].map(([mg, sg], i) => {
    const p = base(view);
    p.main = { ...mg };
    p.shoto = { ...sg };
    const up = i === 1;
    const down = i >= 2 && i <= 4;
    p.lift = up ? 1 : 0;
    p.breath = i === 0 ? 0 : down ? (i === 2 ? 2 : 1) : 0;
    p.tail = up ? 1 : down ? -2 + (i - 2) : 0;
    p.flap = down ? (i === 2 ? -1 : 1) : 0;
    p.flare = i === 2 ? 0.6 : 0;
    p.overHead = i < 2;
    if (view === 'side') {
      // Both blades come over and down in front of him; the shoto's arm is seen past his chest.
      p.shotoBehind = i < 2 || i === 5;
      p.lean = up ? -1 : down ? 2 : 0;
      p.footA = up ? -1 : down ? 3 : 0;
      p.footB = up ? 1 : down ? -2 : 0;
      p.flap = down ? 3 : 0;
      p.tail = up ? 0 : down ? 3 : 1;
    } else if (down) {
      p.footA = 1;
      p.footB = i === 2 ? 1 : 0;
    }
    if (view === 'up' && (i === 0 || i === 1)) {
      // Raised over his head and crossed, seen from behind: the blades over the crown, his arms in front of them.
      p.mainBehind = false;
      p.shotoBehind = false;
    }
    return p;
  });
}

/** Where the blades cross in his parrying guard, per view (the grips; the X they make sits before his chest). */
const CROSSED: Record<View, { main: Grip; shoto: Grip }> = {
  down: { main: m(9.6, 22.2, 46), shoto: s(14.4, 22.2, -48) },
  up: { main: m(14.4, 22.2, -46), shoto: s(9.6, 22.2, 48) },
  side: { main: m(5.6, 21.2, 18), shoto: s(8.6, 20, -36) },
};

/**
 * The Riposte's stance: both blades brought up and crossed before him, knees
 * bent, the X of light held there and humming, waiting for a blow to turn.
 */
function guard(view: View): Pose[] {
  const x = CROSSED[view];
  const g = GUARD[view];
  const mix = (a: Grip, b: Grip, k: number): Grip => ({ hx: a.hx + (b.hx - a.hx) * k, hy: a.hy + (b.hy - a.hy) * k, angle: a.angle + (b.angle - a.angle) * k, len: a.len });
  const ks = [0.45, 0.85, 1, 1, 1, 1];
  const shimmer = [0, 0.15, 0.35, 0.2, 0.35, 0.2];
  return ks.map((k, i) => {
    const p = base(view);
    p.main = mix(g.main, x.main, k);
    p.shoto = mix(g.shoto, x.shoto, k);
    // Held, the blades tremble against each other by half a pixel.
    if (i >= 2) {
      p.main.hy += i % 2 ? 0.4 : 0;
      p.shoto.hy += i % 2 ? 0 : 0.4;
    }
    p.breath = i === 0 ? 0 : 1;
    p.flare = shimmer[i];
    if (view === 'up') {
      // Crossed before him, away from us: behind his back as we see it.
      p.mainBehind = true;
      p.shotoBehind = true;
    } else if (view === 'side') {
      p.shotoBehind = i === 0;
      p.footA = i === 0 ? 1 : 2;
      p.footB = i === 0 ? -1 : -2;
      p.lean = i === 0 ? 0 : 1;
    } else {
      p.footA = 0;
      p.footB = 0;
      p.lift = 0;
    }
    p.flap = i === 0 ? 1 : 0;
    return p;
  });
}

/**
 * The Riposte's answer: the crossed blades flare as the blow glances off
 * them, then snap apart like shears, cutting outward and forward through
 * whoever struck, and he settles back into his guard.
 */
function counter(view: View): Pose[] {
  const x = CROSSED[view];
  const keys: Record<View, [Grip, Grip][]> = {
    down: [
      [x.main, x.shoto],
      [m(5, 23.6, -142), s(19, 23.6, 142)],
      [m(3.8, 22.6, -112), s(20.2, 22.6, 112)],
      [m(4, 22.4, -116), s(20, 22.4, 116)],
      [m(5.2, 21.6, -36), s(18.8, 22.2, 124)],
    ],
    up: [
      [x.main, x.shoto],
      [m(19, 23.6, 142), s(5, 23.6, -142)],
      [m(20.2, 22.6, 112), s(3.8, 22.6, -112)],
      [m(20, 22.4, 116), s(4, 22.4, -116)],
      [m(18.8, 21.6, 36), s(5.2, 22.2, -124)],
    ],
    side: [
      [x.main, x.shoto],
      [m(3.8, 20.6, -112), s(5.8, 22.6, -138)],
      [m(5, 23.4, -146), s(7, 24.2, -160)],
      [m(5.2, 23.2, -144), s(7.2, 24, -158)],
      [m(8.8, 21.8, -44), s(14, 22.4, 154)],
    ],
  };
  const flare = [1, 0.7, 0.3, 0, 0];
  return keys[view].map(([mg, sg], i) => {
    const p = base(view);
    p.main = { ...mg };
    p.shoto = { ...sg };
    p.flare = flare[i];
    const out = i >= 1 && i <= 3;
    p.breath = i === 0 ? 1 : out ? 1 : 0;
    p.flap = out ? -1 : 0;
    p.tail = i === 1 ? -2 : i === 2 ? -1 : 0;
    if (view === 'up' && i === 0) {
      p.mainBehind = true;
      p.shotoBehind = true;
    }
    if (view === 'side') {
      p.shotoBehind = i === 4;
      p.lean = out ? 2 : 1;
      p.footA = out ? 3 : 2;
      p.footB = out ? -2 : -2;
      p.flap = out ? 3 : 1;
      p.tail = out ? 3 : 1;
    } else if (out) p.footA = 1;
    return p;
  });
}

/**
 * Gathering for the Special (and his pose on the select screen): he sinks
 * into a low crouch, both blades swept out and down behind him, bows his head
 * and shuts his eyes, the blades burning brighter and brighter before he
 * vanishes.
 */
function draw(view: View): Pose[] {
  const keys: Record<View, [Grip, Grip][]> = {
    down: [
      [m(5.4, 21.6, -24), s(18.6, 22.4, 128)],
      [m(4.8, 22.4, -70), s(19.2, 22.8, 100)],
      [m(4.4, 23.6, -118), s(19.6, 23.6, 118)],
      [m(4.4, 23.6, -120), s(19.6, 23.6, 120)],
      [m(4.2, 23.8, -122), s(19.8, 23.8, 122)],
      [m(4.2, 23.8, -122), s(19.8, 23.8, 122)],
    ],
    up: [
      [m(18.6, 21.6, 24), s(5.4, 22.4, -128)],
      [m(19.2, 22.4, 70), s(4.8, 22.8, -100)],
      [m(19.6, 23.6, 118), s(4.4, 23.6, -118)],
      [m(19.6, 23.6, 120), s(4.4, 23.6, -120)],
      [m(19.8, 23.8, 122), s(4.2, 23.8, -122)],
      [m(19.8, 23.8, 122), s(4.2, 23.8, -122)],
    ],
    side: [
      [m(8.6, 21.6, -38), s(14.2, 22.4, 152)],
      [m(11, 22.4, 60), s(14.6, 22.8, 140)],
      [m(13.6, 23.4, 112), s(15, 23.6, 128)],
      [m(13.8, 23.4, 114), s(15.2, 23.6, 130)],
      [m(14, 23.6, 116), s(15.4, 23.8, 132)],
      [m(14, 23.6, 116), s(15.4, 23.8, 132)],
    ],
  };
  const flare = [0, 0.15, 0.35, 0.55, 0.8, 1];
  return keys[view].map(([mg, sg], i) => {
    const p = base(view);
    p.main = { ...mg };
    p.shoto = { ...sg };
    p.flare = flare[i];
    p.breath = i === 0 ? 0 : i === 1 ? 1 : 2;
    p.headY = i >= 3 ? 1 : 0;
    p.blink = i >= 3;
    p.tail = i >= 2 ? (i % 2 ? 1 : 0) : 0;
    p.flap = i >= 2 ? 1 : 0;
    if (view === 'side') {
      p.mainBehind = i >= 2;
      p.lean = i >= 2 ? 2 : i;
      p.footA = i >= 1 ? 3 : 0;
      p.footB = i >= 1 ? -2 : 0;
    } else {
      p.footA = i >= 1 ? 1 : 0;
      p.footB = i >= 2 ? 1 : 0;
    }
    return p;
  });
}

/**
 * The idle moment (`rest`), facing the viewer: he spins both sabers round
 * his fingers, opposite ways, faster and faster; tosses the shoto up,
 * watching it turn over and over in the air while the long blade keeps
 * spinning; snatches it back overhead, snaps both into the crossed guard for
 * a heartbeat, and drops back into his stance.
 */
function flourish(view: View): Pose[] {
  if (view !== 'down') return [];
  const g = GUARD.down;
  const spin = (ma: number, sa: number, o: Partial<Pose> = {}): Pose => {
    const p = base('down');
    p.main = m(5.6, 21, ma);
    p.shoto = s(18.4, 21.2, sa);
    return { ...p, ...o };
  };
  const air = (ma: number, x: number, y: number, a: number, o: Partial<Pose> = {}): Pose =>
    spin(ma, 0, { shoto: s(19, 15.8, 0, 0), shotoAir: { x, y, angle: a }, ...o });
  return [
    { ...base('down'), main: { ...g.main }, shoto: { ...g.shoto } },
    // 1-4: both blades spinning round his fingers, opposite ways.
    spin(22, 84, { breath: 1 }),
    spin(68, 38),
    spin(114, -8),
    spin(160, -54, { tail: 1 }),
    // 5: the shoto hand dips to throw.
    spin(206, -100, { shoto: s(18.8, 22.6, -100), breath: 1 }),
    // 6-9: the shoto up in the air, turning over; the long blade still going; his eyes on it.
    air(252, 19.6, 9, -30, { headY: -1, lift: 1 }),
    air(298, 19.2, 3.6, 90, { headY: -1 }),
    air(344, 19, 2.4, 210, { headY: -1, tail: 1 }),
    air(30, 19, 6.4, 330, { headY: -1 }),
    // 10: snatched out of the air over his shoulder.
    spin(76, 0, { shoto: s(19.2, 15.4, 12), breath: 1 }),
    // 11: both snapped into the crossed guard, flaring.
    { ...base('down'), main: { ...CROSSED.down.main }, shoto: { ...CROSSED.down.shoto }, breath: 1, flare: 0.6 },
    // 12: and eased back out of it.
    { ...base('down'), main: m(5.8, 21.2, -6), shoto: s(18.2, 21.8, 104) },
  ];
}

const FLOURISH_ORDER = [0, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 11, 12, 0] as const;

/** Screen angle (0 = right, 90 = down) he faces in each direction. */
export const TWIN_FACING_DEG: Record<Dir, number> = { right: 0, down: 90, left: 180, up: 270 };

// ---------------------------------------------------------------------------
// Frame generation

export type TwinAnim = 'idle' | 'walk' | 'cut1' | 'cut2' | 'cut3' | 'xcut' | 'guard' | 'counter' | 'draw' | 'rest';

interface TwinAnimDef {
  name: TwinAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => Pose[];
  order?: readonly number[];
}

/** The cuts are quick (four frames each); the X-cut takes its time to coil. */
export const TWIN_ANIMS: TwinAnimDef[] = [
  { name: 'idle', fps: 7, loop: true, poses: idle },
  { name: 'walk', fps: 11, loop: true, poses: walk },
  { name: 'cut1', fps: 22, loop: false, poses: cut('cut1') },
  { name: 'cut2', fps: 22, loop: false, poses: cut('cut2') },
  { name: 'cut3', fps: 22, loop: false, poses: cut('cut3') },
  { name: 'xcut', fps: 20, loop: false, poses: xcut },
  { name: 'guard', fps: 9, loop: false, poses: guard },
  { name: 'counter', fps: 20, loop: false, poses: counter },
  { name: 'draw', fps: 9, loop: false, poses: draw },
  { name: 'rest', fps: 10, loop: false, poses: flourish, order: FLOURISH_ORDER },
];

/** Frame index at which each move lands. */
export const TWIN_HIT_FRAME = { cut1: 1, cut2: 1, cut3: 1, xcut: 2, counter: 1 } as const;

export interface TwinFrame {
  key: string;
  anim: TwinAnim;
  dir: Dir;
  canvas: PixelCanvas;
  /** The Jedi's points: the long blade's tip and grip, and (as the palm) the shoto's tip. */
  meta: JediMeta;
}

function drawTwinFrame(dir: Dir, pose: Pose): { canvas: PixelCanvas; meta: JediMeta } {
  const c = new PixelCanvas(TWIN_W, TWIN_H).offset(BODY_X, BODY_Y);
  hiddenHalo = [];
  const r = dir === 'down' ? drawDown(c, pose) : dir === 'up' ? drawUp(c, pose) : drawSide(c, pose);
  // A blade behind him glows only where his body doesn't cover it.
  for (const [x, y, k, col] of hiddenHalo) {
    const under = c.materialAt(x, y);
    if (!under || under === S.main.core || under === S.main.edge || under === S.shoto.core || under === S.shoto.edge) c.spark(x, y, col, k);
  }
  hiddenHalo = [];
  const meta: JediMeta = {
    tipX: r.tip.x + BODY_X,
    tipY: r.tip.y + BODY_Y,
    handX: r.hand.x + BODY_X,
    handY: r.hand.y + BODY_Y,
    palmX: r.palm.x + BODY_X,
    palmY: r.palm.y + BODY_Y,
  };
  if (dir === 'right') return { canvas: c.mirrored(), meta: { ...meta, tipX: TWIN_W - meta.tipX, handX: TWIN_W - meta.handX, palmX: TWIN_W - meta.palmX } };
  return { canvas: c, meta };
}

export function buildTwinFrames(look: TwinLook = TWIN_LOOK): TwinFrame[] {
  S = look;
  const out: TwinFrame[] = [];
  for (const a of TWIN_ANIMS) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, index) => {
        const { canvas, meta } = drawTwinFrame(dir, pose);
        out.push({ key: `${a.name}_${dir}_${index}`, anim: a.name, dir, canvas, meta });
      });
    }
  }
  S = TWIN_LOOK;
  return out;
}

// ---------------------------------------------------------------------------
// Button icons (16x16), drawn additively like the Jedi's.

/** A button's blade colours: the long blade's white heart, hot and mid, then the shoto's. */
export interface TwinIconColors {
  main: [RGB, RGB, RGB];
  shoto: [RGB, RGB, RGB];
}

export const TWIN_ICON: TwinIconColors = {
  main: [hex('#f6ffff'), hex('#7aeeff'), hex('#22d0ec')],
  shoto: [hex('#fff6fb'), hex('#ff7ac8'), hex('#ea2e9c')],
};
export const DUNE_ICON: TwinIconColors = {
  main: [hex('#fffaf0'), hex('#ffc858'), hex('#f29a14')],
  shoto: [hex('#faf4ff'), hex('#c89aff'), hex('#9a4cff')],
};

type Px = { px: Uint8ClampedArray; add: (x: number, y: number, c: RGB, a?: number) => void };

function icon(): Px {
  const N = 16;
  const px = new Uint8ClampedArray(N * N * 4);
  const add = (x: number, y: number, c: RGB, a = 1) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= N || y >= N) return;
    const i = (y * N + x) * 4;
    px[i] = Math.min(255, px[i] + c[0] * a);
    px[i + 1] = Math.min(255, px[i + 1] + c[1] * a);
    px[i + 2] = Math.min(255, px[i + 2] + c[2] * a);
    px[i + 3] = 255;
  };
  return { px, add };
}

const HILT_ICON: RGB = [196, 204, 220];
const GRIP_ICON: RGB = [64, 66, 80];

/** A saber on a button: a hilt from (x0, y0) along (dx, dy), then `n` pixels of blade with a white heart. */
function iconSaber(add: Px['add'], x0: number, y0: number, dx: number, dy: number, hilt: number, n: number, cols: [RGB, RGB, RGB]): void {
  for (let i = 0; i < hilt; i++) add(x0 + dx * i, y0 + dy * i, i === hilt - 1 || i === 0 ? HILT_ICON : GRIP_ICON, 0.85);
  for (let i = 0; i < n; i++) {
    const x = x0 + dx * (hilt + i);
    const y = y0 + dy * (hilt + i);
    add(x, y, cols[0]);
    add(x + 1, y, cols[1], 0.75);
    add(x, y - 1, cols[1], 0.6);
    add(x - 1, y, cols[2], 0.35);
    add(x, y + 1, cols[2], 0.35);
  }
}

/** The attack: the two blades side by side, slanting up to the right, a cut's arc swept past each. */
export function twinIcon(cols: TwinIconColors): Uint8ClampedArray {
  const { px, add } = icon();
  // The arcs first, faint, so the blades sit over them.
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI * (0.95 + i * 0.05);
    add(9 + Math.cos(a) * 8, 9 + Math.sin(a) * 8, cols.main[2], 0.35 + i * 0.03);
    add(11 + Math.cos(a + 0.4) * 5, 12 + Math.sin(a + 0.4) * 5, cols.shoto[2], 0.3 + i * 0.03);
  }
  iconSaber(add, 2, 12, 1, -1, 3, 9, cols.main);
  iconSaber(add, 7, 15, 1, -1, 2, 6, cols.shoto);
  return px;
}

/** The Riposte: the two blades crossed in an X, a burst of light where a blow glances off the crossing. */
export function riposteIcon(cols: TwinIconColors): Uint8ClampedArray {
  const { px, add } = icon();
  iconSaber(add, 2, 14, 1, -1, 3, 10, cols.main);
  iconSaber(add, 13, 14, -1, -1, 2, 8, cols.shoto);
  // The spark: a white star at the crossing, and splinters of both colours flying off it.
  const cx = 7.5;
  const cy = 8.5;
  add(cx, cy, [255, 255, 255]);
  for (const [dx, dy, k] of [[1, 0, 0.9], [-1, 0, 0.9], [0, 1, 0.9], [0, -1, 0.9], [2, 0, 0.5], [-2, 0, 0.5], [0, -2, 0.5], [0, 2, 0.5]] as const) add(cx + dx, cy + dy, [255, 255, 255], k);
  for (const [dx, dy, main] of [[3, -3, true], [-3, -3, false], [4, -1, false], [-4, -1, true], [2, -4, false]] as const) add(cx + dx, cy + dy, main ? cols.main[1] : cols.shoto[1], 0.8);
  return px;
}
