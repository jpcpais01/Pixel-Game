// The warrior, drawn procedurally from a small rig like the wizard.
//
// The body keeps to the same 24x32 box as the wizard. Frames are larger than
// that so the sword can reach past the body during swings: the box sits at
// (BODY_X, BODY_Y) inside a WARRIOR_W x WARRIOR_H frame, and every drawing
// function works in body-box coordinates.

import { PixelCanvas, cyl, hex, sphere, type Material, type NormalFn, type RGB, type Vec3 } from './pixel';
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
  SILVER,
  SKIN,
  STEEL,
  TROUSER,
  WIND_CORE,
  WIND_HOT,
  WIND_MID,
} from './palette';
import { BRONZE, PTERUGES, SPARTAN_RED, TAN_SKIN } from './heroSkins';
import { DIRS, type Dir } from './wizard';
import { AFONSO_BEARD, CROSS_BLUE, ERMINE, ERMINE_TAIL, KING_HAIR, NORMAN_IRON, ROYAL, RUBY, SAPPHIRE, SURCOAT } from './king';
import { HOLLOW_BLADE, HOLLOW_CLOAK, HOLLOW_GLOW, HOLLOW_IRON, HOLLOW_MAIL, PUMPKIN, RUST, lanternBack, lanternFront, lanternSide } from './headless';
import { ASH, BIRCH, BLONDE, COPPER, GILT, LAKE_SILK, MOON_PEARL, MOON_STEEL, PEARL, PLATINUM, RAVEN_CLOTH, RAVEN_HAIR, RAVEN_STEEL, RAVEN_WING, ROSE_LIP, ROSE_WING, SKY_CLOTH, SLATE_WING, STORM_ASH, STORM_CLOTH, STORM_STEEL, SUN_WOOD, SWAN, SWAN_DOWN, SWAN_TIP, WHITE_HAIR } from './valkyrie';

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
  /**
   * The Valkyrie: great feathered wings at her back instead of the cape, a
   * helm with little wings at its sides instead of the plume, two long braids,
   * and a spear (grip is its shaft, guard its bands, blade its head).
   */
  valkyrie?: boolean;
  wing?: Material;
  hair?: Material;
  /**
   * The Stormwing's shape instead of the Spearmaiden's: a helm with a crest of
   * lightning and a nose guard instead of little wings, a loose mane instead
   * of braids, great wings raised high in a V, spiked shoulders, a bare
   * breastplate with a rune of lightning instead of the tabard, and a jagged
   * bolt of a spearhead. Lightning crackles along her feathers.
   */
  storm?: boolean;
  /** A ring of sunlight behind her head (the Spearmaiden's Sunshield skin). */
  sun?: boolean;
  /**
   * The Swan Maiden (with `valkyrie`): no helm, only a slender silver diadem
   * with a single swan feather on her bare platinum hair, which falls loose
   * behind into two long braids; a face with lips; great swan wings of
   * layered feather rows, their flight feathers tipped in `tip`; a fitted
   * pearl bodice and feathered shoulder caps over a flowing silk skirt (the
   * cloth) instead of the tabard and mail; and a slim silver leaf of a spear
   * with a tassel of white feathers. `gem` is the diadem's and brooch's pearl.
   */
  swan?: boolean;
  tip?: Material;
  lips?: Material;
  /**
   * The King: a bare head under a jewelled crown, hair to the shoulders and a
   * full beard, an ermine mantle on the shoulders instead of pauldrons, a
   * crown on the tabard and a broad, gold-hilted greatsword. Idle, he rests on
   * it point-down, both hands on the pommel.
   */
  king?: boolean;
  beard?: Material;
  ermine?: Material;
  /** The crown's gems. */
  gem?: Material;
  /** The tabard, when it isn't the cape's cloth. */
  surcoat?: Material;
  /**
   * Afonso Henriques (with `king`): the first king of Portugal as his statue
   * stands in Guimarães. A conical helm with a nose guard, ringed by a crown,
   * a mail coif round a long beard, a mail hauberk under a white surcoat with
   * a blue cross, a blue cloak, and a kite shield bearing the cross; idle, one
   * hand on his planted sword and the shield at his side.
   */
  afonso?: boolean;
  /**
   * The Headless Knight: no head at all, only a ragged collar with a carved
   * jack-o'-lantern burning in it; battered plate, a tattered cloak and
   * tabard, and a notched sword whose edge smoulders.
   */
  headless?: boolean;
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

/** The Valkyrie's Spearmaiden: bright steel and gold, swan wings, golden braids. */
export const SPEAR_LOOK: WarriorLook = {
  key: 'valkyrie',
  plate: STEEL,
  mail: MAIL,
  cloth: SKY_CLOTH,
  plume: SKY_CLOTH,
  trim: GOLD,
  belt: LEATHER,
  glove: LEATHER,
  boot: BOOT,
  trouser: TROUSER,
  skin: SKIN,
  blade: BLADE,
  grip: ASH,
  guard: GOLD,
  glow: { core: hex('#fffdf2'), hot: hex('#ffe6a0'), mid: hex('#f4c050') },
  samurai: false,
  valkyrie: true,
  wing: SWAN,
  hair: BLONDE,
};

/** The Valkyrie's Stormwing: blackened steel, slate wings crackling with lightning, white braids. */
export const STORM_LOOK: WarriorLook = {
  key: 'valkyrie_storm',
  plate: STORM_STEEL,
  mail: MAIL,
  cloth: STORM_CLOTH,
  plume: STORM_CLOTH,
  trim: SILVER,
  belt: LEATHER,
  glove: LEATHER,
  boot: BOOT,
  trouser: TROUSER,
  skin: SKIN,
  blade: BLADE,
  grip: STORM_ASH,
  guard: SILVER,
  glow: { core: hex('#f2fbff'), hot: hex('#a8e4ff'), mid: hex('#5ec8ff') },
  samurai: false,
  valkyrie: true,
  wing: SLATE_WING,
  hair: WHITE_HAIR,
  storm: true,
};

/** The Spearmaiden's Sunshield skin: gilded plate, a crimson tabard, rose-gold wings, copper braids and a halo of the sun. */
export const SUN_LOOK: WarriorLook = {
  ...SPEAR_LOOK,
  key: 'valkyrie_sun',
  plate: GILT,
  cloth: CRIMSON,
  plume: CRIMSON,
  trim: GOLD,
  grip: SUN_WOOD,
  guard: GOLD,
  wing: ROSE_WING,
  hair: COPPER,
  glow: { core: hex('#fffbf0'), hot: hex('#ffd890'), mid: hex('#ff8a4a') },
  sun: true,
};

/** The Stormwing's Raven Queen skin: black steel with a violet sheen, raven wings, black hair and violet lightning. */
export const RAVEN_LOOK: WarriorLook = {
  ...STORM_LOOK,
  key: 'valkyrie_raven',
  plate: RAVEN_STEEL,
  cloth: RAVEN_CLOTH,
  plume: RAVEN_CLOTH,
  trim: SILVER,
  grip: STORM_ASH,
  wing: RAVEN_WING,
  hair: RAVEN_HAIR,
  glow: { core: hex('#f8f0ff'), hot: hex('#d8b0ff'), mid: hex('#a060ff') },
};

/** The Spearmaiden's Swan Maiden skin: pearl and silver-blue over lake-blue silk, swan wings, platinum braids and a diadem. */
export const SWAN_LOOK: WarriorLook = {
  ...SPEAR_LOOK,
  key: 'valkyrie_swan',
  plate: PEARL,
  cloth: LAKE_SILK,
  plume: LAKE_SILK,
  trim: SILVER,
  belt: MOON_STEEL,
  glove: PEARL,
  boot: MOON_STEEL,
  arms: MOON_STEEL,
  blade: BLADE,
  grip: BIRCH,
  guard: SILVER,
  wing: SWAN_DOWN,
  tip: SWAN_TIP,
  hair: PLATINUM,
  lips: ROSE_LIP,
  gem: MOON_PEARL,
  glow: { core: hex('#ffffff'), hot: hex('#dfeaff'), mid: hex('#8cb8e8') },
  swan: true,
};

/** The King: bright steel, royal purple and gold, an ermine mantle, a jewelled crown. */
export const KING_LOOK: WarriorLook = {
  key: 'warrior_king',
  plate: STEEL,
  mail: MAIL,
  cloth: ROYAL,
  plume: ROYAL,
  trim: GOLD,
  belt: LEATHER,
  glove: GILT,
  boot: BOOT,
  trouser: TROUSER,
  skin: SKIN,
  blade: BLADE,
  grip: ROYAL,
  guard: GOLD,
  glow: { core: hex('#fffdf0'), hot: hex('#ffe8a0'), mid: hex('#f4c040') },
  samurai: false,
  king: true,
  hair: KING_HAIR,
  beard: KING_HAIR,
  ermine: ERMINE,
  gem: RUBY,
};

/** The King's Afonso Henriques skin: iron and mail, a white surcoat and the blue cross, a long dark beard. */
export const AFONSO_LOOK: WarriorLook = {
  ...KING_LOOK,
  key: 'warrior_afonso',
  plate: NORMAN_IRON,
  cloth: CROSS_BLUE,
  plume: CROSS_BLUE,
  surcoat: SURCOAT,
  glove: MAIL,
  arms: MAIL,
  trouser: MAIL,
  boot: LEATHER,
  grip: LEATHER,
  guard: NORMAN_IRON,
  hair: AFONSO_BEARD,
  beard: AFONSO_BEARD,
  gem: SAPPHIRE,
  glow: { core: hex('#ffffff'), hot: hex('#d8e8ff'), mid: hex('#5a8aff') },
  afonso: true,
};

/** The Knight's Headless Knight skin (Hallow's Eve): blackened iron and rust, a violet-black cloak, a jack-o'-lantern for a head. */
export const HEADLESS_LOOK: WarriorLook = {
  key: 'warrior_headless',
  plate: HOLLOW_IRON,
  mail: HOLLOW_MAIL,
  cloth: HOLLOW_CLOAK,
  plume: HOLLOW_CLOAK,
  trim: RUST,
  belt: LEATHER,
  glove: HOLLOW_MAIL,
  boot: HOLLOW_IRON,
  trouser: HOLLOW_MAIL,
  skin: PUMPKIN,
  blade: HOLLOW_BLADE,
  grip: LEATHER,
  guard: RUST,
  glow: HOLLOW_GLOW,
  samurai: false,
  headless: true,
};

export const WARRIOR_LOOKS = [KNIGHT_LOOK, JADE_LOOK, SPARTAN_LOOK, HEADLESS_LOOK, SPEAR_LOOK, STORM_LOOK, SUN_LOOK, RAVEN_LOOK, SWAN_LOOK, KING_LOOK, AFONSO_LOOK];

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
  // The idle moment's extras (see `rest`), left unset by every other move.
  /** Each shoulder raised (-) or dropped (+) in pixels: the sword shoulder, then the free one. */
  shrug?: [number, number];
  /** The whole head nudged by whole pixels: a tilt, a nod, the chin up. */
  head?: { x: number; y: number };
  /** Eyes raised a row (-1) to look up. */
  look?: number;
  /** The Valkyrie's wings stretched wide (+) or folded close (-), raised further, their feather tips shaken. */
  spread?: number;
  wingLift?: number;
  ruffle?: number;
  /** Light laid over the finished figure (glints, crackles), in body pixels. */
  fx?: (c: PixelCanvas) => void;
}

export interface WarriorMeta {
  /** Blade tip in frame pixels. */
  tipX: number;
  tipY: number;
  glow: number;
}

const RAD = Math.PI / 180;
const BLADE_START = 2.2;
/** Where the Headless Knight's blade is nicked, as fractions of its length, and how brightly its edge smoulders. */
const NICKS = [0.35, 0.7];
const EDGE_EMBER = 0.4;

// ---------------------------------------------------------------------------
// Shared parts

/** Run `fn` over every pixel in a box, in body coordinates. */
function each(x0: number, y0: number, x1: number, y1: number, fn: (x: number, y: number) => void): void {
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) fn(x, y);
}

function drawSword(c: PixelCanvas, s: Sword, glow: number): { x: number; y: number } {
  if (LK.valkyrie) return drawSpear(c, s, glow);
  const a = s.angle * RAD;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  // Perpendicular, to the blade's right.
  const px = -dy;
  const py = dx;
  // The King's greatsword is a pixel longer than a knight's sword.
  const end = BLADE_START + s.len + (LK.king ? 1 : 0);
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
    if (Math.hypot(along - gripEnd + 0.7, side) < (LK.samurai ? 0.7 : LK.king ? 1.05 : 0.85)) c.px(x, y, LK.guard, sphere(-0.4, -0.4), { bias: 1 });
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
        : LK.king
          ? rest < 2.8 ? 0.25 + rest * 0.38 : 1.2
          : rest < 2.4 ? 0.25 + rest * 0.33 : 0.98;
    if (Math.abs(side) > hw) return;
    const k = side >= 0 ? 1 : -1;
    // The Headless Knight's blade is nicked along one edge, and the other smoulders.
    if (LK.headless && k > 0 && NICKS.some((n) => Math.abs(along - BLADE_START - n * s.len) < 0.5)) return;
    c.px(x, y, LK.blade, facing(px * k * 0.7, py * k * 0.7, 0.72), { glow: glow * 0.85 });
    if (LK.headless && k < 0) c.spark(x, y, LK.glow.mid, EDGE_EMBER);
  });
  if (LK.king) {
    // A fuller down the middle of the greatsword, most of its length.
    box((x, y, along, side) => {
      if (along > BLADE_START + 0.6 && along < end - 3 && Math.abs(side) < 0.4) c.shade(x, y, -1);
    });
  }
  // Crossguard, or the katana's small round tsuba.
  const guardW = LK.samurai ? 1.6 : LK.spartan ? 1.7 : LK.king ? 3.1 : 2.5;
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

/** How far a spear's point reaches past a sword's, and its butt behind the hand. */
const SPEAR_REACH = 1.8;
const SPEAR_BUTT = -5.5;
const SPEAR_HEAD = 4.4;

/** The Valkyrie's spear, held at the same grip as the sword: an ash shaft, gold bands, a leaf-shaped head. */
function drawSpear(c: PixelCanvas, s: Sword, glow: number): { x: number; y: number } {
  const a = s.angle * RAD;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const px = -dy;
  const py = dx;
  const end = BLADE_START + s.len + SPEAR_REACH;
  const neck = end - SPEAR_HEAD;
  const tip = { x: s.hx + dx * end, y: s.hy + dy * end };
  const reach = Math.max(end, -SPEAR_BUTT) + 1;
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
  // The shaft, from the butt to the head's socket.
  c.part();
  box((x, y, along, side) => {
    if (along > SPEAR_BUTT && along < neck + 0.3 && Math.abs(side) < 0.56) c.px(x, y, LK.grip, facing(px * side - 0.3, py * side + 0.3, 0.8));
  });
  // A band at the butt and the socket where the head is bound on.
  c.part();
  box((x, y, along, side) => {
    const band = (along > SPEAR_BUTT && along < SPEAR_BUTT + 1) || Math.abs(along - neck) < 0.6;
    if (band && Math.abs(side) < 0.9) c.px(x, y, LK.guard, facing(px * side * 0.3 - 0.25, py * side * 0.3 - 0.3, 0.85));
  });
  // The head: a leaf, widest a third of the way up, with a ridge down its
  // middle; or the Stormwing's, a jagged bolt that zigzags to its point and
  // always glows a little.
  c.part();
  box((x, y, along, side) => {
    if (along < neck + 0.2 || along > end) return;
    const u = (along - neck) / SPEAR_HEAD;
    let off = 0;
    let hw: number;
    if (LK.storm) {
      off = (Math.floor(u * 3.2) % 2 ? 0.75 : -0.75) * (1 - u);
      hw = u < 0.12 ? 0.5 + u * 3 : 0.3 + 0.75 * (1 - u);
    } else if (LK.swan) {
      // A slimmer willow leaf, widest low down and drawn out to a long point.
      hw = u < 0.3 ? 0.45 + (u / 0.3) * 0.6 : 0.1 + (0.95 * (1 - u)) / 0.7;
    } else hw = u < 0.35 ? 0.55 + (u / 0.35) * 0.8 : 0.15 + (1.2 * (1 - u)) / 0.65;
    if (Math.abs(side - off) > hw) return;
    const k = side - off >= 0 ? 1 : -1;
    c.px(x, y, LK.blade, facing(px * k * 0.7, py * k * 0.7, 0.72), { glow: LK.storm ? Math.max(0.3, glow * 0.85) : glow * 0.85 });
  });
  if (LK.storm) c.spark(tip.x, tip.y, LK.glow.hot, 0.5);
  if (LK.swan) {
    // A tassel of white feathers tied under the socket, hanging down whichever
    // way the spear points, and a pearl bead where it is bound.
    const nx = s.hx + dx * (neck - 1.2);
    const ny = s.hy + dy * (neck - 1.2);
    c.part();
    for (const [ox, len] of [[-0.35, 2.6], [0.45, 2.1]] as const) {
      const fx = nx + ox;
      c.capsule(fx, ny + 0.5, fx + ox * 0.5, ny + 0.5 + len, 0.55, 0.4, LK.wing ?? LK.plate, { bias: ox < 0 ? 1 : 0 });
      c.px(fx + ox * 0.5, ny + 0.6 + len, LK.tip ?? LK.plate, { x: 0, y: -0.3, z: 0.95 });
    }
    c.part();
    c.px(nx, ny, LK.gem ?? LK.guard, { x: -0.3, y: 0.4, z: 0.86 });
  }
  if (glow > 0) {
    // Light running up the head, and sparks off the shaft.
    for (let t = neck; t < end; t += 1.2) {
      c.spark(s.hx + dx * t + px * 1.6, s.hy + dy * t + py * 1.6, LK.glow.hot, glow * 0.5);
      c.spark(s.hx + dx * t - px * 1.6, s.hy + dy * t - py * 1.6, LK.glow.mid, glow * 0.45);
    }
    for (let t = SPEAR_BUTT + 2; t < neck; t += 3) c.spark(s.hx + dx * t + px * (t % 2 ? 1.2 : -1.2), s.hy + dy * t + py * (t % 2 ? 1.2 : -1.2), LK.glow.mid, glow * 0.35);
    c.spark(tip.x, tip.y, LK.glow.core, glow);
  }
  return tip;
}

// ---------------------------------------------------------------------------
// The Valkyrie: wings, the winged helm and braids

/**
 * A great wing rooted at (rx, ry): a leading edge sweeping out and up to the
 * wrist, and six long feathers fanning from it, from hanging down by the body
 * to reaching out past the wrist. `k` is the side it spreads to (-1 left),
 * `flap` raises it, `size` shrinks the far wing seen from the side.
 */
function wing(c: PixelCanvas, rx: number, ry: number, k: number, flap: number, size = 1, bias = 0, spread = 0, ruffle = 0): void {
  if (LK.swan) {
    swanWing(c, rx, ry, k, flap, size, bias, spread, ruffle);
    return;
  }
  const m = LK.wing ?? LK.cloth;
  size *= 0.85;
  // The swan's wings spread wide and level; the Stormwing's are raised high in
  // a V, fewer and longer feathers sweeping up to sharp points.
  const storm = !!LK.storm;
  // `spread` (the idle moment's stretch and fold) carries the wrist out and up
  // and opens the fan wider, or draws it in close.
  const wx = rx + k * (storm ? 3.2 - flap * 0.2 : 5.4 - flap * 0.3 + spread * 1.4) * size;
  const wy = ry - (storm ? 10.5 + flap * 1.2 : 7.6 + flap * 1.6 + spread * 1.2) * size;
  const n = storm ? 5 : 6;
  const bases: { x: number; y: number }[] = [];
  const tips: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const bx = rx + (wx - rx) * t;
    const by = ry + (wy - ry) * t;
    // From hanging down (0) round to reaching out and a little up (~95
    // degrees); the storm's from out and down round to high overhead.
    const a = (storm ? 28 + t * (120 + flap * 5) : 6 + spread * 14 + t * (82 + flap * 6 + spread * 30)) * RAD;
    const len = (storm ? 7 + t * 5.5 : 6.4 + t * 4.2) * size * (1 + spread * 0.12);
    bases.push({ x: bx, y: by });
    // A ruffle shakes alternate feathers up and down.
    tips.push({ x: bx + k * Math.sin(a) * len, y: by + Math.cos(a) * len + (i % 2 ? ruffle : -ruffle) });
  }
  // The web of the wing under the feathers, in shade, so it reads as one wing and not a comb.
  c.part();
  for (let i = 0; i < n - 1; i++) {
    const q = [bases[i], tips[i], tips[i + 1], bases[i + 1]];
    fillQuad(c, q, m, { x: k * 0.3, y: -0.2, z: 0.93 }, bias - 1);
  }
  // Then the long feathers over it, each a lighter ridge.
  for (let i = 0; i < n; i++) {
    c.part();
    c.capsule(bases[i].x, bases[i].y, tips[i].x, tips[i].y, 1.1 * size, storm ? 0.3 : 0.5, m, { bias: bias + (i % 2 ? 1 : 0) });
  }
  // Coverts over the feathers' roots, lit along the leading edge.
  c.part();
  c.capsule(rx, ry, wx, wy, 1.7 * size, 1.1 * size, m, { bias: bias + 1 });
  c.capsule(rx + (wx - rx) * 0.2, ry + (wy - ry) * 0.2 + 1.2, rx + (wx - rx) * 0.75, ry + (wy - ry) * 0.75 + 1.4, 1.3 * size, 0.9 * size, m, { bias });
  if (LK.storm) {
    // Lightning playing along the feather tips and the leading edge.
    tips.forEach((p, i) => c.spark(p.x, p.y, i % 2 ? LK.glow.hot : LK.glow.mid, 0.55));
    for (let t = 0.15; t < 1; t += 0.3) c.spark(rx + (wx - rx) * t, ry + (wy - ry) * t - 1.2, LK.glow.core, 0.4);
  }
}

/** Fill a four-cornered shape (corners in order), pixel centres inside it. */
function fillQuad(c: PixelCanvas, q: { x: number; y: number }[], m: Material, n: Vec3, bias: number): void {
  const inTri = (px: number, py: number, a: { x: number; y: number }, b: { x: number; y: number }, d: { x: number; y: number }) => {
    const s1 = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x);
    const s2 = (d.x - b.x) * (py - b.y) - (d.y - b.y) * (px - b.x);
    const s3 = (a.x - d.x) * (py - d.y) - (a.y - d.y) * (px - d.x);
    return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
  };
  const xs = q.map((p) => p.x);
  const ys = q.map((p) => p.y);
  each(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), (x, y) => {
    const px = x + 0.5;
    const py = y + 0.5;
    if (inTri(px, py, q[0], q[1], q[2]) || inTri(px, py, q[0], q[2], q[3])) c.px(x, y, m, n, { bias });
  });
}

/** How far the wings are raised: up while the spear kindles, beating as she walks, swept back in a lunge. */
function flapOf(p: Pose): number {
  return (p.glow >= 0.3 ? 2 : 0) + p.lift - (p.lean > 0 ? 1 : 0) - p.breath * 0.5 + (p.wingLift ?? 0);
}

/** A little wing on the helm, three feathers rising from (x, y) to the side `k`. */
function helmWing(c: PixelCanvas, x: number, y: number, k: number, size = 1, bias = 0): void {
  const m = LK.wing ?? LK.plate;
  c.part();
  for (const [ox, oy, r] of [[2.8, -5.2, 0.7], [3.4, -3.4, 0.65], [3.2, -1.6, 0.6]] as const) {
    c.capsule(x, y, x + k * ox * size, y + oy * size, r + 0.2, 0.35, m, { bias: bias + 1 });
  }
}

/**
 * The Stormwing's crest: a bolt of lightning standing up along the helm. Seen
 * from the front or back it rises from the crown; from the side (facing left)
 * it lies along the helm from brow to nape.
 */
function stormCrest(c: PixelCanvas, x: number, U: number, side: boolean): void {
  const pts: [number, number][] = side
    ? [[x - 3.4, 5.6], [x - 1.4, 3.2], [x + 0.2, 4.6], [x + 2.4, 2.2], [x + 4.4, 4.2]]
    : [[x, 5.8], [x + 1.3, 3.9], [x - 0.7, 2.7], [x + 0.8, 0.8]];
  c.part();
  for (let i = 0; i < pts.length - 1; i++) {
    const r0 = 0.95 - (i / pts.length) * 0.4;
    c.capsule(pts[i][0], pts[i][1] + U, pts[i + 1][0], pts[i + 1][1] + U, r0, r0 - 0.15, LK.trim, { bias: 1, glow: 0.25 });
  }
  const [tx, ty] = pts[pts.length - 1];
  c.spark(tx, ty + U, LK.glow.core, 0.8);
  pts.forEach(([px, py], i) => i > 0 && c.spark(px, py + U, LK.glow.hot, 0.45));
}

/** A loose mane of hair falling from under the helm, rows y0..y1 between `edges`, strands shaded through it. */
function mane(c: PixelCanvas, y0: number, y1: number, edges: (u: number) => [number, number]): void {
  const m = LK.hair ?? LK.plume;
  c.part();
  c.shape(Math.round(y0), Math.round(y1), (y) => edges((y - y0) / Math.max(1, y1 - y0)), m, (_x, _y, t, u) => cyl(t * 0.9, 0.3 - u * 0.4));
  for (let y = Math.round(y0) + 1; y <= Math.round(y1); y++) {
    const [l, r] = edges((y - y0) / Math.max(1, y1 - y0));
    for (let x = Math.round(l) + 1; x < Math.round(r) - 1; x += 2) c.shade(x + (y & 1), y, -1);
  }
}

/** A ring of sunlight behind the head (x, y), with short rays. */
function sunHalo(c: PixelCanvas, x: number, y: number): void {
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    c.spark(x + Math.cos(a) * 6.8, y + Math.sin(a) * 6.8, i % 2 ? LK.glow.hot : LK.glow.mid, 0.55);
    if (i % 4 === 0) c.spark(x + Math.cos(a) * 8.3, y + Math.sin(a) * 8.3, LK.glow.core, 0.5);
  }
}

/** A braid of hair from (x, y0) down to y1, its plaits shaded in turn, bound in gold at the end. */
function braid(c: PixelCanvas, x: number, y0: number, y1: number, sway = 0): void {
  const m = LK.hair ?? LK.plume;
  c.part();
  for (let y = Math.round(y0); y <= Math.round(y1); y++) {
    const u = (y - y0) / Math.max(1, y1 - y0);
    const bx = x + sway * u * u;
    const k = (y & 1) ? 1 : -1;
    c.px(bx - (k > 0 ? 1 : 0), y, m, cyl(k * 0.5, 0.2), { bias: k > 0 ? 1 : 0 });
    if (u < 0.8) c.px(bx - (k > 0 ? 0 : 1), y, m, cyl(-k * 0.3, 0.1), { bias: -1 });
  }
  c.part();
  c.px(x + sway - 0.5, Math.round(y1) + 1, LK.trim, { x: -0.3, y: 0.3, z: 0.9 }, { bias: 1 });
}

// ---------------------------------------------------------------------------
// The Swan Maiden: swan wings, a bare head under a diadem, a bodice and skirt

/** Flight feathers in a swan wing, from the one hanging by her side to the outermost primary. */
const SWAN_FEATHERS = 9;
/** How far up the leading edge bows between shoulder and wrist, the swan's arch. */
const SWAN_ARCH = 1.3;
/** How much of each flight feather, from its tip, is silver-blue. */
const SWAN_TIP_LEN = 0.38;

/**
 * A swan's wing, rooted at (rx, ry) like `wing`: a long arched leading edge,
 * nine flight feathers growing longer toward the wrist with silver-blue tips,
 * a row of coverts laid over their roots and a thick row of small coverts
 * along the edge, each row its own layer so the feathers read in tiers.
 */
function swanWing(c: PixelCanvas, rx: number, ry: number, k: number, flap: number, size: number, bias: number, spread: number, ruffle: number): void {
  const m = LK.wing ?? LK.cloth;
  const tipM = LK.tip ?? m;
  size *= 0.92;
  const wx = rx + k * (6 - flap * 0.3 + spread * 1.4) * size;
  const wy = ry - (8.2 + flap * 1.6 + spread * 1.2) * size;
  const along = (t: number) => ({ x: rx + (wx - rx) * t, y: ry + (wy - ry) * t - Math.sin(t * Math.PI) * SWAN_ARCH * size });
  const n = SWAN_FEATHERS;
  const bases: { x: number; y: number }[] = [];
  const tips: { x: number; y: number }[] = [];
  const angles: number[] = [];
  const lens: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const b = along(t * 0.96);
    const a = (24 + spread * 14 + t * (74 + flap * 6 + spread * 30)) * RAD;
    const len = (5.6 + t * t * 6.4) * size * (1 + spread * 0.12);
    bases.push(b);
    angles.push(a);
    lens.push(len);
    tips.push({ x: b.x + k * Math.sin(a) * len, y: b.y + Math.cos(a) * len + (i % 2 ? ruffle : -ruffle) });
  }
  // The web under the feathers, in shade.
  c.part();
  for (let i = 0; i < n - 1; i++) fillQuad(c, [bases[i], tips[i], tips[i + 1], bases[i + 1]], m, { x: k * 0.3, y: -0.2, z: 0.93 }, bias - 1);
  // The flight feathers, inner ones over outer so the trailing edge scallops, each tipped in silver-blue.
  for (let i = n - 1; i >= 0; i--) {
    const b = bases[i];
    const p = tips[i];
    const f = 1 - SWAN_TIP_LEN;
    const fb = bias + (i % 2 ? 0 : 1);
    c.part();
    c.capsule(b.x, b.y, p.x, p.y, 1.2 * size, 0.55, m, { bias: fb });
    c.capsule(b.x + (p.x - b.x) * f, b.y + (p.y - b.y) * f, p.x, p.y, 0.95 * size, 0.5, tipM, { bias: fb });
  }
  // Coverts over the feathers' roots: shorter, laid a little closer.
  for (let i = n - 2; i >= 0; i -= 1) {
    const b = along((i / (n - 1)) * 0.9);
    const a = angles[i] - 8 * RAD;
    const len = lens[i] * 0.52;
    c.part();
    c.capsule(b.x, b.y, b.x + k * Math.sin(a) * len, b.y + Math.cos(a) * len, 1.3 * size, 0.75, m, { bias: bias + 1 + (i % 2 ? 0 : 1) });
  }
  // The small coverts thick along the arched edge, lit along the top.
  const mid = along(0.5);
  const near = along(0.12);
  const far = along(0.85);
  c.part();
  c.capsule(rx, ry, mid.x, mid.y, 1.8 * size, 1.5 * size, m, { bias: bias + 2 });
  c.capsule(mid.x, mid.y, wx, wy, 1.5 * size, 1.0 * size, m, { bias: bias + 2 });
  c.part();
  c.capsule(near.x, near.y + 1.6 * size, far.x, far.y + 1.5 * size, 1.25 * size, 0.85 * size, m, { bias: bias + 1 });
}

/** Strands drawn down a mass of hair already laid between `edges`: a dark line every other column, offset by row. */
function strands(c: PixelCanvas, y0: number, y1: number, edges: (y: number) => [number, number]): void {
  for (let y = Math.round(y0) + 1; y <= Math.round(y1); y++) {
    const [l, r] = edges(y);
    for (let x = Math.round(l) + 1; x < Math.round(r) - 1; x += 2) c.shade(x + ((y >> 1) & 1), y, -1);
  }
}

/** Her loose hair falling behind her shoulders, seen from the front: it frames her neck either side. */
function swanHairBehind(c: PixelCanvas, cx: number, U: number, sway: number): void {
  const m = LK.hair ?? LK.plume;
  const y0 = 10 + U;
  const y1 = 20 + U;
  const edges = (y: number): [number, number] => {
    const u = (y - y0) / (y1 - y0);
    const hw = 4.6 + Math.sin(Math.min(1, u * 1.6) * Math.PI * 0.5) * 0.9 - Math.max(0, u - 0.7) * 2;
    const x = cx + sway * u * u * 0.4;
    return [x - hw, x + hw];
  };
  c.part();
  c.shape(y0, y1, edges, m, (_x, _y, t, u) => cyl(t * 0.8, 0.2 - u * 0.3), { bias: -1 });
  strands(c, y0, y1, edges);
}

/** The diadem's pearl, glowing a little. */
function pearl(c: PixelCanvas, x: number, y: number): void {
  c.px(x, y, LK.gem ?? LK.trim, { x: -0.35, y: 0.4, z: 0.85 }, { bias: 1 });
}

/** A single swan feather standing from the diadem at (x, y), curving out to the side `k` and up. */
function diademFeather(c: PixelCanvas, x: number, y: number, k: number, sway = 0): void {
  const m = LK.wing ?? LK.plate;
  const mx = x + k * 1.4;
  const my = y - 2.4;
  const tx = x + k * 2.6 + sway * 0.4;
  const ty = y - 4.6;
  c.part();
  c.capsule(x, y, mx, my, 0.5, 0.7, m, { bias: 1 });
  c.capsule(mx, my, tx, ty, 0.7, 0.35, m, { bias: 1 });
  // Its tip in silver-blue, and the quill as a fine shade down its middle.
  c.px(tx, ty, LK.tip ?? m, { x: k * 0.3, y: 0.5, z: 0.8 });
  c.shade(x + k * 0.6, y - 1.6, -1);
}

/** The Swan Maiden's head from the front: face, parted platinum hair, side locks, the diadem and its feather. */
function swanHeadDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const hair = LK.hair ?? LK.plume;
  c.part();
  c.ellipse(cx, 12.7 + U, 3.1, 2.8, LK.skin);
  c.part();
  c.px(11, 13 + U, LK.skin, sphere(-0.4, -0.3), { bias: 1 });
  c.px(12, 13 + U, LK.skin, sphere(0.35, -0.2));
  // Soft lips, the right half in shade.
  c.part();
  c.px(11, 14 + U, LK.lips ?? LK.skin, { x: -0.2, y: 0.3, z: 0.93 });
  c.px(12, 14 + U, LK.lips ?? LK.skin, { x: 0.3, y: 0.2, z: 0.93 }, { bias: -1 });
  c.part();
  const look = p.look ?? 0;
  if (p.blink) {
    c.px(10, 12 + U, LK.skin, FLAT_DOWN, { bias: -1 });
    c.px(13, 12 + U, LK.skin, FLAT_DOWN, { bias: -1 });
  } else {
    c.px(10, 12 + U + look, EYE);
    c.px(13, 12 + U + look, EYE);
  }
  // Lashes: the outer corners darkened.
  c.shade(9, 12 + U, -2);
  c.shade(14, 12 + U, -2);
  // The crown of her hair, parted in the middle.
  c.part();
  const top = 6 + U;
  const crown = (y: number): [number, number] => {
    const u = (y + 0.5 - top) / 5;
    const w = 1.8 + 2.7 * Math.sqrt(Math.min(1, u));
    return [cx - w, cx + w];
  };
  c.shape(top, 10 + U, crown, hair, (_x, _y, t, u) => sphere(t * 0.95, u * 1.2 - 0.9, 1));
  for (let y = top; y <= 8 + U; y++) c.shade(11, y, -1);
  // The fringe swept out from the parting, and locks falling past her cheeks.
  c.part();
  for (const [x, y] of [[8, 11], [9, 11], [10, 10], [13, 10], [14, 11], [15, 11], [9, 10], [14, 10]] as const) c.px(x, y + U, hair, sphere(x < cx ? -0.5 : 0.5, -0.2), { bias: x === 10 || x === 13 ? 1 : 0 });
  const lockL = (y: number): [number, number] => [7.5 - (y - 11 - U) * 0.1, 9.2];
  const lockR = (y: number): [number, number] => [14.8, 16.5 + (y - 11 - U) * 0.1];
  c.part();
  c.shape(11 + U, 16 + U, lockL, hair, (_x, _y, t) => cyl(t * 0.7 - 0.3, 0.1));
  c.shape(11 + U, 16 + U, lockR, hair, (_x, _y, t) => cyl(t * 0.7 + 0.3, 0.1));
  c.shade(8, 13 + U, -1);
  c.shade(15, 14 + U, -1);
  // The diadem: a slender silver band over her brow rising to a point, a pearl at its heart.
  c.part();
  c.shape(9 + U, 9 + U, () => [cx - 4.3, cx + 4.3], LK.trim, (_x, _y, t) => cyl(t, 0.2), { bias: 1 });
  c.px(11, 8 + U, LK.trim, { x: -0.3, y: 0.5, z: 0.8 }, { bias: 1 });
  c.px(12, 8 + U, LK.trim, { x: 0.3, y: 0.5, z: 0.8 });
  c.part();
  pearl(c, 11, 9 + U);
  c.px(12, 9 + U, LK.gem ?? LK.trim, { x: 0.3, y: 0.3, z: 0.9 });
  diademFeather(c, cx + 3.6, 8.6 + U, 1, p.plume);
}

/** The Swan Maiden's head from behind: the back of her hair under the diadem's band, falling into one long braid. */
function swanHeadUp(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const hair = LK.hair ?? LK.plume;
  diademFeather(c, cx - 3.6, 8.6 + U, -1, p.plume);
  c.part();
  c.ellipse(cx, 10.3 + U, 4.4, 4.3, hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.95, dy * 0.9 - 0.15, 1) });
  for (let y = 7; y <= 14; y++) for (let x = 9; x <= 15; x += 2) c.shade(x + ((y >> 1) & 1), y + U, -1);
  // The band, seen only where it rounds her temples.
  c.part();
  for (const x of [7, 8, 15, 16]) c.px(x, 9 + U, LK.trim, { x: x < cx ? -0.6 : 0.6, y: 0.2, z: 0.77 }, { bias: x === 7 ? 1 : 0 });
  // Her hair falls loose down her back, gathering into a braid below the shoulder blades.
  const y0 = 13 + U;
  const y1 = 20 + U;
  const fall = (y: number): [number, number] => {
    const u = (y - y0) / (y1 - y0);
    const hw = 3.9 - u * 2.6;
    const x = cx + p.cape * u * u * 0.4;
    return [x - hw, x + hw];
  };
  c.part();
  c.shape(y0, y1, fall, hair, (_x, _y, t, u) => cyl(t * 0.85, 0.2 - u * 0.3));
  strands(c, y0, y1, fall);
  braid(c, cx + 0.5 + p.cape * 0.4, y1, 27 + U, p.cape * 0.5);
}

/** The Swan Maiden's head in profile, facing left: hair over the back of her head, falling behind into a braid. */
function swanHeadSide(c: PixelCanvas, hx: number, U: number, p: Pose): void {
  const hair = LK.hair ?? LK.plume;
  // The hair down her back, behind everything else of the head.
  const y0 = 11 + U;
  const y1 = 19 + U;
  const fall = (y: number): [number, number] => {
    const u = (y - y0) / (y1 - y0);
    return [hx + 0.2 + u * 0.6, hx + 3.8 + u * 0.5 + p.cape * u * u * 0.8 - Math.max(0, u - 0.6) * 3];
  };
  c.part();
  c.shape(y0, y1, fall, hair, (_x, _y, t, u) => cyl(t * 0.8 + 0.2, 0.2 - u * 0.3), { bias: -1 });
  strands(c, y0, y1, fall);
  diademFeather(c, hx + 1.4, 8.4 + U, 1, p.plume);
  c.part();
  c.ellipse(hx - 1.2, 12.8 + U, 2.9, 2.7, LK.skin);
  c.part();
  c.px(hx - 5, 13 + U, LK.skin, sphere(-0.6, -0.2), { bias: 1 });
  c.px(hx - 4, 14 + U, LK.lips ?? LK.skin, { x: -0.4, y: 0.2, z: 0.9 });
  c.part();
  if (p.blink) c.px(hx - 3, 12 + U, LK.skin, FLAT_DOWN, { bias: -1 });
  else c.px(hx - 3, 12 + U, EYE);
  c.shade(hx - 2, 12 + U, -2);
  // The cap of her hair: over the crown, and down behind her cheek and ear.
  c.part();
  const top = 6 + U;
  c.shape(top, 14 + U, (y) => {
    const u = (y + 0.5 - top) / 8.6;
    const w = 4.3 * Math.sqrt(Math.max(0, 1 - Math.pow(u * 2 - 1.05, 2)));
    const l = y <= 10 + U ? hx - 0.3 - w : hx - 1.2;
    return [l, hx - 0.3 + w];
  }, hair, (_x, _y, t, u) => sphere(t * 0.9 + 0.1, u * 1.2 - 0.6, 1));
  for (let y = top + 1; y <= 13 + U; y++) for (let x = Math.round(hx); x <= hx + 3; x += 2) c.shade(x + ((y >> 1) & 1), y, -1);
  // A lock of fringe over her brow.
  c.part();
  c.px(hx - 4, 10 + U, hair, sphere(-0.6, -0.1), { bias: 1 });
  c.px(hx - 3, 10 + U, hair, sphere(-0.3, -0.2));
  // The diadem across her brow, its pearl at the front.
  c.part();
  c.shape(9 + U, 9 + U, () => [hx - 4.6, hx + 1.2], LK.trim, (_x, _y, t) => cyl(t * 0.6 - 0.3, 0.2), { bias: 1 });
  c.part();
  pearl(c, hx - 4, 9 + U);
  braid(c, hx + 2.6, 15 + U, 24 + U, p.cape * 0.6);
}

/** Her skirt of silk from the waist to just above her feet, flaring and swaying, folds running down it, hemmed in silver-blue. */
function swanSkirt(c: PixelCanvas, waist: number, hem: number, edges: (u: number) => [number, number], back = false): void {
  const e = (y: number) => edges((y + 0.5 - waist) / (hem + 1 - waist));
  c.part();
  c.shape(waist, hem, e, LK.cloth, (_x, _y, t, u) => cyl(t * 0.85, 0.15 - u * 0.35), { bias: back ? -1 : 0 });
  // Folds: a shaded crease with a lit ridge beside it, spreading as the skirt flares.
  for (let y = waist + 2; y <= hem; y++) {
    const [l, r] = e(y);
    for (const f of [0.24, 0.52, 0.8]) {
      const x = Math.round(l + (r - l) * f);
      c.shade(x, y, -1);
      if (y > waist + 3) c.shade(x + 1, y, 1);
    }
  }
  c.part();
  const [l, r] = e(hem + 1);
  c.shape(hem + 1, hem + 1, () => [l + 0.3, r - 0.3], LK.tip ?? LK.trim, (_x, _y, t) => cyl(t, -0.1));
}

/** Pearl tassets over her hips shaped like feathers, pointing down, centred on each x. */
function swanTassets(c: PixelCanvas, xs: number[], y0: number, k = 0): void {
  for (const x of xs) {
    c.part();
    c.shape(y0, y0 + 3, (y) => {
      const hw = 1.55 * (1 - (y - y0) / 4.2);
      return [x - hw, x + hw];
    }, LK.plate, (_x, _y, t, u) => sphere(t * 0.8 + k * 0.2, u * 0.9 - 0.4, 1));
    c.shade(Math.round(x - 0.5), y0 + 1, -1);
  }
}

/** A feathered shoulder cap: a small pearl plate, three white feathers fanned below it. */
function swanCap(c: PixelCanvas, x: number, y: number, rx: number, ry: number): void {
  const k = x < 12 ? -1 : 1;
  const m = LK.wing ?? LK.plate;
  c.part();
  for (let j = -1; j <= 1; j++) {
    const fx = x + j * 1.1;
    c.capsule(fx, y + 0.6, fx + k * 0.4 + j * 0.4, y + 2.9 - Math.abs(j) * 0.4, 0.75, 0.45, m, { bias: j === -k ? 0 : 1 });
  }
  c.part();
  c.ellipse(x, y, rx * 0.8, ry * 0.85, LK.plate, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.25, 0.95) });
  c.px(x - 0.5, y + ry * 0.85 - 0.6, LK.tip ?? LK.trim, { x: 0, y: -0.2, z: 0.98 });
}

/** Where the Swan Maiden's skirt ends, the row above its silver-blue hem (before the walk's lift). */
const SWAN_HEM = 28;

/** A fitted pearl bodice narrowing to a pointed basque waist, rows top..waist-1 between `edges`. */
function swanBodice(c: PixelCanvas, top: number, waist: number, edges: (u: number) => [number, number], lean = 0): void {
  c.part();
  c.shape(top, waist - 1, (y) => edges((y + 0.5 - top) / (waist - top)), LK.plate, (_x, _y, t, u) => sphere(t * 0.9 + lean, (u - 0.35) * 1.1, 1));
}

/** The Swan Maiden's body from the front: lake-blue skirt, pearl bodice with a sweetheart neckline, a brooch and feathered tassets. */
function swanBodyDown(c: PixelCanvas, cx: number, U: number, L: number, cape: number): void {
  const top = 15 + U;
  const waist = 22 + U;
  swanSkirt(c, waist, SWAN_HEM + L, (u) => {
    const hw = 3.5 + 2.7 * Math.pow(u, 0.9);
    const x = cx + cape * 0.5 * u * u;
    return [x - hw, x + hw];
  });
  swanBodice(c, top, waist, (u) => {
    const hw = 4.2 - 1.4 * u * u;
    return [cx - hw, cx + hw];
  });
  // The neckline dips at the middle, a moonlit pearl brooch just under it.
  c.part();
  c.px(11, top + 1, LK.skin, { x: -0.2, y: 0.3, z: 0.93 });
  c.px(12, top + 1, LK.skin, { x: 0.2, y: 0.3, z: 0.93 }, { bias: -1 });
  c.part();
  pearl(c, 11, top + 2);
  c.px(12, top + 2, LK.gem ?? LK.trim, { x: 0.3, y: 0.3, z: 0.9 });
  // Seams of silver-blue curving down from the bust to the waist's point.
  c.part();
  for (const [x, y] of [[9, 3], [9, 4], [10, 5], [14, 3], [14, 4], [13, 5]] as const) c.px(x, top + y, LK.belt, { x: x < cx ? -0.3 : 0.3, y: 0.2, z: 0.93 });
  // The pointed basque waist.
  c.part();
  c.shape(waist, waist, () => [cx - 3, cx + 3], LK.belt, (_x, _y, t) => cyl(t, 0.1));
  c.shape(waist + 1, waist + 1, () => [cx - 1, cx + 1], LK.belt, (_x, _y, t) => cyl(t, -0.2));
  swanTassets(c, [cx - 3.4, cx + 3.4], waist + 1);
}

/** The Swan Maiden's body from behind: skirt, the bodice laced up the back, tassets. */
function swanBodyUp(c: PixelCanvas, cx: number, U: number, L: number, cape: number): void {
  const top = 15 + U;
  const waist = 22 + U;
  swanSkirt(c, waist, SWAN_HEM + L, (u) => {
    const hw = 3.5 + 2.7 * Math.pow(u, 0.9);
    const x = cx + cape * u * u * 0.8;
    return [x - hw, x + hw];
  });
  swanBodice(c, top, waist, (u) => {
    const hw = 4.2 - 1.4 * u * u;
    return [cx - hw, cx + hw];
  });
  // Lacing crossing up her back.
  c.part();
  for (let y = top + 2; y < waist; y++) c.px(y & 1 ? 11 : 12, y, LK.belt, { x: 0, y: 0.2, z: 0.97 }, { bias: y & 1 ? 1 : 0 });
  c.part();
  c.shape(waist, waist, () => [cx - 3, cx + 3], LK.belt, (_x, _y, t) => cyl(t, 0.1));
  swanTassets(c, [cx - 3.4, cx + 3.4], waist + 1);
}

/** The Swan Maiden's body in profile, facing left: the skirt sweeping back, the bodice, a tasset at the hip. */
function swanBodySide(c: PixelCanvas, cx: number, hx: number, S: number, U: number, L: number, cape: number): void {
  const top = 15 + U;
  const waist = 22 + U;
  swanSkirt(c, waist, SWAN_HEM + L, (u) => [cx - 2.8 + S * 0.5 - u * 1.4, cx + 2.8 + u * 2.8 + cape * u * u * 0.9]);
  c.part();
  c.shape(top, waist - 1, (y) => {
    const u = (y + 0.5 - top) / (waist - top);
    const bust = y >= top + 1 && y <= top + 3 ? 0.7 : 0;
    return [hx - 2.6 - bust + u * 0.4, hx + 2.4 - u * 0.5];
  }, LK.plate, (_x, _y, t, u) => sphere(t * 0.9 - 0.1, (u - 0.35) * 1.1, 1));
  c.part();
  pearl(c, hx - 3, top + 2);
  c.part();
  c.shape(waist, waist, () => [hx - 2.4, hx + 2.1], LK.belt, (_x, _y, t) => cyl(t * 0.9 - 0.1, 0.1));
  c.px(hx - 2.6, waist + 1, LK.belt, { x: -0.4, y: -0.1, z: 0.9 });
  swanTassets(c, [hx - 0.6], waist + 1, -1);
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
  if (LK.swan) {
    swanCap(c, x, y, rx, ry);
    return;
  }
  if (LK.samurai) {
    sode(c, x, y, rx, ry);
    return;
  }
  if (LK.afonso) {
    // No plate: the hauberk's mail over the shoulder.
    c.part();
    c.ellipse(x, y + 0.3, rx * 0.8, ry, LK.mail, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.3, 0.95) });
    return;
  }
  if (LK.king) {
    // The ermine mantle over the shoulder.
    c.part();
    c.ellipse(x, y + 0.2, rx + 0.3, ry + 0.4, LK.ermine ?? LK.cloth, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.8 - 0.3, 1) });
    ermineTails(c, x - rx - 0.3, y - ry, x + rx + 0.3, y + ry + 0.6);
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
  if (LK.headless) {
    // A rusted rim along the lower edge, and a dent or two.
    c.part();
    const rim = Math.round(y + ry - 0.9);
    c.shape(rim, rim, () => [x - rx + 0.5, x + rx - 0.5], LK.trim, (_x, _y, t) => cyl(t * 0.9, -0.2));
    batter(c, x - rx, y - ry, x + rx, rim - 1);
  }
  if (LK.storm) {
    // A spike sweeping up and out from the shoulder.
    const k = x < 12 ? -1 : 1;
    c.part();
    c.capsule(x + k * 0.4, y - 0.6, x + k * 2.2, y - 3.6, 0.75, 0.25, LK.trim, { bias: 1 });
  }
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
  if (LK.headless) {
    // Torn to rags: no trim, the hem hanging in tongues.
    tatter(c, y0, y1, edges, m, (_x, _y, t, u) => cyl(t * 0.6, 0.2 - u * 0.3), bias);
    return;
  }
  c.shape(y0, y1, edges, m, (_x, _y, t, u) => cyl(t * 0.6, 0.2 - u * 0.3), { bias });
  if (trim) {
    c.part();
    const e = edges(y1 + 1);
    c.shape(y1 + 1, y1 + 1, () => e, LK.trim, (_x, _y, t) => cyl(t, -0.1));
  }
}

/** How far each column of a torn hem is ripped up, repeating from the cloth's left edge. */
const TATTER = [0, 2, 1, 3, 0, 1, 2, 0, 3, 1, 0, 2];

/** Like `c.shape`, but the bottom rows are torn into ragged tongues that move with the cloth. */
function tatter(c: PixelCanvas, y0: number, y1: number, edges: (y: number) => [number, number], m: Material, normal: NormalFn, bias = 0): void {
  for (let y = y0; y <= y1; y++) {
    const [l, r] = edges(y);
    const u = y1 === y0 ? 0 : (y - y0) / (y1 - y0);
    const xa = Math.round(l);
    for (let x = xa; x <= Math.round(r) - 1; x++) {
      if (y > y1 - TATTER[(x - xa) % TATTER.length]) continue;
      const t = r - l > 0.001 ? ((x + 0.5 - l) / (r - l)) * 2 - 1 : 0;
      c.px(x, y, m, normal(x, y, t, u), { bias });
    }
  }
}

/** Dents and rust eaten into the Headless Knight's plate, wherever plate was drawn in the box. */
function batter(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number): void {
  if (!LK.headless) return;
  c.part();
  each(x0, y0, x1, y1, (x, y) => {
    if (c.materialAt(x, y) !== LK.plate) return;
    const h = (((x * 13 + y * 7 + x * y * 3) % 17) + 17) % 17;
    if (h === 0 || h === 9) c.px(x, y, LK.trim, { x: -0.2, y: 0.2, z: 0.95 }, { bias: -1 });
    else if (h === 4) c.shade(x, y, -1);
  });
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

/** Steps the embers rising off the Headless Knight's lantern from frame to frame. */
const emberPhase = (p: Pose): number => p.plume * 2 + p.cape + p.breath + p.lift + Math.round(p.sword.angle / 45);

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
// The King: crown, beard, ermine; and Afonso's crowned helm, coif and kite shield

/** Black tail tips dotted through whatever ermine was drawn in the box. */
function ermineTails(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number): void {
  if (!LK.ermine) return;
  c.part();
  each(x0, y0, x1, y1, (x, y) => {
    if (c.materialAt(x, y) === LK.ermine && (((x * 3 + y * 5) % 7) + 7) % 7 === 0) c.px(x, y, ERMINE_TAIL, FLAT_DOWN);
  });
}

/** An ermine collar across the shoulders, rows y..y+1. */
function ermineCollar(c: PixelCanvas, l: number, r: number, y: number): void {
  c.part();
  c.shape(y, y + 1, () => [l, r], LK.ermine ?? LK.cloth, (_x, _y, t, u) => sphere(t * 0.8, u * 0.8 - 0.3, 1));
  ermineTails(c, l, y, r, y + 1);
}

/**
 * The King's crown, its band on rows by..by+1 round the head at cx: five
 * points, the middle one tallest, each tipped with a pearl of gold, and gems
 * set in the band's front (none are seen from behind).
 */
function crown(c: PixelCanvas, cx: number, by: number, view: 'front' | 'back'): void {
  c.part();
  c.shape(by, by + 1, () => [cx - 3.9, cx + 3.9], LK.trim, (_x, _y, t, u) => cyl(t, 0.25 - u * 0.4), { bias: 1 });
  for (const [dx, h] of [[-4, 2], [-2, 1], [-1, 3], [0, 3], [1, 1], [3, 2]] as const) {
    for (let i = 1; i <= h; i++) c.px(cx + dx, by - i, LK.trim, { x: dx < 0 ? -0.4 : 0.35, y: 0.4, z: 0.82 }, { bias: i === h ? 1 : 0 });
  }
  if (view === 'back') return;
  const gem = LK.gem ?? LK.trim;
  c.part();
  c.px(cx - 1, by + 1, gem, sphere(-0.4, -0.3), { bias: 1 });
  c.px(cx, by + 1, gem, sphere(0.3, -0.3));
  c.px(cx - 3, by + 1, gem, sphere(-0.5, 0));
  c.px(cx + 2, by + 1, gem, sphere(0.5, 0), { bias: -1 });
  c.spark(cx - 1, by + 1, LK.glow.hot, 0.25);
}

/** The crown in profile, facing left. */
function crownSide(c: PixelCanvas, hx: number, by: number): void {
  c.part();
  c.shape(by, by + 1, () => [hx - 4.3, hx + 2.9], LK.trim, (_x, _y, t, u) => cyl(t * 0.9 - 0.1, 0.25 - u * 0.4), { bias: 1 });
  for (const [dx, h] of [[-4, 2], [-2, 1], [-1, 3], [1, 1], [2, 2]] as const) {
    for (let i = 1; i <= h; i++) c.px(hx + dx, by - i, LK.trim, { x: -0.3, y: 0.4, z: 0.85 }, { bias: i === h ? 1 : 0 });
  }
  c.part();
  c.px(hx - 3, by + 1, LK.gem ?? LK.trim, sphere(-0.5, -0.3), { bias: 1 });
  c.spark(hx - 3, by + 1, LK.glow.hot, 0.25);
}

/** A beard under the face at cx, from row y0: full and rounded, or Afonso's, long and pointed. */
function beardFront(c: PixelCanvas, cx: number, y0: number): void {
  const rows = LK.afonso ? [3.2, 3.1, 2.8, 2.3, 1.7, 1.0] : [3.3, 3.1, 2.5, 1.6];
  const y1 = y0 + rows.length - 1;
  c.part();
  c.shape(y0, y1, (y) => [cx - rows[y - y0], cx + rows[y - y0]], LK.beard ?? LK.plume, (_x, _y, t, u) => sphere(t * 0.85, u * 0.9 - 0.25, 1));
  // The mouth, and strands running down through it.
  c.shade(cx - 1, y0 + 1, -2);
  c.shade(cx, y0 + 1, -2);
  for (let y = y0 + 2; y <= y1; y++) {
    const hw = rows[y - y0];
    for (let x = Math.round(cx - hw) + 1; x < cx + hw - 1; x += 2) c.shade(x + (y & 1), y, -1);
  }
}

/** Widths of Afonso's conical helm, row by row from its point (row 3) to just above the rim. */
const CONE = [0.7, 1.3, 2.0, 2.7, 3.3, 3.8, 4.2, 4.5];

/** The conical helm seen from the front or back, centred on cx, ringed by the crown; a nose guard in front. */
function coneHelm(c: PixelCanvas, cx: number, U: number, front: boolean): void {
  c.part();
  c.shape(3 + U, 9 + U, (y) => [cx - CONE[y - 3 - U], cx + CONE[y - 3 - U]], LK.plate, (_x, _y, t, u) => sphere(t * 0.95, u * 1.1 - 0.9, 1));
  // A ridge up the middle, catching the light.
  for (let y = 4; y <= 7; y++) c.shade(cx - 1, y + U, 1);
  c.part();
  c.shape(10 + U, 10 + U, () => [cx - 4.7, cx + 4.7], LK.plate, (_x, _y, t) => cyl(t, -0.2), { bias: 1 });
  if (front) {
    c.part();
    for (let y = 11; y <= 13; y++) {
      c.px(cx - 1, y + U, LK.plate, { x: -0.3, y: 0.2, z: 0.93 }, { bias: 1 });
      c.px(cx, y + U, LK.plate, { x: 0.3, y: 0.2, z: 0.93 });
    }
  }
  // The crown round it: a gold band, fleurons standing up from it, a sapphire in front.
  c.part();
  c.shape(8 + U, 9 + U, (y) => [cx - CONE[y - 3 - U] - 0.35, cx + CONE[y - 3 - U] + 0.35], LK.trim, (_x, _y, t, u) => cyl(t, 0.2 - u * 0.4), { bias: 1 });
  for (const x of [cx - 4, cx + 3]) c.px(x, 7 + U, LK.trim, { x: x < cx ? -0.4 : 0.4, y: 0.5, z: 0.77 }, { bias: 1 });
  for (const x of [cx - 1, cx]) {
    c.px(x, 7 + U, LK.trim, { x: x < cx ? -0.3 : 0.3, y: 0.4, z: 0.86 });
    c.px(x, 6 + U, LK.trim, { x: x < cx ? -0.3 : 0.3, y: 0.5, z: 0.8 }, { bias: 1 });
  }
  if (!front) return;
  c.part();
  c.px(cx - 1, 9 + U, LK.gem ?? LK.trim, sphere(-0.4, -0.3), { bias: 1 });
  c.px(cx, 9 + U, LK.gem ?? LK.trim, sphere(0.3, -0.3));
  c.spark(cx - 1, 9 + U, LK.glow.hot, 0.25);
}

function kingHeadDown(c: PixelCanvas, cx: number, U: number, blink: boolean, look = 0): void {
  const hair = LK.hair ?? LK.plume;
  c.part();
  if (LK.afonso) {
    // The mail coif, round the face and down to the shoulders.
    c.ellipse(cx, 12.8 + U, 4.5, 4.4, LK.mail, { normal: (_x, _y, dx, dy) => sphere(dx * 0.95, dy * 0.9 - 0.1, 1) });
  } else {
    // Hair falling to the shoulders behind the face.
    c.shape(9 + U, 17 + U, (y) => {
      const u = (y - 9 - U) / 8;
      const hw = 3.9 + Math.min(1, u * 2) * 0.5 - Math.max(0, u - 0.6) * 2;
      return [cx - hw, cx + hw];
    }, hair, (_x, _y, t, u) => cyl(t * 0.9, 0.3 - u * 0.5), { bias: -1 });
  }
  c.part();
  c.ellipse(cx, 12.6 + U, 3.2, 2.8, LK.skin);
  c.part();
  c.px(cx - 1, 13 + U, LK.skin, sphere(-0.4, -0.3), { bias: 1 });
  c.px(cx, 13 + U, LK.skin, sphere(0.35, -0.2));
  c.part();
  if (blink) {
    c.px(cx - 2, 12 + U, LK.skin, FLAT_DOWN, { bias: -1 });
    c.px(cx + 1, 12 + U, LK.skin, FLAT_DOWN, { bias: -1 });
  } else {
    c.px(cx - 2, 12 + U + look, EYE);
    c.px(cx + 1, 12 + U + look, EYE);
  }
  beardFront(c, cx, 14 + U);
  if (LK.afonso) {
    coneHelm(c, cx, U, true);
    return;
  }
  // Hair over the brow under the crown, framing the face.
  c.part();
  c.shape(7 + U, 9 + U, (y) => {
    const hw = [2.9, 3.6, 3.8][y - 7 - U];
    return [cx - hw, cx + hw];
  }, hair, (_x, _y, t, u) => sphere(t * 0.9, u - 0.8, 1));
  c.shape(10 + U, 10 + U, () => [cx - 3.8, cx - 2.2], hair, (_x, _y, t) => cyl(t * 0.5 - 0.6, 0));
  c.shape(10 + U, 10 + U, () => [cx + 2.2, cx + 3.8], hair, (_x, _y, t) => cyl(t * 0.5 + 0.6, 0));
  crown(c, cx, 6 + U, 'front');
}

function kingHeadUp(c: PixelCanvas, cx: number, U: number, sway: number): void {
  if (LK.afonso) {
    c.part();
    c.ellipse(cx, 12.4 + U, 4.5, 4.4, LK.mail, { normal: (_x, _y, dx, dy) => sphere(dx * 0.95, dy * 0.9 - 0.1, 1) });
    coneHelm(c, cx, U, false);
    return;
  }
  // His hair from behind, falling to the shoulders, and the crown's back.
  const hair = LK.hair ?? LK.plume;
  c.part();
  c.ellipse(cx, 10.6 + U, 3.9, 3.9, hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.2, 1) });
  c.shape(12 + U, 17 + U, (y) => {
    const u = (y - 12 - U) / 5;
    const hw = 3.9 - u * 0.9;
    const x = cx + sway * u * 0.3;
    return [x - hw, x + hw];
  }, hair, (_x, _y, t, u) => cyl(t * 0.9, 0.2 - u * 0.4));
  // Locks of hair: a few darker partings running down it.
  for (let y = 11; y <= 17; y++) for (const x of [cx - 3, cx - 1, cx + 1]) c.shade(x + (y > 14 ? Math.round(sway * 0.3) : 0), y + U, -1);
  crown(c, cx, 6 + U, 'back');
}

/** Facing left. */
function kingHeadSide(c: PixelCanvas, hx: number, U: number, blink: boolean): void {
  c.part();
  if (LK.afonso) {
    c.ellipse(hx - 0.4, 12.6 + U, 4.0, 4.2, LK.mail, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.1, 1) });
  } else {
    // Hair behind the face and down over the nape.
    c.shape(8 + U, 16 + U, (y) => {
      const u = (y - 8 - U) / 8;
      return [hx - 1.5 + u, hx + 3.4 - Math.max(0, u - 0.7) * 2];
    }, LK.hair ?? LK.plume, (_x, _y, t, u) => cyl(t * 0.8 + 0.2, 0.3 - u * 0.5));
  }
  c.part();
  c.ellipse(hx - 1.2, 12.8 + U, 2.9, 2.7, LK.skin);
  c.part();
  c.px(hx - 5, 13 + U, LK.skin, sphere(-0.6, -0.2), { bias: 1 });
  c.part();
  if (blink) c.px(hx - 3, 12 + U, LK.skin, FLAT_DOWN, { bias: -1 });
  else c.px(hx - 3, 12 + U, EYE);
  // The beard, jutting under the jaw.
  const rows: [number, number][] = LK.afonso
    ? [[-4.6, -0.2], [-4.6, -0.6], [-4.4, -1.2], [-4.0, -1.8], [-3.6, -2.4], [-3.2, -2.8]]
    : [[-4.6, -0.2], [-4.5, -0.8], [-4.2, -1.5], [-3.7, -2.3]];
  c.part();
  c.shape(14 + U, 13 + U + rows.length, (y) => {
    const [l, r] = rows[y - 14 - U];
    return [hx + l, hx + r];
  }, LK.beard ?? LK.plume, (_x, _y, t, u) => sphere(t * 0.8 - 0.1, u * 0.9 - 0.25, 1));
  c.shade(hx - 4, 15 + U, -2);
  for (let y = 16; y < 14 + rows.length; y++) c.shade(hx - 3 + (y & 1), y + U, -1);
  if (LK.afonso) {
    // The conical helm in profile, its nose guard down the front of the face.
    const mid = hx - 0.6;
    c.part();
    c.shape(3 + U, 9 + U, (y) => [mid - CONE[y - 3 - U], mid + CONE[y - 3 - U]], LK.plate, (_x, _y, t, u) => sphere(t * 0.9 - 0.1, u * 1.1 - 0.9, 1));
    c.part();
    c.shape(10 + U, 10 + U, () => [hx - 5.2, hx + 4.0], LK.plate, (_x, _y, t) => cyl(t, -0.2), { bias: 1 });
    for (let y = 11; y <= 13; y++) c.px(hx - 5, y + U, LK.plate, { x: -0.6, y: 0.2, z: 0.77 }, { bias: 1 });
    c.part();
    c.shape(8 + U, 9 + U, (y) => [mid - CONE[y - 3 - U] - 0.35, mid + CONE[y - 3 - U] + 0.35], LK.trim, (_x, _y, t, u) => cyl(t * 0.9 - 0.1, 0.2 - u * 0.4), { bias: 1 });
    for (const x of [hx - 5, hx - 2, hx + 3]) c.px(x, 7 + U, LK.trim, { x: -0.3, y: 0.5, z: 0.8 }, { bias: 1 });
    c.px(hx - 2, 6 + U, LK.trim, { x: -0.3, y: 0.5, z: 0.8 }, { bias: 1 });
    c.part();
    c.px(hx - 4, 9 + U, LK.gem ?? LK.trim, sphere(-0.5, -0.3), { bias: 1 });
    c.spark(hx - 4, 9 + U, LK.glow.hot, 0.25);
    return;
  }
  // Hair over the crown of the head, then the crown.
  c.part();
  c.shape(7 + U, 9 + U, (y) => {
    const [l, r] = ([[-3.2, 2.4], [-3.9, 3.0], [-4.1, 3.3]] as const)[y - 7 - U];
    return [hx + l, hx + r];
  }, LK.hair ?? LK.plume, (_x, _y, t, u) => sphere(t * 0.9 - 0.1, u - 0.8, 1));
  crownSide(c, hx, 6 + U);
}

/** A kite shield on the arm, centred at (x, y): its white face with the blue cross, or its back, rimmed in iron. */
function kite(c: PixelCanvas, x: number, y: number, face: boolean): void {
  const y0 = Math.round(y - 3.5);
  const y1 = Math.round(y + 5.5);
  const edges = (yy: number): [number, number] => {
    const u = (yy + 0.5 - y0) / (y1 + 1 - y0);
    const hw = u < 0.1 ? 2.9 : u < 0.45 ? 3.2 : 3.2 * (1 - (u - 0.45) / 0.55) + 0.35;
    return [x - hw, x + hw];
  };
  c.part();
  c.shape(y0, y1, edges, LK.plate, (_x, _y, t, u) => sphere(t * 0.7, u * 0.6 - 0.3, 1), { bias: face ? 0 : -1 });
  c.part();
  c.shape(y0 + 1, y1 - 1, (yy) => {
    const [l, r] = edges(yy);
    return r - l > 1.8 ? [l + 0.8, r - 0.8] : null;
  }, face ? (LK.surcoat ?? LK.cloth) : LEATHER, (_x, _y, t, u) => sphere(t * 0.6, u * 0.5 - 0.2, 1), { bias: face ? 0 : -1 });
  if (!face) {
    c.part();
    c.shape(Math.round(y), Math.round(y), () => [x - 2, x + 2], BOOT, (_x, _y, t) => cyl(t, 0.1), { bias: -1 });
    return;
  }
  // The blue cross of his banner.
  c.part();
  const vx = Math.floor(x);
  for (let yy = y0 + 1; yy <= y1 - 2; yy++) c.px(vx, yy, LK.cloth, { x: -0.1, y: 0.3, z: 0.95 });
  for (let xx = vx - 2; xx <= vx + 2; xx++) c.px(xx, y0 + 3, LK.cloth, { x: 0, y: 0.3, z: 0.95 });
}

/** The kite shield edge-on in profile (facing left), held up before the chest. */
function kiteSide(c: PixelCanvas, x: number, y: number): void {
  const y0 = Math.round(y - 4);
  const y1 = Math.round(y + 5);
  c.part();
  c.shape(y0, y1, (yy) => {
    const u = (yy - y0) / (y1 - y0);
    const w = u < 0.55 ? 1.9 : 1.9 * (1 - (u - 0.55) / 0.45) + 0.4;
    return [x - w * 0.5, x + w * 0.5 + 0.3];
  }, LK.plate, (_x, _y, t, u) => sphere(-0.6 + t * 0.3, u * 0.9 - 0.4, 0.8));
  // A sliver of its face toward us, white, crossed in blue.
  c.part();
  for (let yy = y0 + 1; yy <= y1 - 3; yy++) c.px(Math.floor(x - 1), yy, yy === y0 + 3 ? LK.cloth : (LK.surcoat ?? LK.cloth), { x: -0.8, y: 0.1, z: 0.6 }, { bias: 1 });
}

// ---------------------------------------------------------------------------
// Directions

function drawDown(c: PixelCanvas, p: Pose): WarriorMeta {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  let tip = { x: 0, y: 0 };
  const [shA, shB] = p.shrug ?? [0, 0];
  const sh = { x: 7.4, y: 16.8 + U + shA }; // sword shoulder (screen left)
  if (p.swordBehind) {
    tip = drawSword(c, p.sword, p.glow);
    arm(c, sh.x, sh.y, p.sword.hx, p.sword.hy, -1);
    glove(c, p.sword.hx, p.sword.hy);
  }

  if (LK.valkyrie) {
    // Her wings, spread behind her either side.
    const flap = flapOf(p);
    wing(c, cx - 3.2, 17.5 + U, -1, flap, 1, -1, p.spread ?? 0, p.ruffle ?? 0);
    wing(c, cx + 3.2, 17.5 + U, 1, flap, 1, -1, p.spread ?? 0, -(p.ruffle ?? 0));
    if (LK.swan) {
      if (p.head) c.offset(BODY_X + p.head.x, BODY_Y + p.head.y);
      swanHairBehind(c, cx, U, p.cape);
      if (p.head) c.offset(BODY_X, BODY_Y);
    }
  } else {
    // Cape lining, seen behind the shoulders and legs.
    const ct = 15 + U;
    const cb = 28 + L;
    const liningEdges = (y: number): [number, number] => {
      const u = (y + 0.5 - ct) / (cb + 1 - ct);
      const hw = 4.8 + 1.8 * u;
      const x = cx + p.cape * u * u;
      return [x - hw, x + hw];
    };
    c.part();
    if (LK.headless) tatter(c, ct, cb, liningEdges, LK.cloth, (_x, _y, t, u) => cyl(t, 0.2 - u * 0.3), -2);
    else c.shape(ct, cb, liningEdges, LK.cloth, (_x, _y, t, u) => cyl(t, 0.2 - u * 0.3), { bias: -2 });
  }

  leg(c, 9.9, 24 + L, 9.8, 28.4 - p.footA);
  leg(c, 14.1, 24 + L, 14.2, 28.4 - p.footB);
  boot(c, 9.6, 29.7 - p.footA);
  boot(c, 14.4, 29.7 - p.footB);

  if (LK.swan) swanBodyDown(c, cx, U, L, p.cape);
  else {
  // Breastplate, rounded so it catches the light at the upper left.
  const top = 15 + U;
  const waist = 22 + U;
  c.part();
  c.shape(top, waist - 1, (y) => {
    const u = (y + 0.5 - top) / (waist - top);
    const hw = 4.5 - 0.9 * u * u;
    return [cx - hw, cx + hw];
  }, LK.afonso ? LK.mail : LK.plate, (_x, _y, t, u) => sphere(t * 0.9, (u - 0.35) * 1.1, 1));
  if (LK.spartan) musclesFront(c, top);
  batter(c, cx - 5, top, cx + 5, waist - 1);

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
  // Afonso's surcoat is wide, over most of the hauberk.
  if (!LK.spartan && !LK.storm) cloth(c, LK.afonso ? top + 1 : top + 2, hem, (y) => {
    const u = Math.max(0, (y - waist) / (hem - waist));
    const hw = LK.afonso ? 3.3 + u * 0.5 : 1.7 + u * 0.4;
    const x = cx + p.cape * 0.4 * u * u;
    return [x - hw, x + hw];
  }, LK.surcoat ?? LK.cloth, true);
  if (LK.afonso) {
    // The blue cross on his breast.
    c.part();
    for (let y = top + 1; y < waist; y++) {
      c.px(cx - 1, y, LK.cloth, { x: -0.2, y: 0.2, z: 0.96 });
      c.px(cx, y, LK.cloth, { x: 0.2, y: 0.2, z: 0.96 });
    }
    for (let x = cx - 3; x <= cx + 2; x++) c.px(x, top + 3, LK.cloth, { x: (x - cx + 0.5) * 0.15, y: 0.25, z: 0.95 });
  }
  // Belt and buckle.
  c.part();
  c.shape(waist, waist, () => [cx - 3.9, cx + 3.9], LK.belt, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(11, waist, LK.trim, { x: -0.3, y: 0.3, z: 0.9 }, { bias: 1 });
  c.px(12, waist, LK.trim, { x: 0.2, y: 0.3, z: 0.9 });
  if (LK.storm) {
    // A rune of lightning burning on the bare breastplate.
    for (const [x, y, k] of [[12, 1, 1], [11, 2, 0.8], [12, 3, 1], [11, 4, 0.8], [12, 5, 0.6]] as const) c.spark(x, top + y, k > 0.9 ? LK.glow.core : LK.glow.hot, k * 0.8);
  }
  if (LK.king && !LK.afonso) {
    // A gold crown on the tabard.
    c.part();
    for (const x of [cx - 2, cx + 1]) c.px(x, 18 + U, LK.trim, { x: x < cx ? -0.4 : 0.3, y: 0.4, z: 0.82 }, { bias: 1 });
    for (let x = cx - 2; x <= cx + 1; x++) c.px(x, 19 + U, LK.trim, FLAT_DOWN);
  }
  // Crest on the tabard: a small gold chevron.
  if (!LK.spartan && !LK.storm && !LK.king) {
    c.part();
    c.px(11, 18 + U, LK.trim, { x: -0.4, y: 0.4, z: 0.8 }, { bias: 1 });
    c.px(12, 18 + U, LK.trim, { x: 0.3, y: 0.4, z: 0.85 });
    c.px(11, 19 + U, LK.trim, FLAT_DOWN, { bias: -1 });
    c.px(12, 19 + U, LK.trim, FLAT_DOWN, { bias: -1 });
  }
  }

  // Free arm (character's left, screen right).
  const fh = p.free ? { x: p.free.x, y: p.free.y + U } : { x: 17.6, y: 22.2 + U + p.arm };
  arm(c, 16.6, 16.8 + U + shB, fh.x, fh.y);
  glove(c, fh.x, fh.y);
  pauldron(c, 16.9, 16.3 + U + shB);
  if (LK.spartan) aspis(c, fh.x + 0.6, fh.y - 2.2, true);
  if (LK.afonso) kite(c, fh.x + 0.4, fh.y - 2.6, true);

  // Mail gorget between chin and breastplate (a bare neck under the Spartan's helm).
  c.part();
  c.shape(15 + U, 15 + U, () => [cx - 2.4, cx + 2.4], LK.spartan || LK.swan ? LK.skin : LK.mail, (_x, _y, t) => cyl(t, 0.2));
  if (LK.king && !LK.afonso) ermineCollar(c, cx - 4.8, cx + 4.8, 15 + U);
  // The idle moment may nudge the head (a tilt, a nod): drawn through a shifted canvas.
  const hd = p.head;
  if (hd) c.offset(BODY_X + hd.x, BODY_Y + hd.y);
  if (LK.headless) {
    lanternFront(c, cx, U, emberPhase(p));
  } else if (LK.spartan) {
    crestFront(c, cx, U, p.plume);
    corinthianFront(c, cx, U);
  } else if (LK.king) {
    kingHeadDown(c, cx, U, !!p.blink, p.look ?? 0);
  } else if (LK.swan) {
    swanHeadDown(c, cx, U, p);
  } else {
    // Head: face framed by the helmet's cheek guards, a plume on top.
    if (LK.valkyrie && LK.storm) {
      // Her mane falls either side of the face, over the shoulders.
      mane(c, 11 + U, 19 + U, (u) => [cx - 4.9 + u * 0.4 + p.cape * u * 0.4, cx - 2.2 - u * 0.2 + p.cape * u * 0.4]);
      mane(c, 11 + U, 19 + U, (u) => [cx + 2.2 + u * 0.2 + p.cape * u * 0.4, cx + 4.9 - u * 0.4 + p.cape * u * 0.4]);
    }
    if (LK.sun) sunHalo(c, cx, 8 + U);
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
      c.px(10, 12 + U + (p.look ?? 0), EYE);
      c.px(13, 12 + U + (p.look ?? 0), EYE);
    }
    if (LK.valkyrie && !LK.storm) {
      helmWing(c, cx - 4.2, 8.6 + U, -1);
      helmWing(c, cx + 4.2, 8.6 + U, 1);
    } else if (!LK.samurai && !LK.valkyrie) {
      plume(c, [
        [cx, 6 + U],
        [cx + p.plume * 0.4, 3.4 + U],
        [cx + p.plume, 1.8 + U],
      ], 1.7, 1.15);
    }
    dome(c, cx, 5 + U, 10 + U, 4.7);
    if (LK.valkyrie && LK.storm) {
      stormCrest(c, cx, U, false);
      // A nose guard down between the eyes.
      c.part();
      for (const [x, y] of [[11, 10], [12, 10], [11, 11], [12, 11], [11, 12]]) c.px(x, y + U, LK.plate, { x: x === 11 ? -0.3 : 0.3, y: 0.2, z: 0.93 }, { bias: 1 });
    }
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
  if (hd) c.offset(BODY_X, BODY_Y);

  // Sword arm (character's right, screen left).
  if (!p.swordBehind) {
    tip = drawSword(c, p.sword, p.glow);
    arm(c, sh.x, sh.y, p.sword.hx, p.sword.hy);
    glove(c, p.sword.hx, p.sword.hy);
  }
  pauldron(c, 7.1, 16.3 + U + shA);
  if (LK.valkyrie && !LK.storm) {
    // Her braids, falling from under the helm over her shoulders.
    if (hd) c.offset(BODY_X + hd.x, BODY_Y + hd.y);
    braid(c, cx - 3, 13 + U, (LK.swan ? 23 : 19) + U, p.cape * 0.5);
    braid(c, cx + 4, 13 + U, (LK.swan ? 23 : 19) + U, p.cape * 0.5);
    if (hd) c.offset(BODY_X, BODY_Y);
  }
  p.fx?.(c);
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
  if (LK.afonso) kite(c, fh.x - 0.4, fh.y - 2.6, false);

  leg(c, 9.9, 24 + L, 9.8, 28.4 - p.footB);
  leg(c, 14.1, 24 + L, 14.2, 28.4 - p.footA);
  boot(c, 9.6, 29.7 - p.footB);
  boot(c, 14.4, 29.7 - p.footA);

  // Backplate and mail skirt, mostly hidden by the cape.
  const top = 15 + U;
  const waist = 22 + U;
  const hem = 26 + L;
  if (LK.swan) swanBodyUp(c, cx, U, L, p.cape);
  else {
  c.part();
  c.shape(top, waist - 1, (y) => {
    const u = (y + 0.5 - top) / (waist - top);
    const hw = 4.5 - 0.9 * u * u;
    return [cx - hw, cx + hw];
  }, LK.afonso ? LK.mail : LK.plate, (_x, _y, t, u) => sphere(t * 0.9, (u - 0.35) * 1.1, 1));
  c.part();
  c.shape(waist, hem, (y) => {
    const u = (y + 0.5 - waist) / (hem + 1 - waist);
    const hw = 3.9 + 1.1 * u;
    return [cx - hw, cx + hw];
  }, LK.mail, (_x, _y, t, u) => cyl(t, 0.1 - u * 0.2));
  }

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
  if (LK.valkyrie) {
    // No cape: her wings spread from her shoulder blades, toward us.
    const flap = flapOf(p);
    wing(c, cx - 2.6, 17.5 + U, -1, flap);
    wing(c, cx + 2.6, 17.5 + U, 1, flap);
  } else {
    cloth(c, ct, cb, capeEdges, LK.cloth, true);
    for (let y = Math.round(ct + 5); y <= cb; y++) {
      const [l, r] = capeEdges(y);
      c.shade(Math.round(l + (r - l) * 0.3), y, -1);
      c.shade(Math.round(l + (r - l) * 0.68), y, -1);
    }
  }

  if (LK.headless) {
    lanternBack(c, cx, U, emberPhase(p));
  } else if (LK.king) {
    // The ermine collar over the cape's shoulders, then his head.
    if (!LK.afonso) ermineCollar(c, cx - 4.8, cx + 4.8, Math.round(ct));
    kingHeadUp(c, cx, U, p.cape);
  } else if (LK.swan) {
    swanHeadUp(c, cx, U, p);
  } else {
  // Helmet from behind, with a mail neck guard; the plume runs down its back.
  c.part();
  c.shape(13 + U, 15 + U, () => [cx - 3.4, cx + 3.4], LK.spartan || LK.swan ? LK.skin : LK.mail, (_x, _y, t) => cyl(t, 0));
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
  } else if (LK.valkyrie && LK.storm) {
    // The crest of lightning, and her mane loose down her back.
    stormCrest(c, cx, U, false);
    mane(c, 12 + U, 23 + U, (u) => [cx - 3.8 + u * 2.2 + p.cape * u * 0.6, cx + 3.8 - u * 2.2 + p.cape * u * 0.6]);
  } else if (LK.valkyrie) {
    // The helm's wings, and one long braid down her back.
    helmWing(c, cx - 4.2, 8.6 + U, -1);
    helmWing(c, cx + 4.2, 8.6 + U, 1);
    braid(c, cx, 13 + U, 22 + U, p.cape * 0.6);
    if (LK.sun) sunHalo(c, cx, 9 + U);
  } else {
    plume(c, [
      [cx, 5.2 + U],
      [cx + p.plume * 0.3, 8.5 + U],
      [cx + p.plume * 0.7, 11.5 + U],
      [cx + p.plume, 14.5 + U],
    ], 1.3, 0.8);
  }
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

  if (LK.valkyrie) {
    // Her wings sweep back from her shoulders, the far one a little higher and smaller.
    const flap = flapOf(p);
    wing(c, hx + 1.4, 16.6 + U, 1, flap + 0.6, 0.8, -2);
    wing(c, hx + 2.4, 17.6 + U, 1, flap, 1, -1);
  } else {
    // Cape streaming behind.
    const ct = 15 + U;
    const cb = 28 + L;
    const streamEdges = (y: number): [number, number] => {
      const u = Math.max(0, (y + 0.5 - ct) / (cb + 1 - ct));
      const l = hx + 1 - 1.6 * u - S * u;
      const r = hx + 3.4 + 2.6 * Math.pow(u, 1.2) + p.cape * u * u - S * u;
      return [l, r];
    };
    c.part();
    if (LK.headless) tatter(c, ct, cb + 1, streamEdges, LK.cloth, (_x, _y, t, u) => cyl(t * 0.8 + 0.15, 0.25 - u * 0.3), -1);
    else c.shape(ct, cb, streamEdges, LK.cloth, (_x, _y, t, u) => cyl(t * 0.8 + 0.15, 0.25 - u * 0.3), { bias: -1 });
    c.part();
    if (!LK.headless) {
      const u = 1;
      c.shape(cb + 1, cb + 1, () => [hx + 1 - 1.6 * u - S, hx + 3.4 + 2.6 + p.cape - S], LK.trim, (_x, _y, t) => cyl(t, -0.1), { bias: -1 });
    }
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

  if (LK.swan) swanBodySide(c, cx, hx, S, U, L, p.cape);
  else {
  // Breastplate in profile, chest pushed forward.
  const top = 15 + U;
  const waist = 22 + U;
  const hem = 26 + L;
  const torso = (y: number): [number, number] => {
    const chest = y >= top + 1 && y <= top + 3 ? 0.5 : 0;
    return [hx - 2.9 - chest, hx + 2.8];
  };
  c.part();
  c.shape(top, waist - 1, torso, LK.afonso ? LK.mail : LK.plate, (_x, _y, t, u) => sphere(t * 0.9 - 0.1, (u - 0.35) * 1.1, 1));
  batter(c, hx - 4, top, hx + 3, waist - 1);
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
  } else if (LK.storm) {
    c.spark(Math.round(hx - 2), top + 2, LK.glow.hot, 0.7);
    c.spark(Math.round(hx - 1), top + 3, LK.glow.core, 0.7);
    c.spark(Math.round(hx - 2), top + 4, LK.glow.hot, 0.6);
  } else {
    // Tabard front edge down chest and skirt (Afonso's wider surcoat, and an arm of its cross).
    const front = (y: number) => (y < waist ? torso(y) : skirt(y))[0];
    cloth(c, LK.afonso ? top + 1 : top + 2, hem, (y) => [front(y), front(y) + (LK.afonso ? 2.8 : 1.6)], LK.surcoat ?? LK.cloth, true);
    if (LK.afonso) {
      c.part();
      for (let x = Math.round(front(top + 3)); x <= Math.round(front(top + 3)) + 2; x++) c.px(x, top + 3, LK.cloth, { x: -0.4, y: 0.2, z: 0.9 });
    }
  }
  c.part();
  const [bl, br] = torso(waist - 1);
  c.shape(waist, waist, () => [bl - 0.1, br + 0.2], LK.belt, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(Math.round(bl), waist, LK.trim, { x: -0.5, y: 0.3, z: 0.8 }, { bias: 1 });
  }

  // The Spartan's shield, up before his chest.
  if (LK.spartan) aspisSide(c, hx - 4.4, 19.2 + U);
  if (LK.afonso) kiteSide(c, hx - 4.4, 19.4 + U);

  // Head: profile face under the helmet, cheek guard, plume streaming back.
  c.part();
  c.shape(15 + U, 15 + U, () => [hx - 2.2, hx + 1.6], LK.spartan || LK.swan ? LK.skin : LK.mail, (_x, _y, t) => cyl(t, 0.2));
  if (LK.king && !LK.afonso) ermineCollar(c, hx - 2.8, hx + 2.8, 15 + U);
  if (LK.headless) {
    lanternSide(c, hx, U, emberPhase(p));
  } else if (LK.spartan) {
    crestSide(c, hx, U, p.plume);
    corinthianSide(c, hx, U);
  } else if (LK.king) {
    kingHeadSide(c, hx, U, !!p.blink);
  } else if (LK.swan) {
    swanHeadSide(c, hx, U, p);
  } else {
    c.part();
    c.ellipse(hx - 1.2, 12.8 + U, 2.9, 2.7, LK.skin);
    c.part();
    c.px(hx - 5, 13 + U, LK.skin, sphere(-0.6, -0.2), { bias: 1 });
    c.shade(hx - 4, 14 + U, -1);
    c.part();
    if (p.blink) c.px(hx - 3, 12 + U, LK.skin, FLAT_DOWN, { bias: -1 });
    else c.px(hx - 3, 12 + U, EYE);
    if (LK.valkyrie && LK.storm) {
      // Her mane streaming back behind her.
      mane(c, 11 + U, 20 + U, (u) => [hx + 0.4 + u * 0.5, hx + 4.6 + u * 1.6 + p.cape * u * 1.2]);
    } else if (LK.valkyrie) {
      // The braid behind her neck, and the far wing of the helm peeking over it.
      if (LK.sun) sunHalo(c, hx + 0.5, 8 + U);
      braid(c, hx + 2, 13 + U, 21 + U, p.cape * 0.5);
      helmWing(c, hx + 1.6, 7.6 + U, 1, 0.75, -1);
    } else if (LK.samurai) {
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
    if (LK.valkyrie && LK.storm) {
      stormCrest(c, hx - 0.2, U, true);
      c.part();
      c.px(hx - 5, 11 + U, LK.plate, { x: -0.5, y: 0.2, z: 0.84 }, { bias: 1 });
      c.px(hx - 5, 12 + U, LK.plate, { x: -0.5, y: 0.1, z: 0.86 });
    } else if (LK.valkyrie) helmWing(c, hx + 0.4, 8.8 + U, 1);
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

/**
 * The King at rest: his greatsword planted point-down before him, both hands
 * on the pommel (Afonso keeps his shield arm at his side), as a statue stands.
 */
const PLANTED: Record<View, Sword & { behind?: boolean }> = {
  down: sw(12, 20, 180, 7.5),
  up: { ...sw(12, 20, 180, 7.5), behind: true },
  side: sw(8, 20, 180, 7.5),
};
const PLANTED_FREE: Record<View, { x: number; y: number }> = { down: { x: 13.2, y: 19.6 }, up: { x: 12, y: 19.8 }, side: { x: 8.6, y: 20.2 } };

function idle(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 8;
  for (let f = 0; f < N; f++) {
    const ph = (f / N) * Math.PI * 2;
    const p = base(view);
    if (LK.king) {
      const { behind, ...s } = PLANTED[view];
      p.sword = s;
      p.swordBehind = behind;
      if (!LK.afonso) p.free = { ...PLANTED_FREE[view] };
    }
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

/**
 * The King's finisher: the greatsword swung up over his head, then brought
 * down in one great chop that strikes the ground before him.
 */
function smite(view: View): Pose[] {
  const keys: Record<View, (Sword & { behind?: boolean })[]> = {
    down: [sw(8, 12, -30), { ...sw(9.5, 10.5, 8), behind: true }, sw(11.5, 23, 180, 11), sw(11.5, 24, 180, 11), sw(11, 23.5, 178), sw(6, 21, -10)],
    up: [sw(18.5, 12, 30), sw(15.5, 11, 172), { ...sw(13, 14, -2, 11), behind: true }, { ...sw(12.5, 13.5, 0, 11), behind: true }, { ...sw(13, 14.5, 0), behind: true }, sw(18.5, 21.5, 10)],
    side: [sw(13, 12, 40), sw(13.5, 11.5, 75), sw(5.5, 17.5, -115, 11), sw(5, 19.5, -140, 11), sw(5.5, 20, -145), sw(9, 22, -45)],
  };
  return keys[view].map((s, i) => {
    const p = base(view);
    p.sword = { hx: s.hx, hy: s.hy, angle: s.angle, len: s.len };
    p.swordBehind = s.behind;
    const down = i >= 2 && i <= 4;
    p.glow = i === 1 ? 0.35 : i === 2 ? 0.8 : i === 3 ? 0.5 : 0;
    p.breath = down ? 1 : 0;
    p.lift = i === 1 ? 1 : 0;
    p.cape = i === 1 ? -1 : down ? 2 : 0;
    p.plume = p.cape;
    if (view === 'side') {
      p.lean = i === 2 || i === 3 ? 1 : i === 1 ? -1 : 0;
      p.footA = down ? 2 : 0;
      p.footB = down ? -1 : 0;
      p.cape = down ? 3 : 1;
    } else {
      if (!LK.afonso) p.free = view === 'down' ? { x: 18.4, y: 20 } : { x: 18.6, y: 20.4 };
      if (down) p.footA = 1;
    }
    return p;
  });
}

/**
 * The King's Royal Decree: the greatsword raised high overhead, point to the
 * sky, blazing at the top, then lowered.
 */
function decree(view: View): Pose[] {
  const keys: Record<View, Sword[]> = {
    down: [sw(5.5, 15, -25), sw(6.5, 11.5, -6), sw(6.5, 11, -3), sw(6.5, 11, -3), sw(5.5, 15, -20)],
    up: [sw(18.5, 15, 25), sw(17.5, 11.5, 6), sw(17.5, 11, 3), sw(17.5, 11, 3), sw(18.5, 15, 20)],
    side: [sw(14, 14, 20), sw(14.5, 11.8, 8), sw(14.5, 11.5, 6), sw(14.5, 11.5, 6), sw(14, 14, 15)],
  };
  return keys[view].map((s, i) => {
    const p = base(view);
    p.sword = { ...s };
    p.glow = [0.3, 0.7, 1, 0.8, 0.35][i];
    p.lift = i === 2 ? 1 : 0;
    p.breath = i === 0 ? 1 : 0;
    p.cape = i >= 2 && i <= 3 ? 1 : 0;
    p.plume = -p.cape;
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

// ---------------------------------------------------------------------------
// The idle moment (`rest`): a short performance when the hero has stood still
// a while, drawn facing the viewer only. It starts and ends on the idle's
// first frame, so it swaps in and out without a pop. Each character has its
// own: the Knight plants his sword and rolls his shoulders, the King stamps
// his greatsword down and a glint runs up it to his crown, the Spearmaiden
// stretches her wings and shakes them out, and the Stormwing grounds her
// spear, looks to the sky and calls a spark down onto its point.

/** Steps a second: a little slower than a swing, so every hold reads. */
const REST_FPS = 8;
/** A glint of sunlight on steel: a white-hot point and short gold rays. */
const GLINT_CORE: RGB = [255, 252, 240];
const GLINT_RAY: RGB = [255, 226, 160];

/** A four-pointed twinkle at (x, y), its rays `ray` pixels long, a faint cross of diagonals between them when large. */
function twinkle(c: PixelCanvas, x: number, y: number, a: number, ray = 2, core = GLINT_CORE, hot = GLINT_RAY): void {
  c.spark(x, y, core, a);
  for (let i = 1; i <= ray; i++) {
    const k = a * (i === 1 ? 0.8 : i === 2 ? 0.45 : 0.25);
    c.spark(x + i, y, hot, k);
    c.spark(x - i, y, hot, k);
    c.spark(x, y + i, hot, k);
    c.spark(x, y - i, hot, k);
  }
  if (ray >= 2) for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) c.spark(x + dx, y + dy, hot, a * 0.3);
}

/** A point along a held blade or shaft, `along` pixels from the hand toward the tip. */
function alongBlade(s: Sword, along: number): { x: number; y: number } {
  const a = s.angle * RAD;
  return { x: s.hx + Math.sin(a) * along, y: s.hy - Math.cos(a) * along };
}

/** Where the King's crown (or Afonso's crowned helm) wears its centre gem, in body pixels, for a head drawn at U. */
const crownGem = (U: number): { x: number; y: number } => ({ x: 11, y: (LK.afonso ? 9 : 7) + U });

type RestKind = 'knight' | 'king' | 'spear' | 'storm';

const restKind = (look: WarriorLook): RestKind => (look.king ? 'king' : look.valkyrie ? (look.storm ? 'storm' : 'spear') : 'knight');

interface RestPlan {
  /** The frames drawn, by name, in the order they are keyed. */
  frames: Record<string, Pose>;
  /** The performance: frame names in play order, one per step. */
  steps: string[];
}

/** A copy of `from` with some things changed (the sword merged, not replaced). */
function vary(from: Pose, patch: Partial<Omit<Pose, 'sword'>> & { sword?: Partial<Sword> } = {}): Pose {
  const { sword, ...rest } = patch;
  return { ...from, free: from.free && { ...from.free }, ...rest, sword: { ...from.sword, ...sword } };
}

/**
 * The Knight: turns his sword out and round and plants it point-down before
 * him with a ring of steel, rests both hands on the pommel (the Spartan keeps
 * his shield at his side), rolls one shoulder then the other, breathes out,
 * and swings it back up to his side.
 */
function knightRest(): RestPlan {
  const stand = idle('down')[0];
  const shield = !!LK.spartan;
  const pommel = (y = 19.6) => (shield ? undefined : { x: 13.2, y });
  // Planted: the grip at the belt, the point in the ground just before his feet.
  const PLANT = { hx: 12, hy: 20, angle: 180, len: 9 };
  const planted = vary(stand, { sword: PLANT, free: pommel() });
  const tip = alongBlade(PLANT, BLADE_START + PLANT.len + 0.5);
  return {
    frames: {
      stand,
      // A small dip, the blade turning out, then swung round point-down.
      gather: vary(stand, { breath: 1, sword: { hx: 4.5, hy: 21, angle: -45 }, plume: -1 }),
      turn: vary(stand, { sword: { hx: 5.5, hy: 18, angle: -112, len: 10 }, cape: -1, plume: 1 }),
      poise: vary(stand, { sword: { hx: 10.5, hy: 18, angle: -166, len: 9.5 }, free: shield ? undefined : { x: 15.8, y: 20.6 }, plume: 1 }),
      // It bites into the ground with a ring; the cape swings on after him.
      plant: vary(planted, {
        breath: 1,
        sword: { hy: 20.5 },
        free: pommel(19.1),
        cape: 1,
        plume: -1,
        fx: (c) => {
          twinkle(c, tip.x, tip.y + 0.5, 0.9, 1);
          c.spark(tip.x - 2, tip.y + 1, GLINT_RAY, 0.3);
          c.spark(tip.x + 2, tip.y + 1, GLINT_RAY, 0.3);
        },
      }),
      planted,
      // One shoulder rolled up and back, head leaning off it; then the other.
      rollA: vary(planted, { shrug: [-1.5, 0.5], head: { x: 1, y: 0 }, sword: { hy: 19.5 }, plume: 1 }),
      rollB: vary(planted, { shrug: [0.5, -1.5], head: { x: -1, y: 0 }, free: pommel(19.1), plume: -1 }),
      // Both up with a breath in, then a long breath out, eyes shut.
      inhale: vary(planted, { breath: -1, shrug: [-0.5, -0.5], sword: { hy: 19.5 }, free: pommel(20.1) }),
      sigh: vary(planted, { breath: 1, blink: true, sword: { hy: 20.5 }, free: pommel(19.1), cape: 1 }),
      // Pulled free and swung back out and round to his side.
      draw: vary(stand, { sword: { hx: 11, hy: 18.5, angle: -170, len: 9.5 }, free: shield ? undefined : { x: 15.4, y: 20.8 }, plume: 1 }),
      swing: vary(stand, { sword: { hx: 5.5, hy: 18, angle: -100, len: 10 }, cape: -1, plume: 1 }),
      lower: vary(stand, { breath: 1, sword: { hx: 4.5, hy: 21, angle: -40 }, plume: -1 }),
    },
    steps: [
      'stand', 'gather', 'turn', 'poise', 'plant', 'plant', 'planted', 'planted', 'planted', 'planted',
      'rollA', 'rollA', 'rollA', 'inhale', 'rollB', 'rollB', 'rollB', 'planted', 'inhale', 'inhale',
      'sigh', 'sigh', 'sigh', 'sigh', 'planted', 'planted', 'planted', 'draw', 'swing', 'lower', 'stand',
    ],
  };
}

/**
 * The King: already at rest on his planted greatsword, he hefts it a hand's
 * breadth and stamps it down again, draws himself up, and a glint of light
 * runs up the blade from the point to the guard and on to his crown's jewel;
 * then a slow, satisfied nod.
 */
function kingRest(): RestPlan {
  const stand = idle('down')[0];
  const S0 = stand.sword;
  // His free hand rides with the pommel; Afonso's hangs at his side with the shield.
  const hand = (y: number, U: number) => (LK.afonso ? undefined : { x: 13.2, y: y - 0.4 - U });
  const at = (hy: number, U: number, patch: Partial<Pose> = {}) =>
    vary(stand, { ...patch, sword: { hy }, free: hand(hy, U) });
  const proud = at(S0.hy, -1, { breath: -1 });
  const blade = (along: number) => alongBlade(S0, along);
  const end = BLADE_START + S0.len + 1;
  const run = (along: number, a: number) => vary(proud, { fx: (c) => twinkle(c, blade(along).x, blade(along).y, a, 3) });
  const gem = crownGem(-1);
  return {
    frames: {
      stand,
      dip: at(S0.hy, 1, { breath: 1 }),
      heft: at(S0.hy - 2.5, -1, { breath: -1, cape: -1, plume: -1 }),
      stamp: at(S0.hy + 0.5, 1, {
        breath: 1,
        cape: 1,
        fx: (c) => {
          const t = blade(end);
          twinkle(c, t.x, t.y + 0.5, 0.8, 1);
          c.spark(t.x - 2, t.y + 1, GLINT_RAY, 0.35);
          c.spark(t.x + 2, t.y + 1, GLINT_RAY, 0.35);
        },
      }),
      proud,
      glintTip: run(end - 1.5, 0.8),
      glintMid: run(BLADE_START + S0.len * 0.5, 0.9),
      glintGuard: run(1.6, 1),
      jewel: vary(proud, { fx: (c) => twinkle(c, gem.x, gem.y, 1, 3) }),
      nod: at(S0.hy, 0, { head: { x: 0, y: 1 }, blink: true }),
    },
    steps: [
      'stand', 'dip', 'dip', 'heft', 'heft', 'stamp', 'stamp', 'proud', 'proud', 'proud',
      'glintTip', 'glintMid', 'glintGuard', 'jewel', 'jewel', 'jewel', 'proud', 'proud', 'proud',
      'nod', 'nod', 'nod', 'nod', 'nod', 'stand',
    ],
  };
}

/**
 * The Spearmaiden: grounds her spear, rises on her toes and stretches her
 * wings out wide and high, eyes shut, then folds them in close and shakes
 * them out, braids swinging, and settles.
 */
function spearRest(): RestPlan {
  const stand = idle('down')[0];
  const grounded = { hx: 5.5, hy: 23, angle: -5 };
  return {
    frames: {
      stand,
      ground: vary(stand, { breath: 1, sword: grounded, spread: -0.3 }),
      reach: vary(stand, { lift: 1, sword: { ...grounded, hy: 22 }, spread: 0.45, wingLift: 0.5, blink: true, cape: -1 }),
      stretch: vary(stand, { lift: 1, sword: { ...grounded, hy: 22 }, spread: 1, wingLift: 1, blink: true, head: { x: 0, y: -1 }, cape: -1 }),
      fold: vary(stand, { breath: 1, sword: { ...grounded, hy: 23.5 }, spread: -0.8, wingLift: -0.5, cape: 1 }),
      shakeA: vary(stand, { sword: grounded, spread: -0.5, ruffle: 1, head: { x: -1, y: 0 }, cape: -1 }),
      shakeB: vary(stand, { sword: grounded, spread: -0.5, ruffle: -1, head: { x: 1, y: 0 }, cape: 1 }),
      settle: vary(stand, { sword: grounded, spread: -0.15, blink: true }),
    },
    steps: [
      'stand', 'ground', 'ground', 'reach', 'stretch', 'stretch', 'stretch', 'stretch', 'stretch', 'stretch',
      'reach', 'fold', 'fold', 'shakeA', 'shakeB', 'shakeA', 'shakeB', 'fold', 'settle', 'settle', 'settle', 'stand',
    ],
  };
}

/**
 * The Stormwing: lifts her spear and strikes its butt on the ground, looks up
 * at the sky, and lightning crawls up the shaft to its point, where a bolt
 * cracks down from above and her wings flare; then it fades and she settles.
 */
function stormRest(): RestPlan {
  const stand = idle('down')[0];
  const held = { hx: 5.5, hy: 22.5, angle: -3 };
  const S1 = { ...stand.sword, ...held };
  const at = (t: number) => alongBlade(S1, t);
  const end = BLADE_START + S1.len + SPEAR_REACH;
  const gaze = vary(stand, { sword: held, look: -1, head: { x: 0, y: -1 }, wingLift: 1 });
  // Sparks crawling along the shaft between `from` and `to`, zigzagging either side of it.
  const crawl = (c: PixelCanvas, from: number, to: number, a: number) => {
    for (let t = from, i = 0; t < to; t += 1.5, i++) {
      const p = at(t);
      c.spark(p.x + (i % 2 ? 1 : -1), p.y, i % 2 ? LK.glow.hot : LK.glow.mid, a);
      c.spark(p.x, p.y - 0.5, LK.glow.core, a * 0.5);
    }
  };
  return {
    frames: {
      stand,
      heft: vary(stand, { sword: { ...held, hy: 20.5 }, wingLift: 0.5, cape: -1 }),
      strike: vary(stand, {
        breath: 1,
        sword: { ...held, hy: 23 },
        cape: 1,
        fx: (c) => {
          const b = at(SPEAR_BUTT + 0.5);
          c.spark(b.x, b.y + 1, LK.glow.core, 0.8);
          c.spark(b.x - 1, b.y + 1, LK.glow.hot, 0.5);
          c.spark(b.x + 1, b.y + 1, LK.glow.hot, 0.5);
          c.spark(b.x - 2, b.y, LK.glow.mid, 0.3);
          c.spark(b.x + 2, b.y + 1, LK.glow.mid, 0.3);
        },
      }),
      gaze,
      crawl: vary(gaze, { fx: (c) => crawl(c, SPEAR_BUTT + 1, 1, 0.6) }),
      climb: vary(gaze, { glow: 0.2, fx: (c) => crawl(c, -1, end - SPEAR_HEAD, 0.7) }),
      // The bolt: a jagged line from the sky to the point, and the point blazing.
      bolt: vary(gaze, {
        glow: 0.7,
        fx: (c) => {
          const tp = at(end);
          const pts = [[3, -9], [-1, -7], [2, -5], [-1, -3], [0, -1]];
          let [px, py] = [tp.x + 1, tp.y - 11];
          for (const [dx, dy] of pts) {
            const nx = tp.x + dx * 0.6;
            const ny = tp.y + dy;
            const n = Math.max(1, Math.round(Math.hypot(nx - px, ny - py)));
            for (let k = 0; k <= n; k++) c.spark(px + ((nx - px) * k) / n, py + ((ny - py) * k) / n, k % 2 ? LK.glow.hot : LK.glow.core, 1);
            [px, py] = [nx, ny];
          }
          twinkle(c, tp.x, tp.y, 1, 3, LK.glow.core, LK.glow.hot);
          crawl(c, SPEAR_BUTT + 1, end - SPEAR_HEAD, 0.4);
        },
      }),
      fade: vary(gaze, { glow: 0.15, look: 0, head: { x: 0, y: 0 }, fx: (c) => { const tp = at(end); c.spark(tp.x, tp.y, LK.glow.hot, 0.6); } }),
      settle: vary(stand, { breath: 1, sword: held, blink: true, wingLift: -0.5 }),
    },
    steps: [
      'stand', 'heft', 'strike', 'strike', 'gaze', 'gaze', 'gaze', 'gaze', 'crawl', 'climb', 'bolt', 'bolt', 'bolt',
      'fade', 'fade', 'fade', 'fade', 'settle', 'settle', 'settle', 'stand',
    ],
  };
}

const REST_PLANS: Record<RestKind, () => RestPlan> = { knight: knightRest, king: kingRest, spear: spearRest, storm: stormRest };

/** The idle moment's poses, facing the viewer only; other views have none. */
function rest(view: View): Pose[] {
  if (view !== 'down') return [];
  return Object.values(REST_PLANS[restKind(LK)]().frames);
}

/** The order the idle moment's frames play in, for a look (frame indices, holds repeated). */
function restOrder(look: WarriorLook): number[] {
  const prev = LK;
  LK = look;
  const plan = REST_PLANS[restKind(look)]();
  LK = prev;
  const names = Object.keys(plan.frames);
  return plan.steps.map((s) => names.indexOf(s));
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

export type WarriorAnim = 'idle' | 'walk' | 'slash1' | 'slash2' | 'thrust' | 'rise' | 'settle' | 'smite' | 'decree' | 'rest';

export interface WarriorAnimDef {
  name: WarriorAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => Pose[];
  /** true: drawn only for the King's looks; false: for every look but his. */
  king?: boolean;
  /** Frame indices to play in order, holds repeated (the idle moment's). */
  order?: readonly number[];
}

export const WARRIOR_ANIMS: WarriorAnimDef[] = [
  { name: 'idle', fps: 6, loop: true, poses: idle },
  { name: 'walk', fps: 10, loop: true, poses: walk },
  { name: 'slash1', fps: 18, loop: false, poses: slash('slash1') },
  { name: 'slash2', fps: 18, loop: false, poses: slash('slash2') },
  { name: 'thrust', fps: 16, loop: false, poses: thrust, king: false },
  { name: 'rise', fps: 11, loop: false, poses: rise, king: false },
  { name: 'settle', fps: 8, loop: false, poses: settle, king: false },
  { name: 'smite', fps: 14, loop: false, poses: smite, king: true },
  { name: 'decree', fps: 10, loop: false, poses: decree, king: true },
  { name: 'rest', fps: REST_FPS, loop: false, poses: rest },
];

/** The animations a look has: the King has no thrust or whirlwind, and only he smites and decrees. */
export const warriorAnimsFor = (look: WarriorLook): WarriorAnimDef[] =>
  WARRIOR_ANIMS.filter((a) => a.king === undefined || a.king === !!look.king).map((a) => (a.name === 'rest' ? { ...a, order: restOrder(look) } : a));

/** Frame index at which each swing lands its blow (and the decree rings out). */
export const HIT_FRAME: Record<'slash1' | 'slash2' | 'thrust' | 'smite' | 'decree', number> = { slash1: 1, slash2: 1, thrust: 2, smite: 2, decree: 2 };

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
  // Poses may depend on the look (the King's idle), so it is set before they are made.
  LK = look;
  for (const a of warriorAnimsFor(look)) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, index) => {
        const { canvas, meta } = drawWarriorFrame(dir, pose, look);
        out.push({ key: `${a.name}_${dir}_${index}`, anim: a.name, dir, canvas, meta });
      });
    }
  }
  // The whirlwind's frames (the King has none).
  for (let k = 0; k < (look.king ? 0 : SPIN_FRAMES); k++) {
    const { dir, pose } = spinFrame(k);
    const { canvas, meta } = drawWarriorFrame(dir, pose, look);
    out.push({ key: `spin_${k}`, anim: 'spin', dir: null, canvas, meta });
  }
  return out;
}
