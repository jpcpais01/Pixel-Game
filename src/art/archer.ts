// The archer, drawn procedurally from a small rig like the alchemist.
//
// A ranger: a forest-green hooded cloak over a moss tunic and a tan leather
// jerkin, auburn hair under the hood, a leather bracer on the bow arm and a
// quiver of red-fletched arrows on the back. The yew longbow is always in the
// off hand; the draw hand nocks, draws to the jaw and looses.
//
// The body keeps to the 24x32 box; frames are larger so the bow can be raised
// overhead. Drawing functions work in body-box coordinates. Hands are posed in
// the archer's own terms (forward, out to the side, height) and placed for
// each view. While the bow is raised it points from the draw hand through the
// grip, so one set of keyframes aims it right in every direction. The arrows
// he looses are drawn here too, as small sprites in sixteen headings.
//
// The storm archer is his other look on the same rig: a thunderhead-indigo
// hood and cloak edged in silver, silver hair, eyes lit blue, a bow of dark
// steel strung with lightning and arrows fletched with it.
//
// The wild hunt is the ranger's other skin: no hood, but a stag's skull worn
// over the face with great antlers branching out of it and moonlight burning
// in its sockets, long black hair, a wolf-fur cloak and ruff, a bow of bone
// strung with a thread of spirit light, and raven-fletched arrows tipped with it.
//
// The scarecrow is his Hallow's Eve skin: a burlap sack for a head, cinched
// with twine, a crooked grin stitched across it and embers burning in its eye
// holes; a battered felt hat with a crow perched on its brim; straw bursting
// from the collar, the cuffs and the boots; a faded plaid flannel shirt under
// patched denim overalls held up with rope, a ragged old coat; a bow cut from
// a crooked branch and strung with twine, and crow-fletched arrows tipped with
// embers that trail ghost-green light.
//
// The arbalest is the archer's second type, on the same rig: a crossbowman
// in a steel kettle hat with a brown beard under its brim, a quilted
// wine-red gambeson, a navy brigandine studded with rivets, a mail tippet,
// and a tall pavise slung on his back (plain boards inside; painted outside,
// per pale red and cream with a chevron counterchanged and a gilt boss). His
// heavy crossbow rides on his shoulder. He shoulders it to shoot, then sets
// its nose in the stirrup at his feet and winds the string back with a
// crank. His bolts are drawn here too.
//
// The windrunner is the third: an elf skirmisher, light on her feet.
// Platinum hair in a high tail, long pointed ears, a silver circlet with a
// wind-gem, a dusk-blue silk tunic under teal leathers, a long scarf whose tails
// stream in the wind, and a slender silverwood bow strung with a thread of
// wind. She nocks three arrows at once, and leaps back loosing a gale.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB } from './pixel';
import {
  ARC,
  ARC_FLETCH,
  BOLT_CORE,
  BOLT_HOT,
  BOLT_MID,
  BOOT,
  BOWSTRING,
  EYE,
  FLETCH,
  GOLD,
  HAIR,
  JERKIN,
  LEATHER,
  MAIL,
  RANGER_CLOAK,
  RANGER_HAIR,
  RANGER_TUNIC,
  SKIN,
  STEEL,
  STORM_BOW,
  STORM_CLOAK,
  STORM_EYE,
  STORM_JERKIN,
  STORM_TRIM,
  STORM_TUNIC,
  TROUSER,
  YEW,
} from './palette';
import { DIRS, type Dir } from './wizard';

export const ARCHER_W = 48;
export const ARCHER_H = 50;
const BODY_X = 12;
const BODY_Y = 12;
/** Sprite origin in the frame: body centre, just under the feet. */
export const ARCHER_ORIGIN_X = BODY_X + 12;
export const ARCHER_ORIGIN_Y = BODY_Y + 31;
/** Height above the feet an arrow flies at: the draw hand at the jaw. */
export const ARROW_H = 15;

/** A hand, in the archer's terms: `f` forward, `s` out to its own side, `h` up from the chest. */
export interface Hand {
  f: number;
  s: number;
  h: number;
}

export interface Pose {
  /** Whole body raised (walk passing frames). */
  lift: number;
  /** Upper body lowered. */
  breath: number;
  /** Foot offsets. Side view: forward (+) / back (-). Front/back: lift. */
  footA: number;
  footB: number;
  /** Upper body shifted forward (side view), in pixels. */
  lean: number;
  /** The draw hand (screen left from the front and back, the near arm from the side) and the bow hand. */
  a: Hand;
  b: Hand;
  /** The bow is up and aimed (pointing from the draw hand through the grip), not carried. */
  raised: boolean;
  /** An arrow sits on the string, its nock in the draw hand. */
  nock: boolean;
  /** 0..1 how far the string is drawn. */
  draw: number;
  /** 0..1 the arrowhead gathering light (the volley). */
  glint: number;
  /** Cloak swinging behind (side view) or to one side, in pixels. */
  sway: number;
  blink?: boolean;
  /** An arrow in the draw hand (the idle moment): its heading in radians on screen, and how far up the shaft from the nock the hand holds it. */
  shaft?: number;
  grip?: number;
  /** The held arrow is still half in the quiver, behind him. */
  shaftBehind?: boolean;
  /** One eye shut, sighting down a shaft. */
  wink?: boolean;
  /** The head nudged from the body; front view only. */
  headX?: number;
  headY?: number;
  /**
   * The crossbow's line, from the rear of its stock to its fore-end, when it
   * isn't held between the hands (on his shoulder, nose down in the stirrup).
   */
  xb?: { r: Hand; f: Hand };
  /** The crank turning at the stock's butt, the draw hand on its handle. */
  crank?: boolean;
  /** The net canister loaded instead of a bolt. */
  net?: boolean;
  /** The kettle hat pushed up off the brow, px. */
  hatTip?: number;
  /** Mouth wide open (a yawn). */
  yawn?: boolean;
  /** Feet off the ground (a leap), px. */
  air?: number;
  /** Three arrows on the string at once, fanned. */
  fan?: boolean;
  /** A leaf drifting by (front view, body coordinates). */
  leaf?: [number, number];
  /** Wind streaming the scarf and hair, 0..1. */
  gust?: number;
}

/** One look for the archer: its texture key, its cloth and its bow. */
export interface ArcherLook {
  key: string;
  cloak: Material;
  tunic: Material;
  jerkin: Material;
  hair: Material;
  eye: Material;
  bow: Material;
  string: Material;
  fletch: Material;
  /** The arrowhead, and the shaft behind it. */
  head: Material;
  shaft: Material;
  /** Buckles and the hood's edge. */
  metal: Material;
  /** Silver edging along the hood and cloak. */
  trim?: Material;
  /** Light the arrowhead gathers, brightest first. */
  light: [RGB, RGB, RGB];
  /** The storm archer: the string and arrows crackle. */
  storm: boolean;
  /** Light living in the string, the eyes and the arrowheads (the storm's lightning, the hunt's moonlight), brightest first. */
  crackle?: [RGB, RGB, RGB];
  /** The bow's grip and the quiver, when not plain leather. */
  wrap?: Material;
  /** The wild hunt: a stag's skull and antlers for a hood, long hair and a fur ruff. */
  hunt?: { skull: Material; antler: Material };
  /** The scarecrow: a sack head under a felt hat, straw everywhere, overalls and a crow. */
  scarecrow?: Scarecrow;
  /** The arbalest: a kettle hat, a pavise on his back, a crossbow for a bow. */
  arb?: Arbalest;
  /** The windrunner: an elf with a high tail of hair and a scarf for a cloak. */
  elf?: Elf;
  /** Gloves, legs and boots, when not the ranger's bare hands, dark trousers and soft boots. */
  glove?: Material;
  trouser?: Material;
  boot?: Material;
}

/** The arbalest's own materials. */
export interface Arbalest {
  helm: Material;
  beard: Material;
  /** The crossbow's walnut stock, and its steel prod and fittings. */
  stock: Material;
  prod: Material;
  /** The pavise: its bare boards inside, its painted face's two fields, its boss. */
  board: Material;
  field: [Material, Material];
  boss: Material;
  /** The net canister's cord and its lead weights. */
  rope: Material;
  lead: Material;
}

/** The windrunner's own materials. */
export interface Elf {
  scarf: Material;
  gem: Material;
  leaf: Material;
}

/** The scarecrow's own materials. */
export interface Scarecrow {
  sack: Material;
  hat: Material;
  band: Material;
  straw: Material;
  stitch: Material;
  rope: Material;
  patch: Material;
  trouser: Material;
  glove: Material;
  crow: Material;
  beak: Material;
}

export const RANGER_LOOK: ArcherLook = {
  key: 'archer',
  cloak: RANGER_CLOAK,
  tunic: RANGER_TUNIC,
  jerkin: JERKIN,
  hair: RANGER_HAIR,
  eye: EYE,
  bow: YEW,
  string: BOWSTRING,
  fletch: FLETCH,
  head: STEEL,
  shaft: YEW,
  metal: GOLD,
  light: [[255, 250, 232], [255, 222, 150], [236, 168, 80]],
  storm: false,
};

export const STORM_LOOK: ArcherLook = {
  key: 'archer_storm',
  cloak: STORM_CLOAK,
  tunic: STORM_TUNIC,
  jerkin: STORM_JERKIN,
  hair: HAIR,
  eye: STORM_EYE,
  bow: STORM_BOW,
  string: ARC,
  fletch: ARC_FLETCH,
  head: ARC,
  shaft: STORM_BOW,
  metal: STORM_TRIM,
  trim: STORM_TRIM,
  light: [BOLT_CORE, BOLT_HOT, BOLT_MID],
  storm: true,
  crackle: [BOLT_CORE, BOLT_HOT, BOLT_MID],
  wrap: STORM_JERKIN,
};

const ramp = (...c: string[]): RGB[] => c.map(hex);

// The wild hunt's materials.
const FUR: Material = { ramp: ramp('#181412', '#2c2622', '#463c36', '#685a50', '#928476'), outline: hex('#0a0806'), outlineLit: hex('#1a1612') };
const HUNT_TUNIC: Material = { ramp: ramp('#120e16', '#201a26', '#322838', '#483c52'), outline: hex('#070509') };
const HUNT_JERKIN: Material = { ramp: ramp('#1c130c', '#322218', '#4e3626', '#6c4e36', '#8c6a4a'), outline: hex('#0c0805') };
const HUNT_HAIR: Material = { ramp: ramp('#0c0a10', '#1a1620', '#2c2634', '#423a4c'), outline: hex('#050407') };
const STAG_SKULL: Material = { ramp: ramp('#56483a', '#928066', '#ccba96', '#eee4ca', '#fffaee'), outline: hex('#1c140c'), outlineLit: hex('#34281c') };
const ANTLER: Material = { ramp: ramp('#34281c', '#62503c', '#96826a', '#c6b494', '#ece0c6'), outline: hex('#120c07') };
const MOON_EYE: Material = { ramp: ramp('#3a2a8a', '#6a50d8', '#b0a0ff', '#f0e8ff'), outline: hex('#140c30'), emissive: 0.9, noAO: true };
const MOON_STRING: Material = { ramp: ramp('#6a50d8', '#b0a0ff', '#e4dcff', '#fbf8ff'), outline: hex('#1c1040'), emissive: 0.9, noAO: true };
const RAVEN_FLETCH: Material = { ramp: ramp('#08080e', '#141828', '#2a3050', '#48547a'), outline: hex('#030308') };
const MOON_LIGHT: [RGB, RGB, RGB] = [hex('#f8f0ff'), hex('#d4c4ff'), hex('#9a80f0')];

export const HUNT_LOOK: ArcherLook = {
  key: 'archer_hunt',
  cloak: FUR,
  tunic: HUNT_TUNIC,
  jerkin: HUNT_JERKIN,
  hair: HUNT_HAIR,
  eye: MOON_EYE,
  bow: STAG_SKULL,
  string: MOON_STRING,
  fletch: RAVEN_FLETCH,
  head: MOON_EYE,
  shaft: HUNT_JERKIN,
  metal: STAG_SKULL,
  light: MOON_LIGHT,
  storm: false,
  crackle: MOON_LIGHT,
  wrap: FUR,
  hunt: { skull: STAG_SKULL, antler: ANTLER },
};

// The scarecrow's materials: warm, sun-faded field colours so the ember eyes
// and arrowheads are the only bright things on him.
const BURLAP: Material = { ramp: ramp('#3e2c1a', '#62492c', '#8a6c42', '#b0925e', '#cfb47c'), outline: hex('#1a1008'), outlineLit: hex('#342412') };
const FELT: Material = { ramp: ramp('#141010', '#221b17', '#342a21', '#4a3d2d', '#63553d'), outline: hex('#070504') };
const HAT_BAND: Material = { ramp: ramp('#4a180a', '#7c2c10', '#b0481a', '#dc7030'), outline: hex('#1a0804') };
const STRAW: Material = { ramp: ramp('#7a5818', '#ad862c', '#d8b44a', '#f2d884', '#fff0b4'), outline: hex('#352406'), outlineLit: hex('#5a3e10') };
const FLANNEL: Material = { ramp: ramp('#3c160a', '#6a2c12', '#9a461c', '#c46828', '#e08c40'), outline: hex('#160704') };
const DENIM: Material = { ramp: ramp('#141824', '#222a3a', '#343f56', '#4c5a76', '#687894'), outline: hex('#06070d') };
const RAG_COAT: Material = { ramp: ramp('#141310', '#221f19', '#332f25', '#474133', '#5c5543'), outline: hex('#060504') };
const ROPE: Material = { ramp: ramp('#56401e', '#846634', '#ae904e', '#d0b674'), outline: hex('#20160a') };
const CLOTH_PATCH: Material = { ramp: ramp('#182a16', '#284222', '#3e5e34', '#5a7e4a'), outline: hex('#08100a') };
const STITCH: Material = { ramp: ramp('#0e0805', '#1c110a'), outline: hex('#060302'), noAO: true };
const EMBER_EYE: Material = { ramp: ramp('#8a2a06', '#e05a10', '#ffa030', '#ffe890'), outline: hex('#2a0a02'), emissive: 0.95, noAO: true };
const BRANCH: Material = { ramp: ramp('#1c140e', '#322418', '#4a3824', '#665034', '#826c4a'), outline: hex('#0a0705') };
const TWINE: Material = { ramp: ramp('#5a4a2e', '#7e6c48', '#a08e66'), outline: hex('#1e160a') };
const TIN: Material = { ramp: ramp('#34343c', '#62626c', '#9696a0', '#d2d2da'), outline: hex('#101014'), shine: true };
const CROW: Material = { ramp: ramp('#050508', '#0c0d14', '#181a28', '#292e46', '#434e78'), outline: hex('#020203'), shine: true };
const CROW_BEAK: Material = { ramp: ramp('#4a3610', '#8a6a1e', '#c8a040'), outline: hex('#140c03') };
/** Ember at the heart, orange round it, ghost-green at the edges: a jack-o'-lantern's flame. */
const EMBER_LIGHT: [RGB, RGB, RGB] = [hex('#fff4d0'), hex('#ffa040'), hex('#8aff9a')];

export const SCARECROW_LOOK: ArcherLook = {
  key: 'archer_scarecrow',
  cloak: RAG_COAT,
  tunic: FLANNEL,
  jerkin: DENIM,
  hair: STRAW,
  eye: EMBER_EYE,
  bow: BRANCH,
  string: TWINE,
  fletch: CROW,
  head: EMBER_EYE,
  shaft: BRANCH,
  metal: TIN,
  light: EMBER_LIGHT,
  storm: false,
  crackle: EMBER_LIGHT,
  wrap: BURLAP,
  scarecrow: {
    sack: BURLAP,
    hat: FELT,
    band: HAT_BAND,
    straw: STRAW,
    stitch: STITCH,
    rope: ROPE,
    patch: CLOTH_PATCH,
    trouser: DENIM,
    glove: LEATHER,
    crow: CROW,
    beak: CROW_BEAK,
  },
};

// The arbalest's materials: soldier's colours, wine-red and navy and steel,
// so the painted pavise and the bright prod are what catch the eye.
const ARB_BEARD: Material = { ramp: ramp('#2a140a', '#4c2814', '#74401e', '#9c5e2e', '#c08046'), outline: hex('#120804') };
const GAMBESON: Material = { ramp: ramp('#28090f', '#46111b', '#6a1b29', '#902b37', '#b44649'), outline: hex('#130407'), outlineLit: hex('#2a0a10') };
const BRIGANDINE: Material = { ramp: ramp('#0d111b', '#171e2c', '#252f43', '#36435d', '#4e5c7a'), outline: hex('#05070b') };
const WALNUT: Material = { ramp: ramp('#2a160c', '#4a2a16', '#6e4426', '#94603a', '#b88050'), outline: hex('#0d0603'), outlineLit: hex('#22120a'), shine: true };
const PAVISE_BOARD: Material = { ramp: ramp('#1a120c', '#2c2016', '#423222', '#5a4630', '#74603f'), outline: hex('#0a0705') };
const PAVISE_RED: Material = { ramp: ramp('#3a0b0d', '#681316', '#972122', '#c23a30', '#e05e46'), outline: hex('#170405'), outlineLit: hex('#300a0b') };
const PAVISE_CREAM: Material = { ramp: ramp('#4c3c28', '#7a684a', '#a8946e', '#d2c096', '#efe3bf'), outline: hex('#1b1309'), outlineLit: hex('#33271a') };
const VANE: Material = { ramp: ramp('#3a0a0c', '#6a1517', '#9e2725', '#ca4333', '#e8664a'), outline: hex('#150405') };
const LEAD: Material = { ramp: ramp('#13151b', '#282c36', '#444a58', '#687080', '#9aa2b2'), outline: hex('#06070a'), shine: true };
const GLOVE: Material = { ramp: ramp('#1c1109', '#342018', '#523624', '#724e38', '#90684a'), outline: hex('#0b0603') };

export const ARBALEST_LOOK: ArcherLook = {
  key: 'archer_arbalest',
  // His "cloak" is the mail tippet over his shoulders.
  cloak: MAIL,
  tunic: GAMBESON,
  jerkin: BRIGANDINE,
  hair: ARB_BEARD,
  eye: EYE,
  bow: STEEL,
  string: BOWSTRING,
  fletch: VANE,
  head: STEEL,
  shaft: WALNUT,
  metal: STEEL,
  light: [[255, 250, 232], [255, 222, 150], [236, 168, 80]],
  storm: false,
  wrap: LEATHER,
  glove: GLOVE,
  arb: { helm: STEEL, beard: ARB_BEARD, stock: WALNUT, prod: STEEL, board: PAVISE_BOARD, field: [PAVISE_RED, PAVISE_CREAM], boss: GOLD, rope: ROPE, lead: LEAD },
};

// The windrunner's materials: a dusk-blue silk tunic, sea-teal leathers and platinum
// hair, with the wind's own light living in her eyes, her gem and her string.
const SILK: Material = { ramp: ramp('#232c48', '#36446a', '#4e6290', '#7088b4', '#9cb4d8'), outline: hex('#0c1020'), outlineLit: hex('#1a2238') };
const TEAL_LEATHER: Material = { ramp: ramp('#09252a', '#113c42', '#1a5a5e', '#267a78', '#3c9c94'), outline: hex('#041214') };
const SCARF: Material = { ramp: ramp('#1c6872', '#389ca2', '#72d0ca', '#bdf1e8', '#f2fffb'), outline: hex('#0a292d'), outlineLit: hex('#164247') };
const PLATINUM: Material = { ramp: ramp('#5a5c78', '#8a8eaa', '#bcc0d6', '#e4e7f4', '#ffffff'), outline: hex('#1e1f38'), outlineLit: hex('#363854') };
const GALE_EYE: Material = { ramp: ramp('#0a4e4e', '#18a29a', '#6aead9', '#dcfff6'), outline: hex('#041f1e'), emissive: 0.8, noAO: true };
const SILVERWOOD: Material = { ramp: ramp('#2a323e', '#4a5868', '#78889c', '#a8b8c8', '#dce8f2'), outline: hex('#0e131b'), outlineLit: hex('#1c2430'), shine: true };
const WIND_STRING: Material = { ramp: ramp('#2a9896', '#7ae6d8', '#cefff3', '#ffffff'), outline: hex('#0b3333'), emissive: 0.85, noAO: true, noOutline: true };
const WHITE_FLETCH: Material = { ramp: ramp('#7a8a98', '#b2c2ce', '#e0ecf2', '#ffffff'), outline: hex('#25313b') };
const WIND_GEM: Material = { ramp: ramp('#09595a', '#20b2a8', '#82f2e0', '#e8fffa'), outline: hex('#032120'), emissive: 0.9, shine: true, noAO: true };
const SILVER: Material = { ramp: ramp('#343c4a', '#606c7e', '#9eaaba', '#dae4f0', '#ffffff'), outline: hex('#0f131b'), shine: true };
const GREY_BOOT: Material = { ramp: ramp('#20262e', '#38424e', '#56626e', '#7a8692', '#9eaab4'), outline: hex('#0a0d11') };
const LEAF: Material = { ramp: ramp('#28480f', '#4a781b', '#7aac2e', '#b2da58', '#e2f6a0'), outline: hex('#111f05') };
const GALE_LIGHT: [RGB, RGB, RGB] = [hex('#f0fffb'), hex('#a2f4e6'), hex('#4ac2ba')];

export const WIND_LOOK: ArcherLook = {
  key: 'archer_wind',
  // Her "cloak" is the scarf.
  cloak: SCARF,
  tunic: SILK,
  jerkin: TEAL_LEATHER,
  hair: PLATINUM,
  eye: GALE_EYE,
  bow: SILVERWOOD,
  string: WIND_STRING,
  fletch: WHITE_FLETCH,
  head: WIND_GEM,
  shaft: SILVERWOOD,
  metal: SILVER,
  light: GALE_LIGHT,
  storm: false,
  crackle: GALE_LIGHT,
  wrap: TEAL_LEATHER,
  trouser: TEAL_LEATHER,
  boot: GREY_BOOT,
  elf: { scarf: SCARF, gem: WIND_GEM, leaf: LEAF },
};

export const ARCHER_LOOKS = [RANGER_LOOK, STORM_LOOK, HUNT_LOOK, SCARECROW_LOOK, ARBALEST_LOOK, WIND_LOOK];

/** The look being drawn; set by buildArcherFrames. */
let S: ArcherLook = RANGER_LOOK;
/** The frame being drawn has one eye shut (the far one, screen right). */
let winking = false;

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
// The bow

/** How the bow sits: its grip, the way it points (n) and the line of its limbs (axis). */
interface BowFrame {
  x: number;
  y: number;
  nx: number;
  ny: number;
  ax: number;
  ay: number;
}

const unit = (x: number, y: number): [number, number] => {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
};

function bowFrame(view: View, p: Pose, fa: Placed, fb: Placed): BowFrame {
  let nx: number;
  let ny: number;
  if (p.raised) {
    // Aimed: from the draw hand through the grip, or straight ahead once the hand has flown off it.
    const d = Math.hypot(fb.x - fa.x, fb.y - fa.y);
    if (d > 2) [nx, ny] = unit(fb.x - fa.x, fb.y - fa.y);
    else [nx, ny] = view === 'side' ? [-1, 0] : view === 'down' ? [0, 1] : [0, -1];
  } else {
    // Carried low at his side, belly out.
    [nx, ny] = view === 'side' ? unit(-1, 0.45) : unit(1, -0.25);
  }
  // The limbs cross the aim; the upper limb tips back a little from the front, as a bow is canted.
  let [ax, ay] = [-ny, nx];
  if (ay > 0 || (ay === 0 && ax > 0)) [ax, ay] = [-ax, -ay];
  return { x: fb.x, y: fb.y, nx, ny, ax, ay };
}

/**
 * The bow at its grip: two limbs bending back from the handle to the tips, a
 * leather grip, the string (drawn to the hand, or straight), and the nocked
 * arrow along the aim.
 */
function drawBow(c: PixelCanvas, view: View, p: Pose, fa: Placed, fb: Placed, bias = 0): void {
  const f = bowFrame(view, p, fa, fb);
  const L = view === 'side' ? 7.6 : 7.1;
  const bend = 2.1 + p.draw * 1.4;
  const at = (t: number): [number, number] => {
    // Recurved tips flick forward again at the very ends.
    const back = bend * t * t - (Math.abs(t) > 0.82 ? (Math.abs(t) - 0.82) * 2.4 : 0);
    return [f.x + f.ax * t * L - f.nx * back, f.y + f.ay * t * L - f.ny * back];
  };
  // Limbs, grip outward to each tip, thinning as they go.
  c.part();
  const steps = 10;
  for (const s of [-1, 1]) {
    for (let i = 0; i < steps; i++) {
      const t0 = (i / steps) * s;
      const t1 = ((i + 1) / steps) * s;
      const [x0, y0] = at(t0);
      const [x1, y1] = at(t1);
      c.capsule(x0, y0, x1, y1, 1.1 - (i / steps) * 0.5, 1.1 - ((i + 1) / steps) * 0.5, S.bow, { bias });
    }
  }
  const [tx0, ty0] = at(-1);
  const [tx1, ty1] = at(1);
  if (S.scarecrow) {
    // A crooked branch, not a stave: knots along the limbs and a twig still
    // growing off one of them, a last orange leaf clinging to it.
    for (const t of [-0.66, -0.3, 0.3, 0.74]) {
      const [kx, ky] = at(t);
      c.shade(kx, ky, -1);
    }
    const [gx, gy] = at(0.5);
    c.part();
    c.line(gx + f.nx * 0.8, gy + f.ny * 0.8, gx + f.nx * 2.2 + f.ax * 0.9, gy + f.ny * 2.2 + f.ay * 0.9, S.bow, () => sphere(-0.3, -0.3), { bias });
    c.px(gx + f.nx * 2.8 + f.ax * 1.6, gy + f.ny * 2.8 + f.ay * 1.6, S.scarecrow.band, sphere(-0.4, -0.5), { bias });
  }
  c.part();
  c.capsule(f.x - f.ax * 1.4, f.y - f.ay * 1.4, f.x + f.ax * 1.4, f.y + f.ay * 1.4, 1.05, 1.05, S.wrap ?? LEATHER, { bias });
  if (S.elf) {
    // A wind-gem set in the grip, and the limbs swelling leaf-like halfway out.
    c.part();
    c.px(f.x, f.y, S.elf.gem, sphere(-0.3, -0.4), { bias: bias + 1 });
    for (const t of [-0.5, 0.5]) {
      const [lx, ly] = at(t);
      c.px(lx + f.nx * 0.8, ly + f.ny * 0.8, S.bow, sphere(f.nx * 0.5, -0.4), { bias });
    }
  }

  // The string, from tip to tip, pulled back to the hand while an arrow is on it.
  c.part();
  // Twine is only twine: the scarecrow's embers live in his arrowheads, not his string.
  const lit = S.scarecrow ? undefined : S.crackle;
  const glow = lit ? { glow: 0.9 } : {};
  if (p.nock) {
    c.line(tx0, ty0, fa.x, fa.y, S.string, () => sphere(0, -0.2), glow);
    c.line(fa.x, fa.y, tx1, ty1, S.string, () => sphere(0, -0.2), glow);
  } else {
    c.line(tx0, ty0, tx1, ty1, S.string, () => sphere(0, -0.2), glow);
  }
  if (lit) {
    // Lightning (or moonlight) living in the string: sparks along it.
    for (let k = 0; k < 3; k++) {
      const u = (k + 0.5) / 3;
      const [sx, sy] = p.nock ? (u < 0.5 ? [tx0 + (fa.x - tx0) * u * 2, ty0 + (fa.y - ty0) * u * 2] : [fa.x + (tx1 - fa.x) * (u - 0.5) * 2, fa.y + (ty1 - fa.y) * (u - 0.5) * 2]) : [tx0 + (tx1 - tx0) * u, ty0 + (ty1 - ty0) * u];
      c.spark(sx, sy, lit[1], 0.35);
    }
  }
  if (p.nock && p.fan) {
    // Three arrows nocked together, the outer two splayed either side of the aim.
    for (const a of [-FAN_SPREAD, FAN_SPREAD, 0]) {
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      arrowOnString(c, fa.x, fa.y, f.nx * ca - f.ny * sa, f.nx * sa + f.ny * ca, a === 0 ? p.glint : p.glint * 0.5);
    }
  } else if (p.nock) arrowOnString(c, fa.x, fa.y, f.nx, f.ny, p.glint);
}

/** How far the windrunner's outer arrows splay from the middle one on the string, radians. */
const FAN_SPREAD = 0.26;

/** The look's weapon: the bow, or the arbalest's crossbow (whose stock may lie along its own line, `xr` to `xf`). */
function drawWeapon(c: PixelCanvas, view: View, p: Pose, fa: Placed, fb: Placed, bias = 0, xr?: Placed, xf?: Placed): void {
  if (S.arb) drawCrossbow(c, view, p, fa, fb, xr, xf, bias);
  else drawBow(c, view, p, fa, fb, bias);
}

/** Light gathering at a point: a small cross of it, its arms growing with `glint`. */
function glintAt(c: PixelCanvas, x: number, y: number, glint: number): void {
  if (glint <= 0) return;
  const [core, hot, mid] = S.light;
  c.spark(x, y, core, glint);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.spark(x + dx, y + dy, hot, 0.7 * glint);
  if (glint > 0.6) for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) c.spark(x + dx, y + dy, mid, 0.5 * glint);
}

/**
 * The arbalest's crossbow: a walnut stock from its butt (behind `r`) to its
 * nose (past `f`), a steel prod across the nose with its limbs bent back by
 * the string (spanned to the nut, or slack against the prod), a stirrup at
 * the tip, the trigger bar under the stock, and the loaded bolt (or the net
 * canister) in the groove. Seen end on, the prod foreshortens to a stub.
 */
function drawCrossbow(c: PixelCanvas, view: View, p: Pose, fa: Placed, fb: Placed, xr: Placed | undefined, xf: Placed | undefined, bias: number): void {
  const k = S.arb!;
  const r = xr ?? fa;
  const f = xf ?? fb;
  const [nx, ny] = Math.hypot(f.x - r.x, f.y - r.y) > 1.5 ? unit(f.x - r.x, f.y - r.y) : view === 'side' ? [-1, 0] : view === 'down' ? [0, 1] : [0, -1];
  const o = { bias };
  const bx = r.x - nx * 2.2;
  const by = r.y - ny * 2.2;
  const ex = f.x + nx * 3.4;
  const ey = f.y + ny * 3.4;
  // The stock, swelling to the butt.
  c.part();
  c.capsule(bx, by, ex, ey, 1.15, 0.75, k.stock, o);
  c.part();
  c.capsule(bx - nx * 0.3, by - ny * 0.3, r.x - nx * 0.5, r.y - ny * 0.5, 1.4, 1.2, k.stock, o);
  // The long trigger bar hanging under it.
  let [dx, dy] = [-ny, nx];
  if (dy < 0) [dx, dy] = [-dx, -dy];
  if (dy > 0.35) {
    c.part();
    c.line(r.x + nx * 0.4 + dx, r.y + ny * 0.4 + dy, r.x - nx * 0.8 + dx * 2.6, r.y - ny * 0.8 + dy * 2.6, k.prod, () => sphere(0, 0.3), o);
  }
  // The prod across the nose: thick at the middle, tapering, bent back by the string.
  const cx = ex - nx * 0.9;
  const cy = ey - ny * 0.9;
  // The nut, the steel catch the string is spanned back to: a hand's length behind the prod.
  const back = Math.min(4.6, Math.max(1, Math.hypot(cx - r.x, cy - r.y) - 1));
  const ux = cx - nx * back;
  const uy = cy - ny * back;
  c.part();
  c.px(ux, uy, k.prod, sphere(-0.3, -0.5), { bias: bias + 1 });
  let [qx, qy] = [-ny, nx];
  if (qy > 0 || (qy === 0 && qx > 0)) [qx, qy] = [-qx, -qy];
  const L = 5.4 * Math.sqrt((0.42 * nx) ** 2 + ny ** 2);
  const bend = 0.6 + p.draw * 1.3;
  const at = (t: number): [number, number] => [cx + qx * t * L - nx * bend * t * t, cy + qy * t * L - ny * bend * t * t];
  c.part();
  const steps = 8;
  for (const s of [-1, 1]) {
    for (let i = 0; i < steps; i++) {
      const [x0, y0] = at((i / steps) * s);
      const [x1, y1] = at(((i + 1) / steps) * s);
      c.capsule(x0, y0, x1, y1, 1.15 - (i / steps) * 0.55, 1.15 - ((i + 1) / steps) * 0.55, k.prod, o);
    }
  }
  // The stirrup's loop at the very nose.
  c.part();
  for (const s of [-1, 1]) c.px(ex + qx * s * 0.9 + nx * 0.5, ey + qy * s * 0.9 + ny * 0.5, k.prod, sphere(s * 0.4, -0.2), o);
  c.px(ex + nx * 1.4, ey + ny * 1.4, k.prod, sphere(0, -0.3), o);
  // The string, tip to tip, drawn back towards the nut as it's spanned.
  const [tx0, ty0] = at(-1);
  const [tx1, ty1] = at(1);
  const sx = cx + (ux - cx) * p.draw;
  const sy = cy + (uy - cy) * p.draw;
  c.part();
  c.line(tx0, ty0, sx, sy, S.string, () => sphere(0, -0.2), o);
  c.line(sx, sy, tx1, ty1, S.string, () => sphere(0, -0.2), o);
  if (p.nock) {
    c.part();
    if (p.net) {
      // The net canister: a bundle of cord on a short shaft, lead weights bound round it.
      const gx = cx + nx * 1.7;
      const gy = cy + ny * 1.7;
      c.line(ux + nx * 0.6, uy + ny * 0.6, cx, cy, S.shaft, () => sphere(0, -0.3), o);
      c.part();
      c.ellipse(gx, gy, 1.7, 1.6, k.rope, { bias });
      c.shade(gx, gy, -1);
      c.part();
      for (const s of [-1, 1]) c.px(gx + qx * s * 1.7, gy + qy * s * 1.7, k.lead, sphere(s * 0.5, -0.4), o);
      c.px(gx + nx * 1.6, gy + ny * 1.6, k.lead, sphere(0, -0.5), { bias: bias + 1 });
      glintAt(c, gx + nx * 1.6, gy + ny * 1.6, p.glint);
    } else {
      // A bolt: a stout shaft, leather vanes at the nut, a broad steel head past the prod.
      const hx = cx + nx * 2.4;
      const hy = cy + ny * 2.4;
      c.line(ux + nx * 0.6, uy + ny * 0.6, hx - nx, hy - ny, S.shaft, () => sphere(0, -0.3), o);
      c.part();
      for (const s of [-1, 1]) c.px(ux + nx * 0.9 + qx * s * 0.9, uy + ny * 0.9 + qy * s * 0.9, S.fletch, sphere(s * 0.3, 0.2), o);
      c.part();
      c.px(hx - nx * 0.8, hy - ny * 0.8, S.head, sphere(-0.3, -0.4), o);
      c.px(hx, hy, S.head, sphere(-0.5, -0.5), { bias: bias + 1 });
      glintAt(c, hx, hy, p.glint);
    }
  }
  if (p.crank) {
    // The crank's arm, from the butt round to the handle in his hand.
    c.part();
    c.line(bx + nx * 0.8, by + ny * 0.8, fa.x, fa.y, k.prod, () => sphere(0, -0.4), o);
  }
}

/** An arrow nocked at (x, y), pointing along (nx, ny): fletching at the nock, the shaft, a steel head. */
function arrowOnString(c: PixelCanvas, x: number, y: number, nx: number, ny: number, glint: number): void {
  const len = 10.5;
  const hx = x + nx * len;
  const hy = y + ny * len;
  c.part();
  c.line(x + nx * 1.5, y + ny * 1.5, hx - nx * 1.2, hy - ny * 1.2, S.shaft, () => sphere(0, -0.3));
  // Fletching: a feather either side of the shaft near the nock.
  c.part();
  for (const k of [1.2, 2.4]) {
    c.px(x + nx * k - ny, y + ny * k + nx, S.fletch, sphere(-0.3, 0.2));
    c.px(x + nx * k + ny, y + ny * k - nx, S.fletch, sphere(0.3, -0.2));
  }
  c.part();
  c.px(hx - nx * 0.6, hy - ny * 0.6, S.head, sphere(-0.3, -0.4));
  c.px(hx, hy, S.head, sphere(-0.5, -0.5), { bias: 1 });
  if (S.crackle) {
    c.spark(hx, hy, S.crackle[0], 0.5 + glint * 0.5);
    c.spark(hx + nx, hy + ny, S.crackle[1], 0.3 + glint * 0.4);
  }
  // Light gathering at the head.
  glintAt(c, hx, hy, glint);
}

/** An arrow held in the hand at `p`, heading `ang` on screen, gripped `grip` px up the shaft from its nock. */
function heldArrow(c: PixelCanvas, p: Placed, ang: number, grip: number): void {
  const nx = Math.cos(ang);
  const ny = Math.sin(ang);
  arrowOnString(c, p.x - nx * grip, p.y - ny * grip, nx, ny, 0);
}

// ---------------------------------------------------------------------------
// Parts

/**
 * A sleeved arm from the shoulder, bent at the elbow (towards `hint`), a hand
 * at the end; the bow arm wears a leather bracer on its forearm.
 */
function arm(c: PixelCanvas, sx: number, sy: number, p: Placed, reach: number, hint: [number, number], bracer: boolean, bias = 0): void {
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
  c.capsule(sx, sy, ex, ey, 1.65, 1.4, S.tunic, { bias });
  c.part();
  const sc = S.scarecrow;
  if (bracer && !sc) {
    c.capsule(ex, ey, ex + (fx - ex) * 0.35, ey + (fy - ey) * 0.35, 1.35, 1.35, S.tunic, { bias });
    c.part();
    c.capsule(ex + (fx - ex) * 0.35, ey + (fy - ey) * 0.35, fx, fy, 1.45, 1.35, S.jerkin, { bias: bias + 1 });
  } else {
    c.capsule(ex, ey, fx, fy, 1.4, 1.25, S.tunic, { bias });
  }
  if (sc) {
    // Straw bursting out of the cuff either side of the wrist.
    const [ux, uy] = unit(fx - ex, fy - ey);
    const wx = fx - ux * 1.5;
    const wy = fy - uy * 1.5;
    c.part();
    c.px(wx - uy * 1.9 - ux * 0.3, wy + ux * 1.9 - uy * 0.3, sc.straw, sphere(-0.4, -0.5), { bias });
    c.px(wx + uy * 1.9, wy - ux * 1.9, sc.straw, sphere(0.2, -0.3), { bias });
  }
  c.part();
  c.ellipse(fx, fy, 1.2, 1.15, sc ? sc.glove : (S.glove ?? SKIN), { bias });
}

function leg(c: PixelCanvas, hx: number, hy: number, fx: number, fy: number, bias = 0): void {
  c.part();
  c.capsule(hx, hy, fx, fy, 1.5, 1.3, S.scarecrow?.trouser ?? S.trouser ?? TROUSER, { bias });
}

/** A soft leather boot with a turned-down cuff. */
function boot(c: PixelCanvas, x: number, y: number, side = false, bias = 0): void {
  const m = S.boot ?? BOOT;
  c.part();
  if (side) c.ellipse(x, y, 2.2, 1.2, m, { flatten: 0.8, bias });
  else c.ellipse(x, y, 1.6, 1.3, m, { flatten: 0.8, bias });
  c.part();
  c.shape(Math.round(y - 2.4), Math.round(y - 2.4), () => [x - (side ? 1.4 : 1.7), x + (side ? 1.6 : 1.7)], m, (_x, _y, t) => cyl(t, 0.3), { bias: bias + 1 });
  const sc = S.scarecrow;
  if (sc) {
    // Straw sticking out of the boot tops.
    c.part();
    c.px(x - (side ? 1.8 : 1.9), y - 3.0, sc.straw, sphere(-0.5, -0.4), { bias });
    c.px(x + (side ? 2.2 : 2.4), y - 3.4, sc.straw, sphere(0.3, -0.5), { bias });
  }
}

/** The quiver's mouth: arrow fletchings fanned at (x, y), leaning `lean` px per row. */
function fletchings(c: PixelCanvas, x: number, y: number, lean: number): void {
  c.part();
  const tips: [number, number][] = [[-1, 0], [0, -1], [1, 0]];
  for (const [dx, dy] of tips) {
    c.px(x + dx + lean * 2, y + dy - 1, S.fletch, sphere(dx * 0.4 - 0.2, -0.6));
    c.px(x + dx + lean, y + dy, S.fletch, sphere(dx * 0.4, -0.2));
  }
  if (S.crackle) {
    c.spark(x + lean * 2, y - 2, S.crackle[1], 0.35);
    c.spark(x - 1 + lean, y, S.crackle[2], 0.25);
  }
}

/** The quiver on his back, a leather tube from (x0, y0) at its mouth to (x1, y1), arrows fanned out of it. */
function quiver(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, bias = 0): void {
  fletchings(c, x0, y0 - 1, (x0 - x1) / Math.max(1, y1 - y0) * 1.2);
  c.part();
  c.capsule(x0, y0, x1, y1, 1.7, 1.45, S.wrap ?? LEATHER, { bias });
  c.part();
  // A rim at the mouth and a band round the middle.
  c.capsule(x0 - 0.1, y0, x0 + (x1 - x0) * 0.08, y0 + (y1 - y0) * 0.08, 1.8, 1.8, S.jerkin, { bias: bias + 1 });
  c.px(x0 + (x1 - x0) * 0.55, y0 + (y1 - y0) * 0.55, S.metal, sphere(-0.3, -0.3));
}

/** The hood's cowl, draped over the shoulders from the collar (the scarecrow's flannel shoulders, from the front and side). */
function cowl(c: PixelCanvas, cx: number, U: number, l: number, r: number, m: Material = S.cloak): void {
  const top = 14 + U;
  c.part();
  c.shape(top, top + 3, (y) => {
    const u = (y - top) / 3;
    const k = Math.sqrt(u) * 0.75 + 0.25;
    return [cx - l * k, cx + r * k];
  }, m, (_x, _y, t, u) => sphere(t * 0.95, u - 0.6, 1));
  // A ragged, leaf-cut edge (or a silver hem on the storm cloak).
  const y = top + 3;
  for (let x = Math.floor(cx - l); x <= Math.ceil(cx + r); x++) {
    if (!c.filled(x, y)) continue;
    if (S.trim) c.px(x, y, S.trim, sphere(0, 0.3));
    else if (S.scarecrow) {
      // Straw spilling out from under the collar in uneven wisps.
      // Only out at the shoulders: across the chest it would read as buttons.
      const long = (x * 7) % 5 === 0;
      if ((x & 1) === 1 && Math.abs(x + 0.5 - cx) > 3) {
        c.px(x, y + 1, S.scarecrow.straw, sphere(0, 0.2));
        if (long) c.px(x, y + 2, S.scarecrow.straw, sphere(0, 0.5), { bias: -1 });
      } else c.shade(x, y, -1);
    } else if (S.hunt) {
      // A shaggy fur ruff: tufts hanging below the edge.
      if ((x & 1) === 0 && !c.filled(x, y + 1)) c.px(x, y + 1, S.cloak, sphere(0, 0.5), { bias: -1 });
      else c.shade(x, y, -1);
    } else if ((x & 1) === 0) c.shade(x, y, -1);
  }
}

/** One antler: a beam from (x0, y0) through (x1, y1) to (x2, y2), with tines off it at the given points. */
function antler(c: PixelCanvas, pts: [number, number][], tines: [number, number, number, number][], bias = 0): void {
  const m = S.hunt!.antler;
  c.part();
  for (let i = 0; i < pts.length - 1; i++) {
    const r0 = 0.8 - (i / (pts.length - 1)) * 0.35;
    const r1 = 0.8 - ((i + 1) / (pts.length - 1)) * 0.35;
    c.capsule(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], r0, r1, m, { bias });
  }
  for (const [x0, y0, x1, y1] of tines) c.capsule(x0, y0, x1, y1, 0.5, 0.4, m, { bias });
  // A pale glint at each tip.
  const [tx, ty] = pts[pts.length - 1];
  c.px(tx, ty, m, sphere(-0.3, -0.7), { bias: bias + 1 });
}

/** Both antlers from the front or the back, branching up and out from the skull's crown. */
function antlers(c: PixelCanvas, cx: number, U: number): void {
  for (const k of [-1, 1]) {
    antler(
      c,
      [[cx + k * 1.8, 9 + U], [cx + k * 3.6, 6.4 + U], [cx + k * 4.6, 3.6 + U], [cx + k * 4.4, 1.2 + U]],
      [
        [cx + k * 3.2, 7 + U, cx + k * 5.8, 6.4 + U],
        [cx + k * 4.2, 4.8 + U, cx + k * 6.4, 3.2 + U],
        [cx + k * 4.5, 3.4 + U, cx + k * 3.2, 1.8 + U],
      ],
    );
  }
}

/** The stag's skull from the front: a pale brow over the eyes, sockets with moonlight in them, and the long snout down the face. */
function skullFront(c: PixelCanvas, cx: number, U: number, blink: boolean | undefined): void {
  const k = S.hunt!;
  // Long black hair falling either side of the skull.
  c.part();
  c.shape(10 + U, 17 + U, (y) => [cx - 3.9 - (y - 10 - U) * 0.1, cx - 2.2], S.hair, (x, _y, t, u) => sphere(t * 0.8, u * 0.5 - 0.3 + (x & 1 ? 0.15 : -0.15), 1));
  c.shape(10 + U, 17 + U, (y) => [cx + 2.2, cx + 3.9 + (y - 10 - U) * 0.1], S.hair, (x, _y, t, u) => sphere(t * 0.8, u * 0.5 - 0.3 + (x & 1 ? 0.15 : -0.15), 1));
  c.part();
  c.ellipse(cx, 12.7 + U, 2.5, 2.3, SKIN, { bias: -1 });
  c.part();
  c.ellipse(cx, 10.6 + U, 3.2, 2.4, k.skull);
  c.part();
  c.shape(12 + U, 15 + U, (y) => {
    const hw = [1.6, 1.3, 1.0, 0.8][y - 12 - U];
    return [cx - hw, cx + hw];
  }, k.skull, (_x, _y, t, u) => sphere(t * 0.8, 0.2 + u * 0.4, 1));
  c.shade(cx - 1, 15 + U, -1);
  c.shade(cx, 15 + U, -1);
  // The sockets, dark round the eyes that burn in them.
  for (const [x, y] of [[cx - 3, 11], [cx - 2, 11], [cx + 1, 11], [cx + 2, 11]] as const) c.shade(x, y + U, -2);
  eyes(c, [[cx - 2, 12 + U], [cx + 1, 12 + U]], blink);
}

// ---------------------------------------------------------------------------
// The scarecrow

/** Mirror a span of offsets from `cx` when `m` is -1 (the back view flips his left and right). */
const span = (cx: number, m: number, a: number, b: number): [number, number] => (m > 0 ? [cx + a, cx + b] : [cx - b, cx - a]);

/** Burlap's coarse weave: darker threads in a loose staggered grid over the sack. */
function weave(c: PixelCanvas, x0: number, x1: number, y0: number, y1: number): void {
  const m = S.scarecrow!.sack;
  for (let y = Math.floor(y0); y <= y1; y++) {
    for (let x = Math.floor(x0); x <= x1; x++) {
      if (c.materialAt(x, y) === m && (x & 1) === 0 && ((y + (x >> 1)) & 1) === 0) c.shade(x, y, -1);
    }
  }
}

/** The flannel's plaid: dark bands every fourth row and column, darker where they cross. Run once the figure is drawn. */
function plaid(c: PixelCanvas): void {
  for (let y = -BODY_Y; y < ARCHER_H - BODY_Y; y++) {
    for (let x = -BODY_X; x < ARCHER_W - BODY_X; x++) {
      if (c.materialAt(x, y) !== S.tunic) continue;
      const v = (((x % 4) + 4) % 4) === 1;
      const h = (((y % 4) + 4) % 4) === 2;
      if (v || h) c.shade(x, y, v && h ? -2 : -1);
    }
  }
}

/** A wisp of straw: `n` pixels from (x, y) out along (dx, dy), its tip catching the light. */
function wisp(c: PixelCanvas, x: number, y: number, dx: number, dy: number, n: number, bias = 0): void {
  const m = S.scarecrow!.straw;
  c.part();
  for (let i = 0; i < n; i++) c.px(x + dx * i, y + dy * i, m, sphere(dx * 0.4 - 0.2, dy * 0.4 - 0.4), { bias: bias + (i === n - 1 ? 1 : 0) });
}

/** A square of green cloth sewn on over a hole, one big stitch in its corner. */
function patch(c: PixelCanvas, x: number, y: number, w: number, h: number): void {
  const k = S.scarecrow!;
  c.part();
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) c.px(x + dx, y + dy, k.patch, sphere(dx === 0 ? -0.5 : 0.3, dy === 0 ? -0.5 : 0.3));
  c.px(x + w - 1, y, k.stitch);
}

/** A rope for a belt along row y, twisted, knotted at `knot` with its ends hanging. */
function ropeBelt(c: PixelCanvas, x0: number, x1: number, y: number, knot: number): void {
  const k = S.scarecrow!;
  c.part();
  c.shape(y, y, () => [x0, x1], k.rope, (_x, _y, t) => cyl(t, 0));
  for (let x = Math.round(x0); x < Math.round(x1); x++) if (x & 1) c.shade(x, y, -1);
  c.part();
  c.px(knot, y, k.rope, sphere(-0.4, -0.5), { bias: 1 });
  c.px(knot, y + 1, k.rope, sphere(-0.2, 0.3));
  c.px(knot + 1, y + 2, k.rope, sphere(0.2, 0.5), { bias: -1 });
}

/**
 * The crow perched with its feet at (x, y), facing `dir` (-1 left, 1 right):
 * a hunched blue-black body, tail dipping behind, and from the front or side
 * a pale beak and an eye glinting ghost-green.
 */
function crow(c: PixelCanvas, x: number, y: number, dir: number, back = false): void {
  const k = S.scarecrow!;
  c.part();
  c.capsule(x - dir * 1.4, y - 1.4, x - dir * 3.2, y - 0.4, 0.75, 0.45, k.crow, { bias: -1 });
  c.part();
  c.ellipse(x - dir * 0.2, y - 1.5, 1.75, 1.3, k.crow, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.25, 1) });
  // A folded wing, a shade darker along its edge.
  c.shade(x - dir * 0.8, y - 1, -1);
  c.part();
  c.ellipse(x + dir * 1.3, y - 3.1, 1.1, 1.05, k.crow, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.3, 1) });
  if (back) return;
  c.part();
  c.px(x + dir * 2.6, y - 2.9, k.beak, sphere(dir * 0.4, -0.5), { bias: 1 });
  c.spark(x + dir * 1.6, y - 3.4, EMBER_LIGHT[2], 0.9);
}

/**
 * The felt hat from the front (m 1) or the back (m -1): a wide battered brim
 * drooping at one side with a bite torn from it, a dented crown leaning over,
 * patched, with a faded orange band.
 */
function hatFront(c: PixelCanvas, cx: number, U: number, m: number): void {
  const k = S.scarecrow!;
  const rows: [number, number][] = [[-4.4, 4.6], [-6.2, 6.4], [-6.5, 5.8], [-6.4, -4.2]];
  c.part();
  c.shape(7 + U, 10 + U, (y) => {
    const [a, b] = rows[y - 7 - U];
    return span(cx, m, a, b);
  }, k.hat, (_x, _y, t, u) => sphere(t * 0.8, u * 1.1 - 0.7, 1));
  // The drooping side falls into shadow, and a bite is torn out of the brim.
  c.shade(cx - m * 5, 10 + U, -1);
  c.erase(cx + m * 3 - (m < 0 ? 1 : 0), 9 + U);
  // The crown, leaning to one side, creased down the top.
  const widths = [1.8, 2.7, 3.0, 3.1, 3.2, 3.2];
  const lean = (y: number) => (8 + U - y) * 0.3 * m;
  c.part();
  c.shape(3 + U, 8 + U, (y) => {
    const hw = widths[y - 3 - U];
    return [cx - hw + lean(y) + 0.2 * m, cx + hw + lean(y) + 0.2 * m];
  }, k.hat, (_x, _y, t, u) => sphere(t * 0.9, u * 0.8 - 0.5, 1));
  c.shade(cx + Math.round(lean(3 + U)), 3 + U, -1);
  c.shade(cx + Math.round(lean(4 + U)), 4 + U, -1);
  // The band round its foot.
  c.part();
  c.shape(7 + U, 7 + U, () => [cx - 3.0 + lean(7 + U) + 0.2 * m, cx + 3.4 + lean(7 + U) + 0.2 * m], k.band, (_x, _y, t) => cyl(t, 0.1));
  if (m > 0) patch(c, cx - 2 + Math.round(lean(5 + U)), 4 + U, 2, 2);
  else patch(c, cx + Math.round(lean(5 + U)), 5 + U, 2, 2);
}

/** The sack from the front: lumpy burlap, embers in the eye holes, a crooked grin stitched shut, twine at the neck. */
function sackFront(c: PixelCanvas, cx: number, U: number, blink: boolean | undefined): void {
  const k = S.scarecrow!;
  // Straw spilling out of the sack's mouth under the twine.
  wisp(c, cx - 2.6, 15.2 + U, -1, 0.5, 2);
  wisp(c, cx + 2.2, 15.4 + U, 1, 0.4, 2);
  c.part();
  c.ellipse(cx, 11.9 + U, 3.4, 3.3, k.sack, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.85 - 0.1, 1) });
  // Stuffed unevenly: one cheek bulges.
  c.ellipse(cx + 1.4, 13 + U, 2.1, 1.8, k.sack, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8 + 0.2, dy * 0.8 + 0.1, 1) });
  weave(c, cx - 4, cx + 4, 8 + U, 15 + U);
  // The brim's shadow across the brow.
  for (let x = cx - 3; x <= cx + 3; x++) c.shade(x, 9 + U, -1);
  // The twine cinching the neck.
  c.part();
  c.shape(15 + U, 15 + U, () => [cx - 2, cx + 2], k.rope, (_x, _y, t) => cyl(t, 0));
  c.shade(cx - 1, 15 + U, -1);
  c.shade(cx + 1, 15 + U, -1);
  // The grin: a crooked slit, higher at one end, sewn shut with pale stitches across it.
  c.part();
  for (const [x, y] of [[-3, 12], [-2, 13], [-1, 13], [0, 13], [1, 13], [2, 12], [3, 11]] as const) c.px(cx + x, y + U, k.stitch);
  for (const [x, y] of [[-2, 12], [0, 12], [-1, 14], [1, 14]] as const) c.shade(cx + x, y + U, 2);
  // Eye holes with embers burning in them (dimmed to a smoulder on a blink).
  c.part();
  for (const x of [cx - 2, cx + 1]) {
    const shut = blink || (winking && x === cx + 1);
    c.px(x, 11 + U, S.eye, sphere(0, 0), { bias: shut ? -2 : 0, glow: shut ? 0.4 : undefined });
    if (!shut) {
      c.spark(x, 11 + U, S.light[1], 0.6);
      c.spark(x, 10 + U, S.light[1], 0.2);
    }
  }
}

/** The sack from behind: its back seam sewn with big stitches, twine at the neck tied in a knot. */
function sackBack(c: PixelCanvas, cx: number, U: number): void {
  const k = S.scarecrow!;
  wisp(c, cx - 2.6, 15.2 + U, -1, 0.5, 2);
  wisp(c, cx + 2.2, 15.4 + U, 1, 0.4, 2);
  c.part();
  c.ellipse(cx, 11.9 + U, 3.4, 3.3, k.sack, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.85 - 0.1, 1) });
  weave(c, cx - 4, cx + 4, 8 + U, 15 + U);
  for (let y = 10; y <= 14; y++) c.shade(cx, y + U, y & 1 ? -3 : -1);
  c.part();
  c.shape(15 + U, 15 + U, () => [cx - 2, cx + 2], k.rope, (_x, _y, t) => cyl(t, 0));
  c.px(cx, 16 + U, k.rope, sphere(0, 0.4));
  c.px(cx + 1, 17 + U, k.rope, sphere(0.3, 0.5), { bias: -1 });
}

/** Denim overalls from the front over the flannel: legs from the belt down, a bib with straps to tin buttons, patches, a rope belt. */
function overallsFront(c: PixelCanvas, cx: number, top: number, waist: number, hem: number): void {
  c.part();
  c.shape(waist + 1, hem, (y) => {
    const hw = tunicWidth(y, top, waist, 4.4);
    return [cx - hw, cx + hw];
  }, S.jerkin, (_x, _y, t) => sphere(t * 0.9, 0.2, 1));
  for (let y = waist + 2; y <= hem; y++) c.shade(cx, y, -2);
  c.part();
  c.shape(top + 3, waist - 1, () => [cx - 2.6, cx + 2.6], S.jerkin, (_x, y, t) => sphere(t * 0.8, ((y - top) / (waist - top)) * 0.6 - 0.3, 1));
  c.part();
  c.line(cx - 2, top + 3, cx - 3, top, S.jerkin, () => sphere(-0.3, -0.3));
  c.line(cx + 1, top + 3, cx + 2, top, S.jerkin, () => sphere(0.3, -0.3));
  c.part();
  c.px(cx - 2, top + 3, S.metal, sphere(-0.4, -0.5));
  c.px(cx + 1, top + 3, S.metal, sphere(-0.4, -0.5));
  patch(c, cx - 1, top + 4, 2, 2);
  patch(c, cx + 2, waist + 1, 2, 2);
  ropeBelt(c, cx - 4.2, cx + 4.2, waist, cx - 2);
}

/** The overalls in profile (facing left): the bib at the front of the chest, a strap over the shoulder, legs below the rope belt. */
function overallsSide(c: PixelCanvas, hx: number, cx: number, top: number, waist: number, skirt: number): void {
  c.part();
  c.shape(waist + 1, skirt, (y) => {
    const u = (y - waist) / (skirt - waist);
    const shift = hx + (cx - hx) * u;
    const hw = tunicWidth(y, top, waist, 3.1);
    return [shift - hw - 0.2, shift + hw + 0.2];
  }, S.jerkin, (_x, _y, t) => sphere(t * 0.9 - 0.1, 0.2, 1));
  c.part();
  c.shape(top + 3, waist - 1, (y) => {
    const hw = tunicWidth(y, top, waist, 3.1) - 0.2;
    return [hx - hw - 0.2, hx + 0.6];
  }, S.jerkin, (_x, y, t) => sphere(t * 0.9 - 0.3, ((y - top) / (waist - top)) * 0.6 - 0.3, 1));
  c.part();
  c.line(hx, top + 3, hx + 1, top, S.jerkin, () => sphere(0.2, -0.4));
  c.part();
  c.px(hx - 1, top + 3, S.metal, sphere(-0.4, -0.5));
  patch(c, hx - 1, waist + 1, 2, 2);
  ropeBelt(c, hx - 3.1, hx + 3.1, waist, hx - 3);
}

/** The scarecrow's head from the side (facing left): sack, one ember eye, the grin's end, the hat and its crow. */
function scarecrowSide(c: PixelCanvas, hx: number, U: number, blink: boolean | undefined, sway: number): void {
  const k = S.scarecrow!;
  // Straw bursting out of the back of the neck, streaming a little as he goes.
  wisp(c, hx + 2, 14.6 + U, 1, 0.4 + sway * 0.1, 3);
  wisp(c, hx + 1.4, 15.4 + U, 0.8, 1, 2);
  c.part();
  c.ellipse(hx - 0.5, 11.9 + U, 3.1, 3.3, k.sack, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.1, dy * 0.85 - 0.1, 1) });
  c.ellipse(hx - 1.6, 13.1 + U, 2.2, 1.8, k.sack, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.8 + 0.1, 1) });
  weave(c, hx - 5, hx + 3, 8 + U, 15 + U);
  for (let x = hx - 4; x <= hx + 2; x++) c.shade(x, 9 + U, -1);
  c.part();
  c.shape(15 + U, 15 + U, () => [hx - 2.2, hx + 1.8], k.rope, (_x, _y, t) => cyl(t, 0));
  c.shade(hx, 15 + U, -1);
  // The grin's crooked end curling up the cheek.
  c.part();
  for (const [x, y] of [[-4, 13], [-3, 13], [-2, 13], [-1, 12]] as const) c.px(hx + x, y + U, k.stitch);
  for (const [x, y] of [[-3, 12], [-2, 14]] as const) c.shade(hx + x, y + U, 2);
  c.part();
  c.px(hx - 3, 11 + U, S.eye, sphere(0, 0), { bias: blink ? -2 : 0, glow: blink ? 0.4 : undefined });
  if (!blink) {
    c.spark(hx - 3, 11 + U, S.light[1], 0.6);
    c.spark(hx - 4, 11 + U, S.light[1], 0.25);
  }
  // The hat in profile: brim drooping over his face, crown leaning back, band and patch.
  // (It sits a pixel above his head's own rows.)
  const V = U - 1;
  c.part();
  const rows: [number, number][] = [[-4.4, 4.2], [-6.6, 5.6], [-7, -4.4]];
  c.shape(7 + V, 9 + V, (y) => {
    const [a, b] = rows[y - 7 - V];
    return [hx + a, hx + b];
  }, k.hat, (_x, _y, t, u) => sphere(t * 0.7 - 0.1, u * 1.2 - 0.7, 1));
  c.shade(hx - 6, 9 + V, -1);
  c.part();
  const widths = [1.9, 2.7, 2.9, 3.0, 3.0];
  const lean = (y: number) => (7 + V - y) * 0.35;
  c.shape(3 + V, 7 + V, (y) => {
    const hw = widths[y - 3 - V];
    return [hx - hw + lean(y) + 0.4, hx + hw + lean(y) + 0.4];
  }, k.hat, (_x, _y, t, u) => sphere(t * 0.9, u * 0.8 - 0.5, 1));
  c.shade(hx + 1, 3 + V, -1);
  c.part();
  c.shape(7 + V, 7 + V, () => [hx - 2.6, hx + 3.4], k.band, (_x, _y, t) => cyl(t, 0.1));
  patch(c, hx - 1, 5 + V, 2, 2);
  crow(c, hx + 4, 8 + V, -1);
}

// ---------------------------------------------------------------------------
// The arbalest

/**
 * The kettle hat: a domed steel crown with a ridge running front to back and
 * a ring of rivets round its foot, on a broad brim that shades the face.
 * `hy` is the brim's widest row; `cx` its middle; `rx` how far it reaches
 * either side (wide from the front and back, a little less in profile).
 */
function kettle(c: PixelCanvas, cx: number, hy: number, rx: number, crownX = cx): void {
  const k = S.arb!;
  // The brim's far half, the crown over it, then the brim's near lip across its foot.
  c.part();
  c.ellipse(cx, hy + 0.5, rx, 1.7, k.helm, { normal: (_x, _y, dx, dy) => sphere(dx * 0.55, dy * 0.5 - 0.75, 1) });
  c.part();
  c.ellipse(crownX, hy - 1.4, 3.5, 3.1, k.helm, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.2, 1) });
  const top = Math.ceil(hy - 4.5);
  for (let y = top; y <= Math.floor(hy); y++) c.shade(Math.floor(crownX) - 1, y, 1);
  for (let x = Math.floor(crownX) - 3; x <= crownX + 2; x += 2) c.shade(x, Math.floor(hy), 1);
  c.part();
  c.shape(Math.floor(hy) + 1, Math.floor(hy) + 1, () => [cx - rx + 0.6, cx + rx - 0.6], k.helm, (_x, _y, t) => sphere(t * 0.6, 0.55, 1));
}

/** His face from the front under the hat: ears, a full brown moustache and a short square beard. */
function kettleFront(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const k = S.arb!;
  const T = Math.round(p.hatTip ?? 0);
  c.part();
  c.px(cx - 4, 12 + U, SKIN, sphere(-0.7, 0.1));
  c.px(cx + 3, 12 + U, SKIN, sphere(0.7, 0.1));
  c.part();
  c.ellipse(cx, 12.6 + U, 2.6, 2.5, SKIN);
  // Cropped hair, seen under the brim when he pushes the hat back.
  c.part();
  c.shape(10 + U, 10 + U, () => [cx - 2.8, cx + 2.8], k.beard, (_x, _y, t) => sphere(t * 0.8, -0.4, 1));
  c.px(cx - 3, 11 + U, k.beard, sphere(-0.6, 0));
  c.px(cx + 2, 11 + U, k.beard, sphere(0.6, 0));
  // The moustache, and the beard along his jaw.
  c.part();
  c.shape(13 + U, 15 + U, (y) => {
    const hw = [2.0, 2.5, 1.6][y - 13 - U];
    return [cx - hw, cx + hw];
  }, k.beard, (_x, _y, t, u) => sphere(t * 0.8, u * 0.7 - 0.2, 1));
  // His cheeks show either side of the moustache.
  c.px(cx - 3, 13 + U, SKIN, sphere(-0.6, 0.2));
  c.px(cx + 2, 13 + U, SKIN, sphere(0.6, 0.2));
  if (p.yawn) {
    for (const [x, y] of [[-1, 14], [0, 14], [-1, 15], [0, 15]] as const) c.px(cx + x, y + U, EYE);
  } else {
    c.shade(cx - 1, 14 + U, -2);
    c.shade(cx, 14 + U, -2);
  }
  c.shade(cx - 1, 13 + U, 1);
  eyes(c, [[cx - 2, 12 + U], [cx + 1, 12 + U]], p.blink);
  kettle(c, cx, 8.6 + U - T, 6.0);
  // The brim's shadow over his brow (none when he's pushed it back).
  if (T < 1) for (let x = cx - 2; x <= cx + 1; x++) c.shade(x, 11 + U, -1);
}

/** His head from behind: cropped hair over the nape, the hat over it. */
function kettleBack(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const k = S.arb!;
  c.part();
  c.px(cx - 4, 12 + U, SKIN, sphere(-0.7, 0.1));
  c.px(cx + 3, 12 + U, SKIN, sphere(0.7, 0.1));
  c.part();
  c.ellipse(cx, 12.2 + U, 2.8, 2.7, k.beard, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 1) });
  for (let x = cx - 2; x <= cx + 1; x++) if (x & 1) c.shade(x, 13 + U, -1);
  kettle(c, cx, 8.6 + U - Math.round(p.hatTip ?? 0), 6.0);
}

/** His head in profile (facing left): ear, nose, beard along the jaw, the hat's brim jutting over his face. */
function kettleSide(c: PixelCanvas, hx: number, U: number, p: Pose): void {
  const k = S.arb!;
  c.part();
  c.ellipse(hx + 0.8, 12 + U, 2.4, 2.6, k.beard, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.2, dy * 0.8, 1) });
  c.part();
  c.ellipse(hx - 1.4, 12.8 + U, 2.2, 2.2, SKIN);
  c.part();
  c.px(hx - 4, 12.4 + U, SKIN, sphere(-0.7, -0.1), { bias: 1 });
  c.px(hx + 0.2, 12 + U, SKIN, sphere(0.5, 0.2));
  c.shade(hx + 0.2, 13 + U, -1);
  c.part();
  c.shape(13 + U, 16 + U, (y) => {
    const [a, b] = ([[-4.2, -0.4], [-4.0, 0.8], [-3.6, 0.6], [-3.0, -0.6]] as const)[y - 13 - U];
    return [hx + a, hx + b];
  }, k.beard, (_x, _y, t, u) => sphere(t * 0.8 - 0.2, u * 0.7 - 0.2, 1));
  if (p.yawn) {
    c.px(hx - 4, 14 + U, EYE);
    c.px(hx - 4, 15 + U, EYE);
  } else c.shade(hx - 4, 14 + U, -2);
  eyes(c, [[hx - 3, 12 + U]], p.blink);
  kettle(c, hx - 0.6, 8.6 + U - Math.round(p.hatTip ?? 0), 5.7, hx + 0.1);
  if ((p.hatTip ?? 0) < 1) for (let x = hx - 4; x <= hx - 1; x++) c.shade(x, 11 + U, -1);
}

/** The pavise on his back, top and bottom rows (it reaches above his shoulders and down past his belt). */
const paviseRows = (U: number, L: number): [number, number] => [7 + U, 24 + L];

/** The pavise seen from in front of him: its bare boards behind his shoulders, a strap across, the painted face's edge. */
function paviseInside(c: PixelCanvas, cx: number, U: number, L: number): void {
  const k = S.arb!;
  const [top, bot] = paviseRows(U, L);
  c.part();
  c.shape(top, bot, (y) => (y === top ? [cx - 5.4, cx + 5.4] : [cx - 6.4, cx + 6.4]), k.board, (_x, _y, t, u) => sphere(t * 0.5, u * 0.3 - 0.3, 1), { bias: -1 });
  for (let y = top + 1; y <= bot; y++) {
    c.shade(cx - 3, y, -1);
    c.shade(cx + 2, y, -1);
    // The painted face shows round its edge: the red field on this side, the cream on that.
    c.px(cx + 5, y, k.field[0], sphere(0.6, 0), { bias: -1 });
    c.px(cx - 6, y, k.field[1], sphere(-0.6, 0), { bias: -1 });
  }
  c.part();
  for (const y of [top + 4, bot - 5]) c.shape(y, y, () => [cx - 6.4, cx + 6.4], LEATHER, (_x, _y, t) => cyl(t, 0.1), { bias: -1 });
}

/**
 * The pavise's painted face, seen from behind him: per pale red and cream,
 * a raised ridge down the middle, a chevron counterchanged (cream on the red,
 * red on the cream) and a gilt boss in its crook.
 */
function paviseFace(c: PixelCanvas, cx: number, U: number, L: number): void {
  const k = S.arb!;
  const [top, bot] = paviseRows(U, L);
  const edge = (y: number): number => (y === top ? 5.4 : 6.4);
  const n = (x: number, y: number) => sphere(((x + 0.5 - cx) / 6.4) * 0.7, ((y - top) / (bot - top)) * 0.5 - 0.35, 1);
  c.part();
  c.shape(top, bot, (y) => [cx - edge(y), cx], k.field[0], (x, y) => n(x, y));
  c.part();
  c.shape(top, bot, (y) => [cx, cx + edge(y)], k.field[1], (x, y) => n(x, y));
  // The chevron: two rows thick, its point under the shoulders.
  for (let x = cx - 6; x < cx + 6; x++) {
    const y0 = Math.round(16 + U + Math.abs(x + 0.5 - cx) * 0.85);
    for (const y of [y0, y0 + 1]) {
      if (y > bot - 1) continue;
      c.px(x, y, x < cx ? k.field[1] : k.field[0], n(x, y));
    }
  }
  // The ridge down the middle catches the light on one side.
  for (let y = top + 1; y <= bot; y++) {
    c.shade(cx - 1, y, 1);
    c.shade(cx, y, -1);
  }
  c.part();
  c.ellipse(cx, 20.6 + U, 1.4, 1.3, k.boss);
}

/** The pavise in profile, a thick slab across his back, its painted face turned away. */
function paviseSide(c: PixelCanvas, hx: number, U: number, L: number): void {
  const k = S.arb!;
  const [top, bot] = paviseRows(U, L);
  const at = (y: number) => hx + 2.6 + (y - top) * 0.06;
  c.part();
  c.shape(top, bot, (y) => [at(y), at(y) + 2.2], k.board, (_x, _y, t, u) => sphere(t * 0.8 + 0.2, u * 0.4 - 0.4, 1), { bias: -1 });
  for (let y = top; y <= bot; y++) c.px(Math.round(at(y) + 2.2), y, k.field[0], sphere(0.7, 0), { bias: -1 });
  c.part();
  c.px(Math.round(at(top + 13) + 3.0), top + 13, k.boss, sphere(0.6, -0.2), { bias: -1 });
}

/** The bolt case at his hip: a leather box, a band round it, the vanes of three bolts peeking out. */
function boltCase(c: PixelCanvas, x: number, y: number, bias = 0): void {
  c.part();
  c.shape(y, y + 3, () => [x - 1.2, x + 1.4], S.wrap ?? LEATHER, (_x, _y, t, u) => sphere(t * 0.8, u * 0.6 - 0.2, 1), { bias });
  c.shade(x - 1, y + 1, 1);
  c.shade(x, y + 1, 1);
  c.part();
  c.px(x - 1, y - 1, S.fletch, sphere(-0.4, -0.5), { bias });
  c.px(x, y - 1, S.fletch, sphere(0, -0.6), { bias });
  c.px(x, y - 2, S.fletch, sphere(0.2, -0.7), { bias: bias + 1 });
}

/** Quilting on the gambeson, rivets on the brigandine, rings in the mail. Run once the figure is drawn. */
function arbTexture(c: PixelCanvas): void {
  for (let y = -BODY_Y; y < ARCHER_H - BODY_Y; y++) {
    for (let x = -BODY_X; x < ARCHER_W - BODY_X; x++) {
      const m = c.materialAt(x, y);
      const ym = ((y % 3) + 3) % 3;
      if (m === S.tunic && ym === 0) c.shade(x, y, -1);
      else if (m === S.jerkin && (x & 1) === 0 && ym === 1) c.shade(x, y, 2);
      else if (m === S.cloak && ((x + y) & 1) === 1) c.shade(x, y, -1);
    }
  }
}

// ---------------------------------------------------------------------------
// The windrunner

/** Her tail of hair from the front: gathered high on the crown and swinging out past her shoulder (behind her). */
function tailFront(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const g = p.gust ?? 0;
  const sw = p.sway * 0.8 + g * 2.6;
  c.part();
  c.capsule(cx + 1.2, 8.2 + U, cx + 3.2 + sw * 0.4, 12.8 + U - g, 1.8, 1.4, S.hair, { bias: -1 });
  c.capsule(cx + 3.2 + sw * 0.4, 12.8 + U - g, cx + 4.2 + sw, 19 + U - g * 3, 1.4, 0.55, S.hair, { bias: -1 });
  for (let y = 13; y <= 18; y += 2) c.shade(Math.round(cx + 3.6 + sw * 0.7), y + U - Math.round(g * 2), -1);
}

/**
 * Her head from the front: the hair swept to one side over her brow, long
 * ears pointing up and out through it, a silver circlet with the wind-gem,
 * and eyes lit by the wind.
 */
function elfFront(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const k = S.elf!;
  c.part();
  c.ellipse(cx, 11.2 + U, 3.3, 3.3, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  // The tail's knot high on her crown, a silver clasp round it.
  c.part();
  c.ellipse(cx + 1.4, 7.9 + U, 1.5, 1.2, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.8 - 0.4, 1) });
  c.px(cx + 1, 8 + U, S.metal, sphere(0.2, -0.5), { bias: 1 });
  for (const s of [-1, 1]) {
    c.part();
    c.capsule(cx + s * 2.9, 12.6 + U, cx + s * 5.3, 9.9 + U, 0.85, 0.35, SKIN);
  }
  c.part();
  c.ellipse(cx, 12.6 + U, 2.5, 2.4, SKIN);
  // Locks framing her face, and the fringe swept across her brow.
  c.part();
  c.shape(10 + U, 10 + U, () => [cx - 3, cx + 0.8], S.hair, (_x, _y, t) => sphere(t * 0.8, -0.2, 1));
  c.px(cx - 3, 11 + U, S.hair, sphere(-0.6, 0.1));
  c.px(cx - 3, 12 + U, S.hair, sphere(-0.6, 0.4));
  c.px(cx + 2, 11 + U, S.hair, sphere(0.6, 0.1));
  c.part();
  c.shape(9 + U, 9 + U, () => [cx - 2.8, cx + 2.8], S.metal, (_x, _y, t) => cyl(t, -0.3));
  c.part();
  c.px(cx - 1, 9 + U, k.gem, sphere(-0.3, -0.5), { bias: 1 });
  c.px(cx, 9 + U, k.gem, sphere(0.3, -0.3));
  c.spark(cx - 1, 9 + U, S.light[1], 0.5);
  eyes(c, [[cx - 2, 12 + U], [cx + 1, 12 + U]], p.blink);
  c.shade(cx - 1, 14 + U, -1);
}

/** Her head from behind: the tail falling down her back from its clasp, her ears through her hair. */
function elfBack(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const g = p.gust ?? 0;
  const sw = p.sway * 0.6 + g * 2;
  for (const s of [-1, 1]) {
    c.part();
    c.capsule(cx + s * 2.9, 12.6 + U, cx + s * 5.3, 9.9 + U, 0.85, 0.35, SKIN);
  }
  c.part();
  c.ellipse(cx, 11.2 + U, 3.4, 3.4, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 1) });
  c.part();
  c.px(cx - 4, 9 + U, S.metal, sphere(-0.6, -0.2));
  c.px(cx + 3, 9 + U, S.metal, sphere(0.6, -0.2));
  c.part();
  c.capsule(cx - 0.4, 8 + U, cx + sw * 0.4, 14 + U - g, 1.8, 1.4, S.hair);
  c.capsule(cx + sw * 0.4, 14 + U - g, cx + sw, 21 + U - g * 3, 1.4, 0.55, S.hair);
  for (let y = 10; y <= 20; y += 2) c.shade(Math.round(cx - 0.4 + sw * ((y - 8) / 13)), y + U - Math.round(g * ((y - 8) / 13) * 3), -1);
  c.part();
  c.px(cx - 1, 8 + U, S.metal, sphere(0, -0.5), { bias: 1 });
  c.px(cx, 8 + U, S.metal, sphere(0.3, -0.4));
}

/** Her head in profile (facing left): the tail streaming back from her crown, a long ear swept back, the circlet's gem at her brow. */
function elfSide(c: PixelCanvas, hx: number, U: number, p: Pose): void {
  const k = S.elf!;
  const g = p.gust ?? 0;
  const sw = p.sway * 0.6;
  c.part();
  c.capsule(hx + 1.2, 8.2 + U, hx + 4.6 + sw * 0.5 + g * 1.5, 10.4 + U - g * 0.8, 1.7, 1.3, S.hair, { bias: -1 });
  c.capsule(hx + 4.6 + sw * 0.5 + g * 1.5, 10.4 + U - g * 0.8, hx + 6.4 + sw + g * 4, 16.2 + U - g * 4.4, 1.3, 0.55, S.hair, { bias: -1 });
  c.part();
  c.ellipse(hx + 0.6, 11.4 + U, 3.0, 3.1, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.2, dy * 0.8 - 0.1, 1) });
  c.part();
  c.ellipse(hx - 1.4, 12.8 + U, 2.2, 2.2, SKIN);
  c.px(hx - 4, 12.6 + U, SKIN, sphere(-0.7, -0.1), { bias: 1 });
  c.shade(hx - 3, 14 + U, -1);
  c.part();
  c.capsule(hx + 0.4, 12.8 + U, hx + 3.2, 10 + U, 0.85, 0.35, SKIN);
  c.part();
  c.shape(10 + U, 10 + U, () => [hx - 3.4, hx + 0.6], S.hair, (_x, _y, t) => sphere(t * 0.8, -0.3, 1));
  c.px(hx - 0.4, 11 + U, S.hair, sphere(0.3, 0.2));
  c.part();
  c.shape(9 + U, 9 + U, () => [hx - 3.4, hx + 1.4], S.metal, (_x, _y, t) => cyl(t, -0.3));
  c.part();
  c.px(hx - 3, 9 + U, k.gem, sphere(-0.5, -0.4), { bias: 1 });
  c.spark(hx - 3, 9 + U, S.light[1], 0.5);
  eyes(c, [[hx - 3, 12 + U]], p.blink);
}

/** Her scarf from the front: wound round her neck, knotted to one side, its tails fluttering. */
function scarfFront(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const k = S.elf!;
  const g = p.gust ?? 0;
  const sw = p.sway * 0.8;
  c.part();
  c.shape(14 + U, 15 + U, (y) => (y === 14 + U ? [cx - 2.8, cx + 2.8] : [cx - 3.5, cx + 3.5]), k.scarf, (_x, _y, t, u) => sphere(t * 0.9, u - 0.5, 1));
  c.shade(cx - 2, 15 + U, -1);
  c.shade(cx + 1, 14 + U, -1);
  const ex = cx + 3.6 + sw + g * 3.4;
  const ey = 21.4 + U - g * 4.2;
  c.part();
  c.capsule(cx + 2.4, 16.4 + U, ex + 1.8 + g, ey - 1.6 - g, 0.95, 0.7, k.scarf, { bias: -1 });
  c.part();
  c.capsule(cx + 1.8, 16.4 + U, ex, ey, 1.05, 0.8, k.scarf);
  c.shade(Math.round(ex), Math.round(ey), -2);
  c.shade(Math.round(ex + 1.8 + g), Math.round(ey - 1.6 - g), -2);
  c.part();
  c.ellipse(cx + 1.8, 16.1 + U, 1.2, 1.0, k.scarf, { bias: 1 });
}

/** Her scarf in profile: round her neck, the tails streaming out behind her. */
function scarfSide(c: PixelCanvas, hx: number, U: number, p: Pose): void {
  const k = S.elf!;
  const g = p.gust ?? 0;
  const sw = p.sway;
  const wave = Math.sin(sw * 2.2) * 0.7;
  for (const [dy, len, bias] of [[-0.4, 1, -1], [0.8, 0.85, 0]] as const) {
    const x1 = hx + 2.4 + (2.8 + sw * 0.6 + g * 1.4) * len;
    const y1 = 15.6 + U + dy + 0.6 - g * 0.6 + wave;
    const x2 = hx + 2.4 + (5.8 + sw + g * 3) * len;
    const y2 = 16.8 + U + dy - g * 1.6 - wave;
    c.part();
    c.capsule(hx + 2, 15.2 + U + dy, x1, y1, 1.0, 0.85, k.scarf, { bias });
    c.capsule(x1, y1, x2, y2, 0.85, 0.65, k.scarf, { bias });
    c.shade(Math.round(x2), Math.round(y2), -2);
  }
  c.part();
  c.shape(14 + U, 15 + U, () => [hx - 2.6, hx + 2.4], k.scarf, (_x, _y, t, u) => sphere(t * 0.9 - 0.1, u - 0.5, 1));
  c.shade(hx - 1, 15 + U, -1);
}

/** Her scarf from behind: round her neck, its tails hanging down her back. */
function scarfBack(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const k = S.elf!;
  const g = p.gust ?? 0;
  const sw = p.sway * 0.8 + g * 3;
  c.part();
  c.capsule(cx - 1.4, 15.6 + U, cx - 1 + sw * 0.8, 21.6 + U - g * 3, 1.0, 0.75, k.scarf, { bias: -1 });
  c.capsule(cx - 0.2, 15.6 + U, cx + 0.6 + sw, 22.6 + U - g * 3.6, 1.05, 0.8, k.scarf);
  c.shade(Math.round(cx + 0.6 + sw), Math.round(22.6 + U - g * 3.6), -2);
  c.part();
  c.shape(14 + U, 15 + U, (y) => (y === 14 + U ? [cx - 2.8, cx + 2.8] : [cx - 3.5, cx + 3.5]), k.scarf, (_x, _y, t, u) => sphere(t * 0.9, u - 0.5, 1));
}

/** Her back from behind: the silk tunic, the leathers laced over it, the belt. */
function torsoBack(c: PixelCanvas, cx: number, top: number, waist: number): void {
  c.part();
  c.shape(top, waist, (y) => {
    const hw = tunicWidth(y, top, waist, 4.4);
    return [cx - hw, cx + hw];
  }, S.tunic, (_x, y, t) => sphere(t * 0.9, ((y - top) / (waist - top)) * 0.8 - 0.35, 1));
  if (!S.elf) return;
  c.part();
  c.shape(top + 1, waist - 1, (y) => {
    const hw = tunicWidth(y, top, waist, 4.4) - 0.4;
    return [cx - hw, cx + hw];
  }, S.jerkin, (_x, y, t) => sphere(t * 0.9, ((y - top) / (waist - top)) * 0.8 - 0.3, 1));
  for (let y = top + 2; y < waist; y++) c.shade(cx - 1 + (y & 1), y, -2);
  c.part();
  c.shape(waist, waist, () => [cx - 4.2, cx + 4.2], LEATHER, (_x, _y, t) => cyl(t, 0));
}

/** A leaf drifting on the wind, two or three pixels, catching the light. */
function leaf(c: PixelCanvas, x: number, y: number): void {
  const m = S.elf!.leaf;
  c.part();
  c.px(x, y, m, sphere(-0.4, -0.5), { bias: 1 });
  c.px(x + 1, y, m, sphere(0.2, -0.3));
  c.px(x + 1, y + 1, m, sphere(0.4, 0.3), { bias: -1 });
  c.spark(x, y, S.light[1], 0.3);
}

// ---------------------------------------------------------------------------
// Directions
// ---------------------------------------------------------------------------
// Directions

const REACH_FRONT = 4.4;
const REACH_SIDE = 5.2;

/** The tunic's outline: broad at the chest, nipped at the belt, a short skirt below. */
function tunicWidth(y: number, top: number, waist: number, chest: number): number {
  if (y <= waist) {
    const u = (y + 0.5 - top) / (waist - top);
    return chest - 0.5 * u * u;
  }
  return chest - 0.4 + (y - waist) * 0.35;
}

function drawDown(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const air = p.air ?? 0;
  const fa = place('down', 'a', p.a, U, cx);
  const fb = place('down', 'b', p.b, U, cx);
  const xr = p.xb && place('down', 'a', p.xb.r, U, cx);
  const xf = p.xb && place('down', 'a', p.xb.f, U, cx);
  // An arrow in the draw hand goes under the fist.
  const armA = () => {
    if (p.shaft !== undefined && !p.shaftBehind) heldArrow(c, fa, p.shaft, p.grip ?? 0);
    arm(c, 7.4, 16.4 + U, fa, REACH_FRONT, [-0.5, 1], false, fa.behind ? -1 : 0);
  };
  const armB = () => arm(c, 16.6, 16.4 + U, fb, REACH_FRONT, [0.5, 1], true, fb.behind ? -1 : 0);
  // The weapon goes behind him when it's held out behind, or the bow hand is.
  const behind = xf ? xf.behind : fb.behind;
  const weapon = (bias: number) => drawWeapon(c, 'down', p, fa, fb, bias, xr, xf);
  // Everything above the collar, drawn nudged by the pose's head offset.
  const head = (draw: () => void) => {
    c.offset(BODY_X + (p.headX ?? 0), BODY_Y + (p.headY ?? 0));
    draw();
    c.offset(BODY_X, BODY_Y);
  };

  if (S.arb) {
    // The pavise's bare boards behind him, wider than his shoulders.
    paviseInside(c, cx, U, L);
  } else {
    // The quiver's fletchings peek over his right shoulder.
    fletchings(c, 7.4, 12.6 + U, -0.4);
    // An arrow being drawn from it (or slid home) rises out of the quiver, behind him.
    if (p.shaft !== undefined && p.shaftBehind) heldArrow(c, fa, p.shaft, p.grip ?? 0);
    c.part();
    c.capsule(6.9, 13.8 + U, 8.2, 13.8 + U, 0.8, 0.8, S.wrap ?? LEATHER);
  }
  if (S.elf) tailFront(c, cx, U, p);
  else if (!S.arb) {
    // The cloak hangs behind him, showing at his sides.
    c.part();
    c.shape(15 + U, 26 + L, (y) => {
      const u = (y - 15 - U) / (11 + L - U);
      const hw = 5.0 + u * 1.3;
      const sw = u * p.sway;
      return [cx - hw + sw, cx + hw + sw];
    }, S.cloak, (_x, _y, t, u) => sphere(t * 0.9, u * 0.4, 1), { bias: -1 });
  }
  if (fa.behind) armA();
  if (fb.behind) armB();
  if (behind && !p.xb) weapon(-1);

  leg(c, 10.2, 24.5 + L, 10, 28.4 - p.footA - air);
  leg(c, 13.8, 24.5 + L, 14, 28.4 - p.footB - air);
  boot(c, 10, 29.6 - p.footA - air);
  boot(c, 14, 29.6 - p.footB - air);

  // The tunic, its skirt split at the front.
  const top = 15 + U;
  const waist = 22 + U;
  const hem = 25 + L;
  c.part();
  c.shape(top, hem, (y) => {
    const hw = tunicWidth(y, top, waist, 4.4);
    return [cx - hw, cx + hw];
  }, S.tunic, (_x, y, t) => sphere(t * 0.9, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.25, 1));
  for (let y = waist + 1; y <= hem; y++) c.shade(cx, y, -2);
  if (S.scarecrow) {
    overallsFront(c, cx, top, waist, hem);
  } else {
    // The jerkin over the chest, laced at a V-neck (the brigandine closes high, studded to the collar).
    c.part();
    c.shape(top + 1, waist - 1, (y) => {
      const hw = tunicWidth(y, top, waist, 4.4) - 0.3;
      return [cx - hw, cx + hw];
    }, S.jerkin, (_x, y, t) => sphere(t * 0.9, ((y - top) / (waist - top)) * 0.8 - 0.3, 1));
    if (!S.arb) {
      for (let y = top + 1; y <= top + 3; y++) {
        const v = 1.6 - (y - top - 1) * 0.6;
        for (let x = Math.round(cx - v); x < Math.round(cx + v); x++) c.erase(x, y);
      }
      c.px(cx - 1, top + 3, S.metal, sphere(-0.3, -0.3));
    }
    for (let y = top + 4; y < waist; y++) c.shade(cx, y, -1);
    // Belt and buckle.
    c.part();
    c.shape(waist, waist, () => [cx - 4.2, cx + 4.2], LEATHER, (_x, _y, t) => cyl(t, 0));
    c.part();
    c.px(cx, waist, S.metal, sphere(0, -0.3));
  }
  if (S.arb) boltCase(c, cx + 4.8, 21 + U);
  // The quiver strap across his chest, right shoulder to left hip (a length of rope on the
  // scarecrow, the pavise's strap on the arbalest).
  c.part();
  c.capsule(8.2, 15.4 + U, 15.4, 21.4 + U, 0.55, 0.55, S.scarecrow?.rope ?? LEATHER);

  if (S.elf) scarfFront(c, cx, U, p);
  else cowl(c, cx, U, 5.8, 5.8, S.scarecrow ? S.tunic : S.cloak);
  // The crossbow on his shoulder: over his body, under his head.
  if (p.xb) weapon(0);

  if (S.scarecrow) {
    head(() => {
      sackFront(c, cx, U, p.blink);
      hatFront(c, cx, U - 1, 1);
      crow(c, cx + 4.6, 7 + U, 1);
    });
  } else if (S.hunt) {
    head(() => {
      antlers(c, cx, U);
      skullFront(c, cx, U, p.blink);
    });
  } else if (S.arb) {
    head(() => kettleFront(c, cx, U, p));
  } else if (S.elf) {
    head(() => elfFront(c, cx, U, p));
  } else {
    // Head: the hood, a face in its shadow, a fringe of hair under its edge.
    head(() => {
      c.part();
      c.ellipse(cx, 11.3 + U, 3.9, 3.7, S.cloak, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
      c.part();
      c.px(cx - 1, 7 + U, S.cloak, sphere(-0.3, -0.8));
      if (S.trim) {
        c.part();
        c.ellipse(cx, 12.5 + U, 2.95, 2.75, S.trim);
      }
      c.part();
      c.ellipse(cx, 12.7 + U, 2.5, 2.3, SKIN);
      c.part();
      c.shape(10 + U, 10 + U, () => [cx - 2.5, cx + 2.5], S.hair, (_x, _y, t) => sphere(t * 0.8, -0.3, 1));
      c.px(cx - 3, 11 + U, S.hair, sphere(-0.6, 0.2));
      c.px(cx + 1, 11 + U, S.hair, sphere(0.2, 0), { bias: -1 });
      // The hood's shadow across the brow, the eyes under it.
      for (let x = cx - 2; x <= cx + 1; x++) c.shade(x, 11 + U, -1);
      eyes(c, [[cx - 2, 12 + U], [cx + 1, 12 + U]], p.blink);
      c.shade(cx - 1, 14 + U, -1);
    });
  }

  if (!fb.behind) armB();
  if (!behind && !p.xb) weapon(0);
  if (!fa.behind) armA();

  if (p.leaf && S.elf) {
    // A leaf on the wind, and her breath carrying it off.
    leaf(c, p.leaf[0], p.leaf[1]);
    if ((p.gust ?? 0) > 0.8) {
      for (let i = 0; i < 6; i++) {
        const u = i / 6;
        const wx = 11 + (p.leaf[0] - 11) * u;
        const wy = 14 + U + (p.leaf[1] - 14 - U) * u + Math.sin(u * Math.PI) * 1.5;
        c.spark(wx, wy, S.light[i % 2 ? 2 : 1], 0.45 * (1 - u * 0.5));
      }
    }
  }
}

function eyes(c: PixelCanvas, pts: [number, number][], blink: boolean | undefined): void {
  c.part();
  for (const [i, [x, y]] of pts.entries()) {
    if (blink || (winking && i === pts.length - 1 && pts.length > 1)) c.px(x, y, SKIN, sphere(0, -0.3), { bias: -1 });
    else {
      c.px(x, y, S.eye);
      if (S.crackle) c.spark(x, y, S.crackle[1], 0.5);
    }
  }
}

function drawUp(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const air = p.air ?? 0;
  const fa = place('up', 'a', p.a, U, cx);
  const fb = place('up', 'b', p.b, U, cx);
  const xr = p.xb && place('up', 'a', p.xb.r, U, cx);
  const xf = p.xb && place('up', 'a', p.xb.f, U, cx);
  const armA = () => arm(c, 7.4, 16.4 + U, fa, REACH_FRONT, [-0.5, 0.8], false, fa.behind ? -1 : 0);
  const armB = () => arm(c, 16.6, 16.4 + U, fb, REACH_FRONT, [0.5, 0.8], true, fb.behind ? -1 : 0);
  const behind = xf ? xf.behind : fb.behind;
  const weapon = (bias: number) => drawWeapon(c, 'up', p, fa, fb, bias, xr, xf);
  if (fa.behind) armA();
  if (fb.behind) armB();
  if (behind) weapon(-1);

  leg(c, 10.2, 24.5 + L, 10, 28.4 - p.footB - air);
  leg(c, 13.8, 24.5 + L, 14, 28.4 - p.footA - air);
  boot(c, 10, 29.6 - p.footB - air);
  boot(c, 14, 29.6 - p.footA - air);

  // The tunic's skirt below the cloak.
  const top = 15 + U;
  const waist = 22 + U;
  c.part();
  c.shape(waist - 1, 25 + L, (y) => {
    const hw = tunicWidth(y, top, waist, 4.4);
    return [cx - hw, cx + hw];
  }, S.scarecrow ? S.jerkin : S.tunic, (_x, _y, t) => sphere(t * 0.9, 0.25, 1));

  if (S.arb || S.elf) {
    // No cloak: the back of the tunic (and her leathers), then his pavise over it, or her quiver.
    torsoBack(c, cx, top, waist);
    if (S.arb) {
      boltCase(c, cx - 4.6, 21 + U);
      paviseFace(c, cx, U, L);
      cowl(c, cx, U, 5.8, 5.8);
      kettleBack(c, cx, U, p);
    } else {
      quiver(c, 16.2, 13.4 + U, 10.8, 22 + U);
      scarfBack(c, cx, U, p);
      elfBack(c, cx, U, p);
    }
    if (!fb.behind) armB();
    if (!behind) weapon(0);
    if (!fa.behind) armA();
    return;
  }

  // The cloak down his back to the knees, swinging.
  const hem = 26 + L;
  c.part();
  c.shape(14 + U, hem, (y) => {
    const u = (y - 14 - U) / (hem - 14 - U);
    const hw = 4.6 + u * 1.4;
    const sw = u * p.sway;
    return [cx - hw + sw, cx + hw + sw];
  }, S.cloak, (_x, _y, t, u) => sphere(t * 0.9, u * 0.6 - 0.3, 1));
  for (let y = 18 + U; y <= hem; y++) {
    const u = (y - 14 - U) / (hem - 14 - U);
    c.shade(Math.round(cx - 2 + u * p.sway), y, -1);
    c.shade(Math.round(cx + 2 + u * p.sway), y, -1);
  }
  for (let x = cx - 7; x <= cx + 7; x++) {
    if (!c.filled(x, hem)) continue;
    if (S.trim) c.px(x, hem, S.trim, sphere(0, 0.4));
    else if ((x & 1) === 0) c.erase(x, hem);
  }

  // An old coat, patched where the crows have pecked at it.
  if (S.scarecrow) patch(c, cx - 4, 21 + U, 2, 3);
  // The quiver slung across the cloak, its mouth at his right shoulder.
  quiver(c, 16.2, 13.4 + U, 10.8, 22 + U);

  cowl(c, cx, U, 5.8, 5.8);
  if (S.scarecrow) {
    sackBack(c, cx, U);
    hatFront(c, cx, U - 1, -1);
    crow(c, cx - 4.6, 7 + U, -1, true);
  } else if (S.hunt) {
    // Long hair down his back over the ruff, the skull's crown above it, the antlers over all.
    c.part();
    c.ellipse(cx, 11.6 + U, 3.6, 3.4, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 1) });
    c.part();
    c.shape(14 + U, 19 + U, (y) => {
      const hw = 2.6 - (y - 14 - U) * 0.3;
      return [cx - hw, cx + hw];
    }, S.hair, (x, _y, t, u) => sphere(t * 0.8, u * 0.5 - 0.2 + (x & 1 ? 0.15 : -0.15), 1));
    for (let y = 15; y <= 19; y++) c.shade(cx - 1 + (y & 1), y + U, -1);
    c.part();
    c.ellipse(cx, 9.6 + U, 3.0, 1.7, S.hunt.skull, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.4, 1) });
    antlers(c, cx, U);
  } else {
    // The back of the hood, drawn to a point.
    c.part();
    c.ellipse(cx, 11.4 + U, 3.9, 3.7, S.cloak, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 1) });
    c.part();
    c.shape(14 + U, 17 + U, (y) => {
      const hw = 1.6 - (y - 14 - U) * 0.45;
      return hw < 0.3 ? null : [cx - hw, cx + hw];
    }, S.cloak, (_x, _y, t, u) => sphere(t * 0.8, u * 0.6, 1));
    c.shade(cx, 9 + U, 1);
  }

  if (!fb.behind) armB();
  if (!behind) weapon(0);
  if (!fa.behind) armA();
}

/** Facing left. Right-facing frames are mirrored from these. */
function drawSide(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const hx = cx - p.lean; // upper body centre
  const air = p.air ?? 0;
  const fa = place('side', 'a', p.a, U, hx);
  const fb = place('side', 'b', p.b, U, hx);
  const xr = p.xb && place('side', 'a', p.xb.r, U, hx);
  const xf = p.xb && place('side', 'a', p.xb.f, U, hx);
  const weapon = () => drawWeapon(c, 'side', p, fa, fb, 0, xr, xf);

  const top = 14 + U;
  const hem = 26 + L;
  if (S.arb) {
    // The pavise across his back, the bolt case at his hip.
    paviseSide(c, hx, U, L);
    boltCase(c, hx + 3.2, 20 + U, -1);
  } else {
    // The quiver on his back, fletchings over the shoulder.
    quiver(c, hx + 3.2, 12.6 + U, hx + 1.4, 21.4 + U, -1);
  }
  if (!S.arb && !S.elf) {
    // The cloak hanging behind him, streaming out as he goes.
    c.part();
    c.shape(top, hem, (y) => {
      const u = (y - top) / (hem - top);
      return [hx + 0.6, hx + 3.6 + u * (1.4 + p.sway)];
    }, S.cloak, (_x, _y, t, u) => sphere(t * 0.9 + 0.1, u * 0.5 - 0.2, 1), { bias: -1 });
    if (S.trim) for (let y = top + 2; y <= hem; y++) {
      const u = (y - top) / (hem - top);
      c.px(Math.round(hx + 3.6 + u * (1.4 + p.sway)) - 1, y, S.trim, sphere(0.5, 0), { bias: -1 });
    }
  }

  // Far arm behind everything; the bow it carries low goes behind him too.
  arm(c, hx + 1.2, 16.6 + U, fb, REACH_SIDE, [0.3, 1], true, -1);

  // Legs: back leg in shade first, then the front leg. Off the ground, the knees draw up.
  const lift = (f: number) => Math.max(0, f) * 0.35;
  const tuck = air > 0 ? 0.6 : 1;
  leg(c, cx + 0.8, 24.5 + L, cx + 1 - p.footB * tuck, 28.4 - lift(p.footB) - air, -1);
  boot(c, cx + 0.4 - p.footB * tuck, 29.7 - lift(p.footB) - air, true, -1);
  leg(c, cx - 0.6, 24.5 + L, cx - 0.4 - p.footA * tuck, 28.4 - lift(p.footA) - air);
  boot(c, cx - 1.2 - p.footA * tuck, 29.7 - lift(p.footA) - air, true);

  // The tunic in profile, the jerkin over it.
  const ttop = 15 + U;
  const waist = 22 + U;
  const skirt = 25 + L;
  c.part();
  c.shape(ttop, skirt, (y) => {
    const u = y <= waist ? 0 : (y - waist) / (skirt - waist);
    const shift = y <= waist ? hx : hx + (cx - hx) * u;
    const hw = tunicWidth(y, ttop, waist, 3.1);
    return [shift - hw - 0.2, shift + hw + 0.2];
  }, S.tunic, (_x, y, t) => sphere(t * 0.9 - 0.1, y <= waist ? ((y - ttop) / (waist - ttop)) * 0.8 - 0.35 : 0.25, 1));
  if (S.scarecrow) overallsSide(c, hx, cx, ttop, waist, skirt);
  else {
    c.part();
    c.shape(ttop + 1, waist - 1, (y) => {
      const hw = tunicWidth(y, ttop, waist, 3.1) - 0.2;
      return [hx - hw - 0.2, hx + hw];
    }, S.jerkin, (_x, y, t) => sphere(t * 0.9 - 0.1, ((y - ttop) / (waist - ttop)) * 0.8 - 0.3, 1));
    c.part();
    c.shape(waist, waist, () => [hx - 3.1, hx + 3.1], LEATHER, (_x, _y, t) => cyl(t, 0));
    c.part();
    c.px(Math.round(hx - 3.1), waist, S.metal, sphere(-0.5, -0.3));
  }
  // The quiver strap down the chest.
  c.part();
  c.capsule(hx + 1.8, 15.2 + U, hx - 2.4, 21.6 + U, 0.55, 0.55, S.scarecrow?.rope ?? LEATHER);

  if (S.elf) scarfSide(c, hx, U, p);
  else cowl(c, hx, U, 4.2, 4.4, S.scarecrow ? S.tunic : S.cloak);

  if (S.scarecrow) {
    scarecrowSide(c, hx, U, p.blink, p.sway);
  } else if (S.arb) {
    // The crossbow on his shoulder goes behind his head; raised, it's out before him.
    if (p.xb) weapon();
    kettleSide(c, hx, U, p);
    if (!p.xb) weapon();
    arm(c, hx + 0.2, 16.8 + U, fa, REACH_SIDE, [0.4, 1], false);
    return;
  } else if (S.elf) {
    elfSide(c, hx, U, p);
  } else if (S.hunt) {
    // The far antler, then his hair streaming back, his face, the skull over
    // it with its snout thrust forward, and the near antler.
    const k = S.hunt;
    const beam = (dx: number): [number, number][] => [[hx + dx - 0.4, 9 + U], [hx + dx + 0.6, 6 + U], [hx + dx + 2.2, 3.4 + U], [hx + dx + 4, 1.8 + U]];
    const tines = (dx: number): [number, number, number, number][] => [
      [hx + dx + 0.3, 7 + U, hx + dx - 1.8, 5.4 + U],
      [hx + dx + 1.4, 4.4 + U, hx + dx + 0.2, 2 + U],
      [hx + dx + 2.6, 3 + U, hx + dx + 3, 0.8 + U],
    ];
    antler(c, beam(1.6), tines(1.6), -1);
    c.part();
    c.ellipse(hx + 1, 12 + U, 2.8, 3.1, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.2, dy * 0.8, 1) });
    c.part();
    c.capsule(hx + 2.4, 12.5 + U, hx + 3.6 + p.sway * 0.4, 18 + U, 1.4, 0.8, S.hair);
    c.part();
    c.ellipse(hx - 1.4, 12.8 + U, 2.2, 2.2, SKIN, { bias: -1 });
    c.part();
    c.ellipse(hx - 0.6, 10.6 + U, 2.9, 1.9, k.skull);
    c.part();
    c.capsule(hx - 2.4, 11.4 + U, hx - 5.2, 12.8 + U, 1.3, 0.75, k.skull);
    c.shade(hx - 5, 13 + U, -1);
    c.shade(hx - 3, 11 + U, -2);
    c.shade(hx - 2, 11 + U, -2);
    eyes(c, [[hx - 3, 12 + U]], p.blink);
    antler(c, beam(0), tines(0));
  } else {
    // Head: the hood in profile, the face peeking out of it.
    c.part();
    c.ellipse(hx + 0.4, 11.4 + U, 3.4, 3.6, S.cloak, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.2, dy * 0.8 - 0.1, 1) });
    c.part();
    // The hood's tail hanging down the back of the neck.
    c.capsule(hx + 2.8, 12.5 + U, hx + 3.6 + p.sway * 0.3, 15.2 + U, 1.1, 0.6, S.cloak);
    if (S.trim) {
      c.part();
      c.ellipse(hx - 1.3, 12.6 + U, 2.6, 2.5, S.trim);
    }
    c.part();
    c.ellipse(hx - 1.4, 12.8 + U, 2.2, 2.2, SKIN);
    c.part();
    c.px(hx - 4, 12.6 + U, SKIN, sphere(-0.7, -0.1), { bias: 1 });
    c.shade(hx - 3, 14 + U, -1);
    // Hair spilling from the hood's edge over the brow and down behind the ear.
    c.part();
    c.shape(10 + U, 10 + U, () => [hx - 3.4, hx + 0.4], S.hair, (_x, _y, t) => sphere(t * 0.8, -0.3, 1));
    c.px(hx - 0.2, 11 + U, S.hair, sphere(0.3, 0.2));
    c.px(hx, 12 + U, S.hair, sphere(0.4, 0.4), { bias: -1 });
    c.part();
    // The hood's peak over the brow.
    c.shape(8 + U, 9 + U, (y) => [hx - 3.6 + (9 + U - y) * 0.8, hx + 3], S.cloak, (_x, _y, t, u) => sphere(t * 0.9, u - 0.7, 1));
    eyes(c, [[hx - 3, 12 + U]], p.blink);
  }

  // The bow is held out ahead of him, raised or carried.
  weapon();
  // Near shoulder and the draw arm.
  arm(c, hx + 0.2, 16.8 + U, fa, REACH_SIDE, [0.4, 1], false);
}

// ---------------------------------------------------------------------------
// Animations

/** The bow carried low at his side, the draw hand loose. */
const CARRY_A = H(0.8, 4.2, -3.4);
const CARRY_B = H(1.6, 4.6, -3.0);
/** From the side the bow hand rides a little ahead, so the bow shows in front of him. */
const CARRY_B_SIDE = H(3.2, 0, -2.6);

const base = (view: View): Pose => ({
  lift: 0,
  breath: 0,
  footA: view === 'side' ? 1 : 0,
  footB: view === 'side' ? -1 : 0,
  lean: 0,
  a: { ...CARRY_A },
  b: view === 'side' ? { ...CARRY_B_SIDE } : { ...CARRY_B },
  raised: false,
  nock: false,
  draw: 0,
  glint: 0,
  sway: 0,
});

/** Standing easy, the cloak stirring. */
function idle(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = (f / N) * Math.PI * 2;
    const p = base(view);
    p.breath = Math.sin(ph) > 0.5 ? 1 : 0;
    p.b.h += Math.sin(ph) * 0.3;
    p.a.h += Math.sin(ph) * 0.4;
    p.sway = Math.sin(ph - 1) * 0.6;
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
      p.sway = 1 + Math.abs(s) * 0.9;
    } else {
      p.footA = s > 0.3 ? 1 : 0;
      p.footB = s < -0.3 ? 1 : 0;
      p.sway = s * 0.8;
    }
    // The bow stays steady at his side; the free hand swings.
    p.b = view === 'side' ? H(3.2 - s * 0.4, 0, -2.6 + p.lift * 0.4) : H(1.6 - s * 0.5, 4.6, -3 + p.lift * 0.4);
    p.a = H(0.8 + s * 1.6, 4.2, -3.4 + p.lift * 0.4);
    frames.push(p);
  }
  return frames;
}

interface Key {
  a: Hand;
  b: Hand;
  /** Side-view hands, where the front pose doesn't carry over. */
  aSide?: Hand;
  bSide?: Hand;
  nock?: boolean;
  draw?: number;
  glint?: number;
  lean?: number;
  breath?: number;
  step?: number;
  /** The crossbow's own line (see Pose.xb), front and side. */
  xb?: { r: Hand; f: Hand };
  xbSide?: { r: Hand; f: Hand };
  crank?: boolean;
  net?: boolean;
  fan?: boolean;
  /** Down on his haunches, px. */
  crouch?: number;
  /** Up in a leap, px, and the feet tucked up under her beyond that. */
  jump?: number;
  tuck?: number;
  gust?: number;
}

/** An action as keyframes, the bow raised throughout; anything left out stays at rest. */
function action(keys: Key[]) {
  return (view: View): Pose[] =>
    keys.map((k) => {
      const p = base(view);
      p.a = { ...(view === 'side' && k.aSide ? k.aSide : k.a) };
      p.b = { ...(view === 'side' && k.bSide ? k.bSide : k.b) };
      const xb = view === 'side' ? (k.xbSide ?? k.xb) : k.xb;
      if (xb) p.xb = { r: { ...xb.r }, f: { ...xb.f } };
      p.crank = k.crank;
      p.net = k.net;
      p.fan = k.fan;
      p.gust = k.gust;
      p.raised = true;
      p.nock = k.nock ?? false;
      p.draw = k.draw ?? 0;
      p.glint = k.glint ?? 0;
      p.breath = k.breath ?? 0;
      if (k.crouch) p.lift = -k.crouch;
      if (k.jump) {
        p.lift = k.jump;
        p.air = k.jump + (k.tuck ?? 0);
      }
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

/** Bow arm straight out ahead. */
const AIM_B = H(5.5, 0.6, 2);
/** The shot: nock, draw to the jaw, loose, the hand flying back past the ear. */
const shoot = action([
  { a: H(4.2, 0.6, 1.8), b: AIM_B, nock: true, draw: 0.1, step: 1 },
  { a: H(1.8, 0.9, 2.6), b: AIM_B, nock: true, draw: 0.55, step: 1 },
  { a: H(-0.5, 1.2, 3.2), b: AIM_B, nock: true, draw: 1, step: 1, lean: -1 },
  { a: H(-2.2, 2.4, 3.8), b: H(6, 0.6, 2.2), step: 1, lean: 0 },
  { a: H(-1.2, 2.8, 1.5), b: H(5.2, 0.8, 1.2), step: 1 },
]);

/**
 * The volley: the bow raised to the sky, drawn slowly while the arrowhead
 * gathers light, loosed straight up; the rain comes down where he aimed.
 */
const SKY_B = H(1.8, 0.6, 12);
const SKY_B_SIDE = H(2.9, 0, 9.8);
const volley = action([
  { a: H(1.6, 0.8, 9), b: SKY_B, aSide: H(2, 0, 7), bSide: SKY_B_SIDE, nock: true, draw: 0.15, breath: 1 },
  { a: H(1.2, 0.9, 8), b: SKY_B, aSide: H(1, 0, 6.2), bSide: SKY_B_SIDE, nock: true, draw: 0.5, glint: 0.3 },
  { a: H(0.6, 1.0, 7.2), b: SKY_B, aSide: H(0, 0, 5.5), bSide: SKY_B_SIDE, nock: true, draw: 1, glint: 0.6, lean: -1 },
  { a: H(0.6, 1.0, 7.2), b: SKY_B, aSide: H(0, 0, 5.5), bSide: SKY_B_SIDE, nock: true, draw: 1, glint: 1, lean: -1 },
  { a: H(-0.4, 2.6, 8.4), b: H(1.8, 0.6, 12.6), aSide: H(-1.6, 0, 6.6), bSide: H(3, 0, 10.4), lean: -1 },
  { a: H(-0.2, 3.0, 5), b: H(2.4, 0.8, 9), aSide: H(-1, 0, 3.5), bSide: H(4, 0, 6), lean: 0 },
  { a: H(0.4, 3.6, 0), b: H(3.4, 1.4, 3), aSide: H(0, 0, 0), bSide: H(4.4, 0, 2.5) },
]);

// ---------------------------------------------------------------------------
// The idle moment (`rest`), facing the viewer only

/** A pose from the stand (idle frame 0) with the given changes. */
const from = (k: Partial<Pose>): Pose => ({ ...idle('down')[0], ...k });

/** Where along the shaft the hand holds an arrow to twirl it: its middle. */
const TWIRL_GRIP = 5.25;
/** How far below the nock he grips an arrow drawing it from the quiver, so the fletching shows over his fist. */
const PULL_GRIP = 3;
/** Steps in one turn of the twirl. */
const TWIRL_STEPS = 6;
const twirl = (i: number, h: number): Pose =>
  from({ a: H(2.2, 5.4 + Math.sin((i / TWIRL_STEPS) * Math.PI * 2) * 0.4, h), shaft: (i / TWIRL_STEPS) * Math.PI * 2, grip: TWIRL_GRIP });

/**
 * The ranger (and every skin of his): he reaches back over his shoulder and
 * draws an arrow from the quiver, lifts it level under his eye and sights
 * down the shaft with one eye shut to check it's true, gives it a turn to
 * look again, twirls it twice through his fingers, and slides it home.
 */
const RANGER_REST: Pose[] = [
  from({}),
  from({ a: H(0.4, 4.6, 1.5), sway: -0.2 }),
  from({ a: H(-0.6, 4.4, 5.6), sway: 0 }),
  from({ a: H(-0.6, 4.4, 10.4), shaft: Math.PI / 2, grip: PULL_GRIP, shaftBehind: true, headX: -1 }),
  from({ a: H(1, 5.8, 7.4), shaft: -0.6, headX: -1, sway: 0.3 }),
  from({ a: H(1, 6.0, 4.6), shaft: -0.04, wink: true, headX: -1, breath: 1 }),
  from({ a: H(1, 6.0, 5.0), shaft: -0.12, wink: true, headX: -1, breath: 1 }),
  twirl(0, 0.6),
  twirl(1, 0.8),
  twirl(2, 0.9),
  twirl(3, 0.8),
  twirl(4, 0.6),
  twirl(5, 0.5),
  from({ a: H(-0.6, 4.4, 9.6), shaft: Math.PI / 2, grip: PULL_GRIP, shaftBehind: true, headX: -1 }),
  from({ a: H(-0.6, 4.4, 5.4), sway: 0.3 }),
  from({ a: H(0.4, 4.4, 0), breath: 1, sway: 0.2 }),
];
const RANGER_ORDER = [0, 1, 2, 3, 4, 5, 5, 5, 6, 6, 5, 7, 8, 9, 10, 11, 12, 7, 8, 9, 10, 11, 12, 7, 13, 14, 15, 0];

function rest(view: View): Pose[] {
  return view === 'down' ? RANGER_REST : [];
}

// ---------------------------------------------------------------------------
// The arbalest's moves

/** The crossbow on his shoulder: its butt in his right hand at the chest, the prod up behind his shoulder. */
const SHOULDER = { r: H(0.6, 3.4, -0.4), f: H(-1.4, 5.6, 4.6) };
const SHOULDER_SIDE = { r: H(1.2, 0, -0.2), f: H(-1.4, 0, 4.8) };

/** A carrying pose with the crossbow on his shoulder, loaded and spanned; his other hand hangs free. */
function shouldered(view: View, p: Pose, swing = 0): Pose {
  const x = view === 'side' ? SHOULDER_SIDE : SHOULDER;
  p.xb = { r: { ...x.r }, f: { ...x.f } };
  p.a = { ...x.r };
  p.b = view === 'side' ? H(0.6 - swing * 1.8, 0, -3.6 + p.lift * 0.4) : H(0.8 - swing * 1.4, 4.4, -3.4 + p.lift * 0.4);
  p.nock = true;
  p.draw = 1;
  return p;
}

const arbIdle = (view: View): Pose[] => idle(view).map((p) => shouldered(view, p));
const arbWalk = (view: View): Pose[] => walk(view).map((p, f) => shouldered(view, p, Math.sin(((f + 0.5) / 6) * Math.PI * 2)));

/** Shouldered and aimed, the butt at his cheek: straight ahead from the front, level from the side. */
const XB_A = H(1.0, 0.8, 3.4);
const XB_B = H(5.0, -0.8, 2.8);
const XB_A_SIDE = H(0.4, 0, 3.4);
const XB_B_SIDE = H(5.4, 0, 3.0);

/** The shot: up to the cheek, a breath to aim, the hard kick of the loose. */
const fire = action([
  { a: H(1.4, 1.8, 2.4), b: H(4.0, -0.2, 1.6), aSide: H(1, 0, 2.6), bSide: H(4.4, 0, 2.0), nock: true, draw: 1, step: 1 },
  { a: XB_A, b: XB_B, aSide: XB_A_SIDE, bSide: XB_B_SIDE, nock: true, draw: 1, glint: 0.5, step: 1 },
  { a: H(0.0, 1.0, 3.9), b: H(4.0, -0.6, 3.5), aSide: H(-0.6, 0, 3.9), bSide: H(4.4, 0, 3.7), draw: 0, step: 1, lean: -1 },
  { a: H(0.6, 1.0, 3.4), b: H(4.6, -0.6, 3.0), aSide: H(0, 0, 3.4), bSide: H(5, 0, 3.1), draw: 0, step: 1 },
]);

/** The crossbow nose down, its stirrup under his foot, while he winds it. */
const XB_DOWN = { r: H(1.2, 0.8, 2.4), f: H(4.2, 0.4, -6.4) };
const XB_DOWN_SIDE = { r: H(0.6, 0, 2.0), f: H(4.0, 0, -6.6) };
/** Crank turns in one wind, and frames in it. */
const CRANK_FRAMES = 6;

/** Spanning: the stirrup set under his foot, two turns of the crank winding the string back to the nut, a bolt dropped in the groove. */
const crank = action(
  Array.from({ length: CRANK_FRAMES }, (_, i): Key => {
    const th = i * ((Math.PI * 4) / CRANK_FRAMES);
    const r = XB_DOWN.r;
    const rs = XB_DOWN_SIDE.r;
    return {
      a: H(r.f, r.s + Math.cos(th) * 1.5, r.h + Math.sin(th) * 1.5),
      b: H(2.6, -0.4, -1.6),
      aSide: H(rs.f + Math.cos(th) * 1.4, 0, rs.h + Math.sin(th) * 1.4),
      bSide: H(2.4, 0, -1.8),
      xb: XB_DOWN,
      xbSide: XB_DOWN_SIDE,
      crank: true,
      draw: (i + 1) / CRANK_FRAMES,
      nock: i === CRANK_FRAMES - 1,
      breath: i % 2,
      step: 1,
    };
  }),
);

/**
 * The net shot: he drops to one knee, shoulders the crossbow with the net
 * canister in its groove, the light gathering on its leads, and looses it
 * with a kick that rocks him back.
 */
const brace = action([
  { a: H(1.2, 1.8, 2.6), b: H(4.2, -0.2, 2.0), aSide: H(1, 0, 2.6), bSide: H(4.6, 0, 2.2), nock: true, net: true, draw: 1, crouch: 1, step: 1 },
  { a: XB_A, b: XB_B, aSide: XB_A_SIDE, bSide: XB_B_SIDE, nock: true, net: true, draw: 1, glint: 0.3, crouch: 2, step: 2 },
  { a: XB_A, b: XB_B, aSide: XB_A_SIDE, bSide: XB_B_SIDE, nock: true, net: true, draw: 1, glint: 0.7, crouch: 2, step: 2 },
  { a: XB_A, b: XB_B, aSide: XB_A_SIDE, bSide: XB_B_SIDE, nock: true, net: true, draw: 1, glint: 1, crouch: 2, step: 2 },
  { a: H(-0.4, 0.8, 4.2), b: H(3.8, -0.8, 4.0), aSide: H(-1.0, 0, 4.2), bSide: H(4.2, 0, 4.2), draw: 0, crouch: 2, step: 2, lean: -1 },
  { a: H(0.6, 0.8, 3.2), b: H(4.6, -0.8, 2.8), aSide: H(0, 0, 3.2), bSide: H(5, 0, 2.9), draw: 0, crouch: 1, step: 1 },
]);

/** A pose from the arbalest's stand (idle frame 0) with the given changes. */
const fromArb = (k: Partial<Pose>): Pose => ({ ...arbIdle('down')[0], ...k });
/** The crossbow stood on its nose before him, its butt under his hands at his chest. */
const XB_LEAN = { r: H(1.0, 1.0, 2.6), f: H(4.0, 0.6, -8.4) };
const LEAN_A = H(1.0, 1.2, 2.2);
const LEAN_B = H(1.2, -0.6, 2.8);

/**
 * The arbalest's idle moment: he swings the crossbow down off his shoulder
 * and leans on it, pushes his hat back off his brow, and gives a long,
 * jaw-cracking yawn; then tugs the hat down again and shoulders the crossbow.
 */
const ARB_REST: Pose[] = [
  fromArb({}),
  fromArb({ xb: { r: H(1, 2.4, 1.4), f: H(2.6, 3.2, -2.4) }, a: H(1, 2.4, 1.4), sway: 0.2 }),
  fromArb({ xb: XB_LEAN, a: LEAN_A, b: LEAN_B, breath: 1 }),
  fromArb({ xb: XB_LEAN, a: LEAN_A, b: H(1.8, 2.6, 8.4), hatTip: 1 }),
  fromArb({ xb: XB_LEAN, a: LEAN_A, b: H(1.6, 2.8, 9.6), hatTip: 2 }),
  fromArb({ xb: XB_LEAN, a: LEAN_A, b: H(1.4, 3.6, 5.6), hatTip: 2, yawn: true, blink: true, headY: -1 }),
  fromArb({ xb: XB_LEAN, a: LEAN_A, b: H(1.4, 3.8, 4.6), hatTip: 2, yawn: true, blink: true, headY: -1, breath: 1 }),
  fromArb({ xb: XB_LEAN, a: LEAN_A, b: H(1.8, 2.6, 9.0), hatTip: 1, breath: 1 }),
  fromArb({ xb: XB_LEAN, a: LEAN_A, b: LEAN_B }),
];
const ARB_ORDER = [0, 1, 2, 2, 2, 3, 4, 4, 5, 6, 6, 6, 5, 4, 4, 7, 8, 8, 2, 1, 0];

function arbRest(view: View): Pose[] {
  return view === 'down' ? ARB_REST : [];
}

// ---------------------------------------------------------------------------
// The windrunner's moves

/** The windrunner stands and walks as the ranger does, her scarf and hair stirring (streaming as she goes). */
const windIdle = (view: View): Pose[] => idle(view).map((p, f) => ({ ...p, gust: 0.1 + 0.1 * Math.sin((f / 6) * Math.PI * 2) }));
const windWalk = (view: View): Pose[] => walk(view).map((p) => ({ ...p, gust: 0.45 }));

/** Three arrows at once: nocked together, a quick half-draw, loosed in a fan. */
const fan = action([
  { a: H(3.6, 0.8, 2.0), b: AIM_B, nock: true, fan: true, draw: 0.3, step: 1, gust: 0.2 },
  { a: H(0.2, 1.1, 3.0), b: AIM_B, nock: true, fan: true, draw: 0.95, glint: 0.4, step: 1, lean: -1, gust: 0.3 },
  { a: H(-2.2, 2.4, 3.8), b: H(6, 0.6, 2.2), step: 1, gust: 0.6 },
  { a: H(-1.2, 2.8, 1.5), b: H(5.2, 0.8, 1.2), step: 1, gust: 0.3 },
]);

/**
 * The wind vault: a crouch, a spring backwards with her knees drawn up,
 * drawing in the air, loosing the gale at the top of the leap, and landing
 * light on her toes.
 */
const vault = action([
  { a: H(3.0, 0.8, 1.6), b: H(4.6, 0.6, 1.0), crouch: 2, gust: 0.3, lean: 1 },
  { a: H(2.0, 0.9, 2.4), b: AIM_B, nock: true, draw: 0.4, jump: 3, tuck: 2, gust: 0.8, lean: -1 },
  { a: H(0.2, 1.1, 3.0), b: AIM_B, nock: true, draw: 1, glint: 0.8, jump: 6, tuck: 4, gust: 1, lean: -1 },
  { a: H(-2.2, 2.4, 3.8), b: H(6, 0.6, 2.2), jump: 6, tuck: 3, gust: 1, lean: -1 },
  { a: H(-1.2, 2.8, 1.5), b: H(5.2, 0.8, 1.2), jump: 3, tuck: 1, gust: 0.6 },
  { a: H(0.4, 3.4, -1.0), b: H(4.0, 1.0, -0.4), crouch: 1, gust: 0.3 },
]);

/** A pose from the windrunner's stand (idle frame 0) with the given changes. */
const fromWind = (k: Partial<Pose>): Pose => ({ ...windIdle('down')[0], ...k });

/**
 * The windrunner's idle moment: a breeze gets up and she shuts her eyes to
 * it, holding out her hand; a leaf comes tumbling down out of the air into
 * her palm. She lifts it to her lips and blows, and the wind carries it off.
 */
const WIND_REST: Pose[] = [
  fromWind({}),
  fromWind({ a: H(2.0, 3.4, 2.4), gust: 0.3, leaf: [17, 0] }),
  fromWind({ a: H(2.4, 3.2, 3.6), gust: 0.4, leaf: [15.5, 3.5], blink: true }),
  fromWind({ a: H(2.6, 3.0, 4.4), gust: 0.4, leaf: [13.5, 7], blink: true }),
  fromWind({ a: H(2.6, 3.0, 4.6), gust: 0.3, leaf: [11, 10.5], blink: true }),
  fromWind({ a: H(2.6, 3.0, 4.6), gust: 0.2, leaf: [9.5, 12.8], blink: true }),
  fromWind({ a: H(2.6, 3.0, 4.6), gust: 0.1, leaf: [8.5, 14] }),
  fromWind({ a: H(2.6, 1.8, 6.0), leaf: [9.5, 12.6] }),
  fromWind({ a: H(2.6, 1.8, 6.2), leaf: [9.5, 12.4], gust: 0.3, breath: 1 }),
  fromWind({ a: H(2.6, 2.0, 6.0), leaf: [14, 9], gust: 1 }),
  fromWind({ a: H(2.4, 2.4, 5.0), leaf: [18, 5], gust: 1 }),
  fromWind({ a: H(1.6, 3.2, 3.0), leaf: [23, 1], gust: 0.7 }),
  fromWind({ a: H(1.0, 3.8, 0.4), gust: 0.4 }),
];
const WIND_ORDER = [0, 1, 2, 3, 4, 5, 6, 6, 6, 7, 8, 8, 9, 10, 11, 12, 12, 0];

function windRest(view: View): Pose[] {
  return view === 'down' ? WIND_REST : [];
}

// ---------------------------------------------------------------------------
// Frame generation

export type ArcherAnim = 'idle' | 'walk' | 'shoot' | 'volley' | 'rest' | 'fire' | 'crank' | 'brace' | 'fan' | 'vault';

export interface ArcherAnimDef {
  name: ArcherAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => Pose[];
  /** Frame indices to play in sequence, when some are held or repeated. */
  order?: readonly number[];
}

export const ARCHER_ANIMS: ArcherAnimDef[] = [
  { name: 'idle', fps: 7, loop: true, poses: idle },
  { name: 'walk', fps: 10, loop: true, poses: walk },
  { name: 'shoot', fps: 18, loop: false, poses: shoot },
  { name: 'volley', fps: 11, loop: false, poses: volley },
  { name: 'rest', fps: 9, loop: false, poses: rest, order: RANGER_ORDER },
];

export const ARBALEST_ANIMS: ArcherAnimDef[] = [
  { name: 'idle', fps: 6, loop: true, poses: arbIdle },
  { name: 'walk', fps: 9, loop: true, poses: arbWalk },
  { name: 'fire', fps: 14, loop: false, poses: fire },
  { name: 'crank', fps: 12, loop: false, poses: crank },
  { name: 'brace', fps: 12, loop: false, poses: brace },
  { name: 'rest', fps: 8, loop: false, poses: arbRest, order: ARB_ORDER },
];

export const WIND_ANIMS: ArcherAnimDef[] = [
  { name: 'idle', fps: 7, loop: true, poses: windIdle },
  { name: 'walk', fps: 11, loop: true, poses: windWalk },
  { name: 'fan', fps: 15, loop: false, poses: fan },
  { name: 'vault', fps: 20, loop: false, poses: vault },
  { name: 'rest', fps: 9, loop: false, poses: windRest, order: WIND_ORDER },
];

/** A look's moves: the ranger's (and his skins'), the arbalest's or the windrunner's. */
export const archerAnimsFor = (look: ArcherLook): ArcherAnimDef[] => (look.arb ? ARBALEST_ANIMS : look.elf ? WIND_ANIMS : ARCHER_ANIMS);

/** Frame index at which each shot is loosed. */
export const LOOSE_FRAME = { shoot: 3, volley: 4, fire: 2, brace: 4, fan: 2, vault: 3 } as const;

export interface ArcherFrame {
  key: string; // e.g. "walk_left_3"
  anim: ArcherAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawArcherFrame(dir: Dir, pose: Pose): PixelCanvas {
  const c = new PixelCanvas(ARCHER_W, ARCHER_H).offset(BODY_X, BODY_Y);
  winking = !!pose.wink;
  if (dir === 'down') drawDown(c, pose);
  else if (dir === 'up') drawUp(c, pose);
  else drawSide(c, pose);
  winking = false;
  if (S.scarecrow) plaid(c);
  if (S.arb) arbTexture(c);
  return dir === 'right' ? c.mirrored() : c;
}

export function buildArcherFrames(look: ArcherLook = RANGER_LOOK): ArcherFrame[] {
  S = look;
  const out: ArcherFrame[] = [];
  for (const a of archerAnimsFor(look)) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, index) => {
        out.push({ key: `${a.name}_${dir}_${index}`, anim: a.name, dir, canvas: drawArcherFrame(dir, pose) });
      });
    }
  }
  S = RANGER_LOOK;
  return out;
}

// ---------------------------------------------------------------------------
// Arrows in flight

/** Headings an arrow is drawn in: frame `r<i>` points i/ARROW_DIRS of a turn from screen right, clockwise. */
export const ARROW_DIRS = 16;
export const ARROW_SIZE = 15;

/** An arrow in flight along heading `i`: steel head, shaft, fletching. */
export function arrowFrame(i: number, look: ArcherLook = RANGER_LOOK): PixelCanvas {
  const c = new PixelCanvas(ARROW_SIZE, ARROW_SIZE);
  const a = (i / ARROW_DIRS) * Math.PI * 2;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const m = (ARROW_SIZE - 1) / 2 + 0.5;
  const px = (t: number, side = 0): [number, number] => [m + ux * t - uy * side, m + uy * t + ux * side];
  c.part();
  const [x0, y0] = px(-5.2);
  const [x1, y1] = px(4.2);
  c.line(x0, y0, x1, y1, look.shaft, () => sphere(-uy * 0.3, -0.4));
  c.part();
  for (const t of [-5, -3.8]) {
    for (const s of [-1, 1]) {
      const [fx, fy] = px(t - 0.4, s);
      c.px(fx, fy, look.fletch, sphere(-uy * s * 0.4, ux * s * 0.4 - 0.2));
    }
  }
  c.part();
  const [hx, hy] = px(5.6);
  const [bx, by] = px(4.6);
  c.px(bx, by, look.head, sphere(-0.3, -0.3));
  c.px(hx, hy, look.head, sphere(-0.5, -0.5), { bias: 1 });
  if (look.crackle) {
    c.spark(hx, hy, look.crackle[0], 0.8);
    const [sx, sy] = px(6.6);
    c.spark(sx, sy, look.crackle[1], 0.5);
    const [fx, fy] = px(-4.6);
    c.spark(fx, fy, look.crackle[2], 0.4);
  }
  return c;
}

/** Stuck in the ground, the head buried: `k` 0 leans left, 1 stands straight, 2 leans right. Its foot is at the bottom centre. */
export function stuckArrowFrame(k: number, look: ArcherLook = RANGER_LOOK): PixelCanvas {
  const c = new PixelCanvas(ARROW_SIZE, ARROW_SIZE);
  const lean = (k - 1) * 0.45;
  const x0 = (ARROW_SIZE - 1) / 2 + 0.5;
  const y0 = ARROW_SIZE - 1.5;
  const len = 7;
  c.part();
  c.line(x0, y0, x0 + lean * len, y0 - len, look.shaft, () => sphere(-0.3, -0.3));
  c.part();
  for (const t of [len - 1.6, len - 0.4]) {
    const x = x0 + lean * t;
    const y = y0 - t;
    c.px(x - 1, y + 0.5, look.fletch, sphere(-0.5, 0));
    c.px(x + 1, y + 0.5, look.fletch, sphere(0.5, 0));
  }
  if (look.crackle) c.spark(x0, y0, look.crackle[1], 0.6);
  return c;
}

/** A crossbow bolt in flight along heading `i`: short and stout, leather vanes, a broad steel head. */
export function boltFrame(i: number, look: ArcherLook = ARBALEST_LOOK): PixelCanvas {
  const c = new PixelCanvas(ARROW_SIZE, ARROW_SIZE);
  const a = (i / ARROW_DIRS) * Math.PI * 2;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const m = (ARROW_SIZE - 1) / 2 + 0.5;
  const px = (t: number, side = 0): [number, number] => [m + ux * t - uy * side, m + uy * t + ux * side];
  c.part();
  const [x0, y0] = px(-4.4);
  const [x1, y1] = px(3.4);
  c.line(x0, y0, x1, y1, look.shaft, () => sphere(-uy * 0.3, -0.4));
  c.part();
  for (const t of [-4.2, -3.2]) {
    for (const s of [-1, 1]) {
      const [fx, fy] = px(t, s);
      c.px(fx, fy, look.fletch, sphere(-uy * s * 0.4, ux * s * 0.4 - 0.2));
    }
  }
  c.part();
  // The head: a broad, barbed point.
  for (const s of [-1, 1]) {
    const [bx, by] = px(3.8, s * 0.9);
    c.px(bx, by, look.head, sphere(-uy * s * 0.4, ux * s * 0.4 - 0.3));
  }
  const [mx, my] = px(4.4);
  c.px(mx, my, look.head, sphere(-0.3, -0.3));
  const [hx, hy] = px(5.4);
  c.px(hx, hy, look.head, sphere(-0.5, -0.5), { bias: 1 });
  return c;
}

/** A bolt stuck in the ground, shorter than an arrow, leaning `k` 0 left, 1 straight, 2 right; its foot at the bottom centre. */
export function stuckBoltFrame(k: number, look: ArcherLook = ARBALEST_LOOK): PixelCanvas {
  const c = new PixelCanvas(ARROW_SIZE, ARROW_SIZE);
  const lean = (k - 1) * 0.45;
  const x0 = (ARROW_SIZE - 1) / 2 + 0.5;
  const y0 = ARROW_SIZE - 1.5;
  const len = 5.5;
  c.part();
  c.line(x0, y0, x0 + lean * len, y0 - len, look.shaft, () => sphere(-0.3, -0.3));
  c.part();
  for (const t of [len - 1.2, len - 0.2]) {
    const x = x0 + lean * t;
    const y = y0 - t;
    c.px(x - 1, y + 0.5, look.fletch, sphere(-0.5, 0));
    c.px(x + 1, y + 0.5, look.fletch, sphere(0.5, 0));
  }
  return c;
}

/** Stuck-arrow frame for a heading: leaning back the way it flew. */
export function stuckFrameFor(ux: number): number {
  return ux < -0.35 ? 2 : ux > 0.35 ? 0 : 1;
}
