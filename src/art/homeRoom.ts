// Indoor furniture and wall decor for the Home (see world/homeParts.ts): an
// armchair, a rocking chair and a clawfoot bath that turn four ways, a pouf, a
// cat asleep in its bed, a nightstand with its lamp, a piano, a harp, a
// spinning wheel, a globe, a telescope, a fishbowl and a coat rack; and for
// the walls a mirror, a cuckoo clock, an old map, a hanging plant, a garland
// of stars and a tapestry.
//
// Drawn the way homeProps.ts draws everything: from the high three-quarter
// view, each standing on its footprint, lit from the upper left. Only glows
// change between frames (candles, the lamp, the garland, the fish's bubbles).

import { cyl, sphere, type Material, type PixelCanvas, type RGB } from './pixel';
import { hash2, rng } from './env';
import { IRON } from './sanctum';
import {
  BOOKS, BRASS, DARKW, DIAL, FACE, GLASS, GOLD_CLOTH, LEAF, LEAF_DARK, LINEN, OAKW, PALEW, PALE_STONE, PETAL_Y, PUMPKIN, QUILT_B, QUILT_R,
  RED_PAINT, RIBBON, ROSE, SEEDS, SOOT, STEM, TERRA, TOP, TULIP_P, TULIP_Y, LAVENDER, VELVET, WAX,
  art, box, decor, drum, flame, grain, halo, mat, n3, rollTop, sized, type PropArt,
} from './homeProps';

// ---------------------------------------------------------------- Materials

const MUSTARD = mat('#1c1004', '#3a2406', '#5a3c0c', '#7c5814', '#9e741e', '#bc902c', '#d6ac42', '#eac664');
const KNIT_CREAM = mat('#2a2218', '#6c5e4c', '#94846c', '#baaa8e', '#d8cbb0', '#ece2ca', '#f8f2e2');
const KNIT_ROSE = mat('#22080e', '#4c1a24', '#72303a', '#964a52', '#b6666c', '#d0888a', '#e4aca8', '#f2cec6');
const ENAMEL: Material = { ...mat('#1e222a', '#4c5460', '#76808c', '#9ca4b0', '#bec4ce', '#d8dce2', '#eaedf1', '#fafbfc'), shine: true };
const FOAM: Material = { ...mat('#56606c', '#a4b0bc', '#c8d2da', '#e2eaf0', '#f4f8fa', '#ffffff'), noAO: true };
const BATH: Material = { ...mat('#0a2a36', '#144656', '#226476', '#348296', '#4e9eb0', '#74bcc8', '#a4dade'), noAO: true };
const GINGER = mat('#1c0a02', '#482006', '#72360c', '#985016', '#ba6a22', '#d48834', '#e8a650', '#f6c47a');
const FUR_CREAM = mat('#2a2018', '#74644c', '#a29078', '#c6b69c', '#e2d6be', '#f4ecda', '#fffaf0');
const PLUSH = mat('#0c0a1e', '#1c1a3e', '#2c2a5a', '#3e3c76', '#545292', '#6c6aac', '#8886c4', '#a6a4da');
const YARN_END: Material = { ...RIBBON, noOutline: true };
const SHADE: Material = { ...mat('#3a2410', '#86602e', '#c49656', '#e8c282', '#fadcaa', '#fff0d2'), emissive: 0.6, noAO: true };
const GLAZE: Material = { ...mat('#06141a', '#0e2a32', '#18424a', '#245a60', '#347676', '#4a928c', '#68aea2', '#92cabc'), shine: true };
const EBONY: Material = { ...mat('#030205', '#09070c', '#120e16', '#1c1620', '#26202c', '#342a3a', '#463a4e', '#5e5068'), shine: true };
const IVORY = mat('#2a261c', '#7c7462', '#aaa28c', '#cec6b0', '#e6e0ce', '#f6f2e6', '#fffdf6');
const HARP_STR: Material = { ...mat('#3a2a10', '#8e7a50', '#c4b084', '#e8d8ae', '#fff6dc'), noOutline: true, noAO: true };
const HARP_RED: Material = { ...mat('#2a0606', '#7a1a14', '#b02e22', '#d8503a', '#f47c5c'), noOutline: true, noAO: true };
const HARP_BLUE: Material = { ...mat('#06102a', '#16306a', '#26489a', '#3c66c0', '#6a90dc'), noOutline: true, noAO: true };
const BAND: Material = { ...mat('#2a2014', '#6e5e44', '#9a8866', '#c2b08a', '#ded0ac'), noOutline: true, noAO: true };
const SEA = mat('#04101e', '#0a2040', '#11305e', '#1a447e', '#28589a', '#3a72b2', '#5690c6', '#78aed8');
const LAND = mat('#141406', '#363812', '#525a1e', '#6e7a2c', '#8c963e', '#aab058', '#c6c87a');
const PARCH = mat('#2a1c0c', '#664a28', '#8a6a3e', '#ac8a56', '#c8a670', '#dec08c', '#eed8aa');
const INK_SEA = mat('#0e1418', '#3a4a4e', '#56686a', '#728684', '#8ea29a', '#a8b8a8');
const GOLDFISH: Material = { ...mat('#1e0602', '#541404', '#882608', '#b83e0e', '#dc5c18', '#f2822a', '#ffa852', '#ffd08c'), shine: true };
const AQUA: Material = { ...mat('#0e2a30', '#285860', '#468086', '#68a4a6', '#90c4c2', '#bae0da', '#e2f4f0'), noAO: true };
const FELT = mat('#0a1408', '#16260e', '#223816', '#2e4c20', '#3c602a', '#4c7636', '#5e8c44');
const PLUM = mat('#120614', '#24102a', '#381a40', '#4c2456', '#62306c', '#7a4084', '#94549c');
const LEATHER = mat('#140804', '#2c160a', '#442410', '#5c3418', '#764622', '#90582e', '#aa6c3c');
const MIRROR: Material = { ...mat('#0e1620', '#283848', '#425466', '#5e7486', '#7c94a6', '#9eb6c4', '#c4d8e2', '#eaf4f8'), noAO: true };
const STAR: Material = { ...mat('#3a2804', '#86600e', '#c89a22', '#f0c648', '#ffe48a', '#fff6cc'), emissive: 0.9, noAO: true };
const CORD = mat('#241a10', '#5e503a', '#88785a', '#b0a07e', '#d0c29e', '#e8dcbc');
const THREAD: Material = { ...mat('#10140c', '#2a3020', '#3e4630', '#525c40', '#68745a'), noOutline: true };
const WINE = mat('#140308', '#2a0810', '#400e1a', '#561626', '#6e2032', '#882c40', '#a03c50');
const BULBS: Material[] = [
  { ...mat('#3a2008', '#8a5a1a', '#d8a048', '#ffd488', '#fff0c8'), emissive: 0.95, noAO: true },
  { ...mat('#3a0a1a', '#8a2a4a', '#d85a82', '#ff9ab8', '#ffd6e4'), emissive: 0.95, noAO: true },
  { ...mat('#0a2a1a', '#1a6a4a', '#48c08a', '#8cf0c0', '#d4fff0'), emissive: 0.95, noAO: true },
];

const WARM: RGB = [255, 196, 120];

// ---------------------------------------------------------------- Helpers

/** A gentle arch rising `h` px over a top edge at screen row `y` (a chair's crest). */
function arch(c: PixelCanvas, x0: number, x1: number, y: number, h: number, m: Material): void {
  c.part();
  const mid = (x0 + x1) / 2;
  const hw = (x1 - x0) / 2;
  for (let x = x0; x < x1; x++) {
    const rise = Math.round(Math.cos(((x + 0.5 - mid) / hw) * Math.PI * 0.5) * h);
    for (let k = 1; k <= rise; k++) c.px(x, y - k, m, TOP, { bias: k === rise ? 1 : 0 });
  }
}

/** An upholstered arm running north-south, `a`..`b` across, rolled over the top, its scroll on the front. */
function arm(c: PixelCanvas, a: number, b: number, y0: number, y1: number, z0: number, z1: number, m: Material): void {
  c.part();
  const mid = (a + b) / 2;
  const hw = (b - a) / 2;
  for (let y = y0 - z1; y < y1 - z0; y++) {
    const top = y < y1 - z1;
    for (let x = a; x < b; x++) {
      const t = (x + 0.5 - mid) / hw;
      c.px(x, y, m, top ? n3(t * 0.7, 0.5, 0.7) : n3(t * 0.6, -0.35, 0.8), { bias: top && y === y0 - z1 ? 1 : 0 });
    }
  }
  c.shade(Math.floor(mid), y1 - z1 + 2, -2);
  c.shade(Math.floor(mid), y1 - z1 + 1, 1);
}

/** Red gingham: two-pixel checks shaded over whatever of `m` lies in the box. */
function gingham(c: PixelCanvas, m: Material, x0: number, x1: number, y0: number, y1: number): void {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (c.materialAt(x, y) !== m) continue;
      const a = (x >> 1) & 1;
      const b = (y >> 1) & 1;
      c.shade(x, y, a && b ? 2 : a || b ? 0 : -1);
    }
  }
}

/** A knitted throw hung over something: ribbed, a rose stripe, a fringe along its hem. */
function throwRug(c: PixelCanvas, x0: number, x1: number, top: number, fold: number, hem: number, topN: (t: number) => ReturnType<typeof n3>): void {
  c.part();
  for (let y = top; y < hem; y++) {
    const over = y < fold;
    const xa = over ? x0 + 1 : x0;
    const xb = over ? x1 - 1 : x1;
    for (let x = xa; x < xb; x++) {
      const t = ((x + 0.5 - xa) / (xb - xa)) * 2 - 1;
      const stripe = y === hem - 3 || y === hem - 5;
      c.px(x, y, stripe ? KNIT_ROSE : KNIT_CREAM, over ? topN(t) : n3(t * 0.5, -0.4, 0.8), { bias: (x - x0) % 2 ? -1 : 0 + (y === fold ? 1 : 0) });
    }
  }
  for (let x = x0; x < x1; x += 2) c.px(x, hem, KNIT_CREAM, FACE, { bias: -1 });
}

// ---------------------------------------------------------------- Armchair

const armchair = art('armchair', 2, 22, (c, g) => {
  // Facing us: a tall buttoned back with wings, rolled arms, a plump cushion,
  // a knitted cushion leant in it and a throw over its right arm.
  const x0 = g.cx - 7;
  const x1 = g.cx + 7;
  const y0 = g.y0 + 3;
  const y1 = g.y1 - 3;
  for (const x of [x0 + 1, x1 - 3]) box(c, x, x + 2, y0 + 1, y0 + 3, 0, 3, DARKW);
  box(c, x0 + 1, x1 - 1, y0, y0 + 3, 3, 20, MUSTARD);
  arch(c, x0 + 2, x1 - 2, y0 - 20, 2, MUSTARD);
  // Deep buttons in a diamond.
  for (const [dx, z] of [[-2, 11], [2, 11], [0, 14], [-2, 17], [2, 17]]) {
    c.shade(g.cx + dx, y0 + 3 - z, -2);
    c.shade(g.cx + dx, y0 + 2 - z, 1);
  }
  // Wings reaching forward from the back.
  for (const [a, out] of [[x0, x0], [x1 - 3, x1 - 1]]) {
    box(c, a, a + 3, y0 + 1, y0 + 6, 10, 19, MUSTARD);
    c.erase(out, y0 + 1 - 19);
  }
  for (const x of [x0, x1 - 2]) box(c, x, x + 2, y1 - 2, y1, 0, 3, DARKW);
  // The seat: a pleated skirt, then the cushion.
  box(c, x0 + 1, x1 - 1, y0 + 3, y1, 3, 6, MUSTARD, { bias: -1 });
  for (let x = x0 + 2; x < x1 - 1; x += 3) for (let y = y1 - 6; y < y1 - 3; y++) c.shade(x, y, -1);
  box(c, x0 + 3, x1 - 3, y0 + 3, y1 - 1, 6, 9, MUSTARD, { topBias: 1 });
  // A rose knitted cushion leant against the back.
  c.part();
  c.ellipse(g.cx + 1.5, y0 - 8.5, 2.8, 2.4, KNIT_ROSE, { bias: 1 });
  for (let y = y0 - 11; y < y0 - 6; y++) c.shade(g.cx + 1, y, -1);
  c.shade(g.cx + 1.5, y0 - 8.5, -1);
  arm(c, x0, x0 + 3, y0 + 2, y1, 3, 12, MUSTARD);
  arm(c, x1 - 3, x1, y0 + 2, y1, 3, 12, MUSTARD);
  // The throw over its right arm (our left), hanging down the front.
  throwRug(c, x0 - 1, x0 + 4, y1 - 16, y1 - 12, y1 - 5, (t) => n3(t * 0.7, 0.5, 0.7));
});

const armchairSide = sized(1, 1, 2, 22, (c, g) => {
  // Facing east: the back along the west with its wings reaching east, an arm either side.
  const x0 = g.cx - 6;
  const x1 = g.cx + 6;
  const y0 = g.y0 + 1;
  const y1 = g.y1 - 1;
  box(c, x0 + 1, x0 + 3, y0 + 1, y0 + 3, 0, 3, DARKW);
  box(c, x1 - 3, x1 - 1, y0 + 1, y0 + 3, 0, 3, DARKW);
  box(c, x0 + 2, x1, y0, y0 + 3, 3, 11, MUSTARD);
  rollTop(c, x0 + 2, x1, y0, y0 + 3, 11, MUSTARD);
  box(c, x0, x0 + 3, y0, y1, 3, 20, MUSTARD);
  for (let y = y0 - 19; y < y1 - 20; y += 4) c.shade(x0 + 1, y, -2);
  box(c, x0 + 3, x0 + 7, y0, y0 + 2, 11, 19, MUSTARD);
  box(c, x0 + 3, x1, y0 + 3, y1 - 3, 3, 6, MUSTARD, { bias: -1 });
  box(c, x0 + 3, x1 - 1, y0 + 3, y1 - 3, 6, 9, MUSTARD, { topBias: 1 });
  c.part();
  c.ellipse(x0 + 4.2, (y0 + y1) / 2 - 11, 1.6, 2.8, KNIT_ROSE, { bias: 1 });
  box(c, x0 + 1, x0 + 3, y1 - 2, y1, 0, 3, DARKW);
  box(c, x1 - 3, x1 - 1, y1 - 2, y1, 0, 3, DARKW);
  box(c, x0 + 2, x1, y1 - 3, y1, 3, 11, MUSTARD);
  rollTop(c, x0 + 2, x1, y1 - 3, y1, 11, MUSTARD);
  for (let x = x0 + 3; x < x1; x++) c.shade(x, y1 - 10, -1);
  box(c, x0 + 3, x0 + 7, y1 - 2, y1, 11, 19, MUSTARD);
  c.erase(x0 + 6, y1 - 2 - 19);
  throwRug(c, x0 + 6, x0 + 11, y1 - 14, y1 - 11, y1 - 5, () => n3(0, 0.5, 0.75));
});

const armchairBack = sized(1, 1, 2, 22, (c, g) => {
  // Its back to us: the arms and cushion beyond, the tall back plain with piping.
  const x0 = g.cx - 7;
  const x1 = g.cx + 7;
  const y0 = g.y0 + 3;
  const y1 = g.y1 - 3;
  for (const x of [x0, x1 - 2]) box(c, x, x + 2, y0, y0 + 2, 0, 3, DARKW);
  arm(c, x0, x0 + 3, y0, y1 - 2, 3, 12, MUSTARD);
  arm(c, x1 - 3, x1, y0, y1 - 2, 3, 12, MUSTARD);
  for (const x of [x0 + 1, x1 - 3]) box(c, x, x + 2, y1 - 2, y1, 0, 3, DARKW);
  // The throw spilling over the right arm's outside.
  throwRug(c, x1 - 2, x1 + 1, y1 - 16, y1 - 14, y1 - 5, () => n3(0.3, 0.5, 0.75));
  box(c, x0, x1, y1 - 3, y1, 3, 19, MUSTARD, { bias: -1 });
  arch(c, x0 + 2, x1 - 2, y1 - 3 - 19, 3, MUSTARD);
  // Piping round the wings and along the foot, seams where they join.
  for (let y = y1 - 21; y < y1 - 3; y++) {
    c.shade(x0 + 3, y, -1);
    c.shade(x1 - 4, y, -1);
  }
  for (let x = x0; x < x1; x++) {
    c.shade(x, y1 - 4, -1);
    if (x < x0 + 3 || x >= x1 - 3) c.shade(x, y1 - 12, -1);
  }
});

// ---------------------------------------------------------------- Rocking chair

/** The rockers seen end on (front and back views): two runners curling up at either end, drawn in halves round `mid`. */
function rockersEndOn(c: PixelCanvas, xs: number[], ya: number, yb: number, from: number, to: number): void {
  c.part();
  const mid = (ya + yb) / 2;
  const half = (yb - ya) / 2;
  for (const x of xs) {
    for (let y = from; y < to; y++) {
      const u = (y + 0.5 - mid) / half;
      const z = Math.round(u * u * 3);
      c.px(x, y - z - 1, OAKW, TOP, { bias: 1 });
      c.px(x + 1, y - z - 1, OAKW, TOP, { bias: 0 });
      c.px(x, y - z, OAKW, FACE, { bias: -1 });
      c.px(x + 1, y - z, OAKW, FACE, { bias: -2 });
    }
  }
}

/** A spindle back between two posts with knob finials and a crest with a heart cut through it, at ground row `y`. */
function spindleBack(c: PixelCanvas, x0: number, x1: number, y: number, bias: number): void {
  c.part();
  for (let x = x0 + 3; x < x1 - 2; x += 2) for (let z = 9; z < 20; z++) c.px(x, y - z, OAKW, FACE, { bias: (z === 12 || z === 16 ? 2 : 0) + bias });
  box(c, x0 + 1, x1 - 1, y - 1, y + 1, 19, 22, OAKW, { bias });
  arch(c, x0 + 2, x1 - 2, y - 1 - 22, 1, OAKW);
  const cx = Math.floor((x0 + x1) / 2);
  c.shade(cx - 1, y - 21, -3);
  c.shade(cx, y - 21, -3);
  c.shade(cx - 1 + 0.5, y - 20, -3);
  for (const x of [x0, x1 - 2]) {
    box(c, x, x + 2, y - 1, y + 1, 1, 24, OAKW, { bias });
    c.part();
    c.ellipse(x + 1, y - 25, 1.3, 1.2, OAKW, { bias: 1 });
  }
}

const rocker = art('rocker', 2, 28, (c, g) => {
  // Facing us: a spindle back, a gingham cushion, and the rockers curling up front and back.
  const x0 = g.cx - 6;
  const x1 = g.cx + 6;
  const y0 = g.y0 + 4;
  const y1 = g.y1 - 4;
  const ya = g.y0 + 1;
  const yb = g.y1 - 1;
  const mid = Math.round((ya + yb) / 2);
  rockersEndOn(c, [x0, x1 - 2], ya, yb, ya, mid);
  spindleBack(c, x0, x1, y0 + 1, 0);
  box(c, x0, x1, y0 + 2, y1, 7, 9, OAKW);
  box(c, x0 + 1, x1 - 1, y0 + 2, y1 - 1, 9, 11, QUILT_R, { topBias: 1 });
  gingham(c, QUILT_R, x0, x1, y0 - 12, y1);
  for (const x of [x0, x1 - 2]) box(c, x, x + 2, y1 - 2, y1, 1, 13, OAKW);
  // Armrests on the front posts, ending in a knob.
  for (const x of [x0 - 1, x1 - 2]) {
    box(c, x, x + 3, y0 + 1, y1, 13, 14, OAKW, { topBias: 1 });
    c.part();
    c.ellipse(x + 1.5, y1 - 14, 1.6, 1.1, OAKW, { bias: 1 });
  }
  rockersEndOn(c, [x0, x1 - 2], ya, yb, mid, yb);
});

const rockerSide = sized(1, 1, 4, 28, (c, g) => {
  // Facing east: the rockers' long curve, the back leaning west, the arms on their posts.
  const x0 = g.cx - 4;
  const x1 = g.cx + 4;
  const y0 = g.y0 + 4;
  const y1 = g.y1 - 4;
  const xa = g.cx - 8;
  const xb = g.cx + 8;
  const curve = (x: number) => {
    const u = (x + 0.5 - (xa + xb) / 2) / ((xb - xa) / 2);
    return Math.round(u * u * 3);
  };
  const runner = (y: number) => {
    c.part();
    for (let x = xa; x < xb; x++) {
      const z = curve(x);
      c.px(x, y - z - 1, OAKW, TOP, { bias: 1 });
      c.px(x, y - z, OAKW, FACE, { bias: -1 });
    }
    // The tips curl over.
    c.px(xa, y - curve(xa) - 2, OAKW, TOP, { bias: 2 });
    c.px(xb - 1, y - curve(xb - 1) - 2, OAKW, TOP, { bias: 2 });
  };
  const legs = (y: number, b: number) => {
    c.part();
    for (let z = curve(x0) + 1; z < 8; z++) c.px(x0, y - z, OAKW, FACE, { bias: b });
    for (let z = curve(x1 - 1) + 1; z < 14; z++) c.px(x1 - 1, y - z, OAKW, FACE, { bias: b + 1 });
    c.line(x0, y - 14, x1 - 1, y - 13, OAKW, () => TOP, { bias: b + 1 });
    c.px(x1, y - 13, OAKW, FACE, { bias: b + 2 });
  };
  runner(y0);
  legs(y0, -1);
  box(c, x0, x1, y0, y1, 7, 9, OAKW);
  box(c, x0 + 1, x1, y0 + 1, y1 - 1, 9, 11, QUILT_R, { topBias: 1 });
  gingham(c, QUILT_R, x0, x1 + 1, y0 - 12, y1);
  // The back, leaning west as it rises: spindles end on, the crest along its top.
  c.part();
  for (let z = 9; z < 24; z++) {
    const xs = x0 + 1 - Math.round((z - 9) * 0.2);
    for (let y = y0; y < y1; y++) {
      const crest = z >= 20;
      if (!crest && (y - y0) % 2 === 1) continue;
      c.px(xs, y - z, OAKW, crest ? TOP : n3(0.5, 0.2, 0.85), { bias: crest ? 1 : 0 });
      if (crest) c.px(xs - 1, y - z, OAKW, FACE, { bias: 0 });
    }
  }
  legs(y1 - 1, 0);
  c.part();
  c.line(x0, y1 - 1 - 2, x0 - 2, y1 - 1 - 24, OAKW, () => FACE, { bias: 1 });
  c.ellipse(x0 - 2, y1 - 26, 1.2, 1.2, OAKW, { bias: 1 });
  runner(y1 - 1);
});

const rockerBack = sized(1, 1, 2, 28, (c, g) => {
  // Its back to us: the spindles near, the seat and armrests beyond.
  const x0 = g.cx - 6;
  const x1 = g.cx + 6;
  const y0 = g.y0 + 4;
  const y1 = g.y1 - 4;
  const ya = g.y0 + 1;
  const yb = g.y1 - 1;
  const mid = Math.round((ya + yb) / 2);
  rockersEndOn(c, [x0, x1 - 2], ya, yb, ya, mid);
  for (const x of [x0, x1 - 2]) box(c, x, x + 2, y0, y0 + 2, 1, 13, OAKW);
  box(c, x0, x1, y0, y1 - 2, 7, 9, OAKW);
  box(c, x0 + 1, x1 - 1, y0 + 1, y1 - 2, 9, 11, QUILT_R, { topBias: 1 });
  gingham(c, QUILT_R, x0, x1, y0 - 12, y1);
  for (const x of [x0 - 1, x1 - 2]) {
    box(c, x, x + 3, y0, y1 - 1, 13, 14, OAKW, { topBias: 1 });
    c.part();
    c.ellipse(x + 1.5, y0 - 13.5, 1.6, 1.1, OAKW, { bias: 1 });
  }
  spindleBack(c, x0, x1, y1 - 1, -1);
  rockersEndOn(c, [x0, x1 - 2], ya, yb, mid, yb);
});

// ---------------------------------------------------------------- Bathtub

interface Tub {
  cx: number;
  cy: number;
  hx: number;
  hy: number;
  /** Where the taps stand on the rim: the far side, the near side or the west end. */
  taps: 'n' | 's' | 'w';
  /** The duck on the water, from the tub's centre. */
  duck: [number, number];
  /** Columns the towel hangs over the near rim. */
  towel: [number, number];
  seed: number;
}
const TUB_FOOT = 3;
const TUB_RIM = 12;

function claw(c: PixelCanvas, x: number, y: number): void {
  c.part();
  c.px(x - 0.5, y - 4, BRASS, FACE, { bias: 0 });
  c.px(x - 0.5, y - 3, BRASS, FACE, { bias: 1 });
  c.ellipse(x, y - 1.5, 1.4, 1.2, BRASS, { bias: 1 });
  c.px(x - 1.5, y, BRASS, FACE, { bias: 0 });
  c.px(x + 0.5, y, BRASS, FACE, { bias: -1 });
}

/** A brass mixer: a stem, a gooseneck spout and two cross handles with red and blue caps. */
function faucet(c: PixelCanvas, x: number, y: number, handles: [number, number][]): void {
  c.part();
  handles.forEach(([hx, hy], k) => {
    c.line(x, y - 1, hx, hy + 1, BRASS, () => FACE, { bias: 0 });
    c.px(hx - 1, hy, BRASS, FACE, { bias: 1 });
    c.px(hx + 1, hy, BRASS, FACE, { bias: -1 });
    c.px(hx, hy, BRASS, FACE, { bias: 1 });
    c.px(hx, hy - 1, k === 0 ? RED_PAINT : QUILT_B, TOP, { bias: 3 });
  });
  c.part();
  for (let k = 0; k < 5; k++) c.px(x, y - k, BRASS, cyl(-0.4), { bias: 1 });
  c.capsule(x + 0.5, y - 5, x + 1.5, y - 6.2, 0.6, 0.6, BRASS);
  c.capsule(x + 2, y - 6, x + 2.6, y - 4, 0.6, 0.5, BRASS);
  c.px(x + 2.5, y - 3, SOOT, FACE, { bias: 0 });
}

function bathtub(c: PixelCanvas, t: Tub): void {
  const r = Math.min(t.hx, t.hy);
  const inside = (dx: number, dy: number, inset = 0) => {
    const qx = Math.max(0, Math.abs(dx) - (t.hx - r));
    const qy = Math.max(0, Math.abs(dy) - (t.hy - r));
    return qx * qx + qy * qy <= (r - inset) * (r - inset);
  };
  const front = (dx: number) => {
    const qx = Math.max(0, Math.abs(dx) - (t.hx - r));
    return qx >= r ? -1 : t.hy - r + Math.sqrt(r * r - qx * qx);
  };
  const feet: [number, number][] = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => [t.cx + sx * (t.hx - 3.5), t.cy + sy * (t.hy - 2)]);
  for (const [x, y] of feet.slice(0, 2)) claw(c, x, y);
  // The tub's round side, tucked in toward its feet.
  c.part();
  for (let x = Math.floor(t.cx - t.hx); x < Math.ceil(t.cx + t.hx); x++) {
    const dx = x + 0.5 - t.cx;
    const e = front(dx);
    if (e < 0) continue;
    const q = (Math.max(0, Math.abs(dx) - (t.hx - r)) / r) * Math.sign(dx);
    for (let z = TUB_FOOT; z < TUB_RIM; z++) {
      const tuck = z < 6 ? (6 - z) * 0.8 : 0;
      if (Math.abs(dx) > t.hx - tuck) continue;
      c.px(x, Math.round(t.cy + e - z), ENAMEL, n3(q * 0.85, z < 6 ? -0.6 : -0.3, 0.8), { bias: z === TUB_RIM - 1 ? 2 : z === TUB_FOOT ? -1 : 0 });
    }
  }
  // The rolled rim, the inside wall beyond, and the water.
  c.part();
  for (let y = Math.floor(t.cy - t.hy); y < Math.ceil(t.cy + t.hy); y++) {
    for (let x = Math.floor(t.cx - t.hx); x < Math.ceil(t.cx + t.hx); x++) {
      const dx = x + 0.5 - t.cx;
      const dy = y + 0.5 - t.cy;
      if (!inside(dx, dy)) continue;
      const sy = y - TUB_RIM;
      if (!inside(dx, dy, 1.4)) c.px(x, sy, ENAMEL, TOP, { bias: dy > 0 ? 2 : 1 });
      else if (!inside(dx, dy - 2.5, 1.4)) c.px(x, sy, ENAMEL, FACE, { bias: -2 });
      else {
        const ripple = hash2(Math.floor(x / 3), y, t.seed);
        c.px(x, sy, BATH, TOP, { bias: ripple > 0.86 ? 2 : ripple < 0.12 ? -1 : 0 });
      }
    }
  }
  // Foam heaped at the far end from the duck, a few bubbles drifting.
  const R = rng(t.seed);
  const bubbles: [number, number, number][] = [];
  for (let k = 0; k < 26; k++) {
    const heap = k < 18;
    const bx = heap ? -t.duck[0] * 0.7 + (R() - 0.5) * t.hx * 0.9 : (R() - 0.5) * t.hx * 1.6;
    const by = heap ? -t.duck[1] * 0.7 + (R() - 0.5) * t.hy * 0.9 : (R() - 0.5) * t.hy * 1.4;
    if (!inside(bx, by, 2.2)) continue;
    bubbles.push([bx, by, heap ? 0.9 + R() * 0.9 : 0.5 + R() * 0.4]);
  }
  bubbles.sort((a, b) => a[1] - b[1]);
  c.part();
  for (const [bx, by, br] of bubbles) c.ellipse(t.cx + bx, t.cy + by - TUB_RIM - br * 0.6, br + 0.3, br, FOAM, { bias: br > 1.2 ? 1 : 0 });
  // The duck.
  const dx = t.cx + t.duck[0];
  const dy = t.cy + t.duck[1] - TUB_RIM - 1;
  c.part();
  c.ellipse(dx, dy, 2, 1.4, PETAL_Y, { bias: 1 });
  c.px(dx + 1.6, dy - 1, PETAL_Y, TOP, { bias: 2 });
  c.ellipse(dx - 1.2, dy - 2, 1.2, 1.1, PETAL_Y, { bias: 1 });
  c.part();
  c.px(dx - 2.8, dy - 1.8, PUMPKIN, FACE, { bias: 2 });
  c.px(dx - 1.6, dy - 2.4, SOOT, FACE, { bias: 0 });
  // The taps.
  if (t.taps === 'n') {
    const y = t.cy - t.hy + 0.8 - TUB_RIM;
    faucet(c, t.cx, y, [[t.cx - 3, y - 2], [t.cx + 3.5, y - 2]]);
  } else if (t.taps === 's') {
    const y = t.cy + t.hy - 0.8 - TUB_RIM;
    faucet(c, t.cx, y, [[t.cx - 3, y - 2], [t.cx + 3.5, y - 2]]);
  } else {
    const x = t.cx - t.hx + 0.8;
    const y = t.cy - TUB_RIM;
    faucet(c, x, y, [[x, y - 4.5], [x, y + 1.5]]);
  }
  // A striped towel over the near rim.
  c.part();
  for (let x = t.towel[0]; x < t.towel[1]; x++) {
    const e = front(x + 0.5 - t.cx);
    if (e < 0) continue;
    const yTop = Math.round(t.cy + e - 2.5 - TUB_RIM);
    const yLip = Math.round(t.cy + e - TUB_RIM);
    const yHem = Math.round(t.cy + e - 5);
    const edge = x === t.towel[0] ? 1 : x === t.towel[1] - 1 ? -1 : 0;
    for (let y = yTop; y < yHem; y++) {
      const stripe = y === yHem - 2 || y === yHem - 4;
      c.px(x, y, stripe ? QUILT_B : LINEN, y < yLip ? TOP : FACE, { bias: edge + (y === yLip ? 1 : 0) + (y === yHem - 1 ? -1 : 0) });
    }
  }
  for (const [x, y] of feet.slice(2)) claw(c, x, y);
}

const bathFront = art('bathtub', 2, 20, (c, g) => {
  // The long side toward us, the taps on the far rim.
  bathtub(c, { cx: g.cx, cy: g.y1 - 8, hx: 14, hy: 6, taps: 'n', duck: [-7, 0.5], towel: [Math.round(g.cx) + 8, Math.round(g.cx) + 12], seed: 501 });
});

const bathSide = sized(1, 2, 3, 20, (c, g) => {
  // End on, its length running away from us, the taps on its west side.
  bathtub(c, { cx: g.cx, cy: g.cy, hx: 6, hy: 13.5, taps: 'w', duck: [0.5, 6], towel: [Math.round(g.cx) - 2, Math.round(g.cx) + 2], seed: 502 });
});

const bathBack = sized(2, 1, 2, 20, (c, g) => {
  // The long side from the north, the taps on the near rim.
  bathtub(c, { cx: g.cx, cy: g.y1 - 8, hx: 14, hy: 6, taps: 's', duck: [7, -0.5], towel: [Math.round(g.cx) - 12, Math.round(g.cx) - 8], seed: 503 });
});

// ---------------------------------------------------------------- Pouf

const pouf = art('pouf', 2, 12, (c, g) => {
  // A plump knitted drum: cables twisting round its side, its top knitted in wedges to a button.
  const cx = g.cx;
  const gy = g.y1 - 7;
  const rx = 6.5;
  const ry = 4.2;
  const H = 7;
  c.part();
  const left = Math.floor(cx - rx);
  for (let x = left; x < Math.ceil(cx + rx); x++) {
    const t = (x + 0.5 - cx) / rx;
    if (Math.abs(t) >= 1) continue;
    const e = Math.sqrt(1 - t * t) * ry;
    for (let z = 0; z < H; z++) {
      const u = z / (H - 1);
      // Plumpest a little below the top, tucked in at the floor.
      if (Math.abs(t) > 0.8 + 0.2 * Math.sin(u * Math.PI * 0.85 + 0.25)) continue;
      const k = (x - left) % 4;
      const bias = k === 0 ? -2 : (z + k) % 3 === 0 ? 2 : 0;
      c.px(x, Math.round(gy + e - z), KNIT_ROSE, n3(t * 0.8, -0.55 + u * 0.75, 0.75), { bias: bias + (z === 0 ? -1 : 0) });
    }
  }
  c.part();
  const ty = gy - H + 0.6;
  c.ellipse(cx, ty, rx - 0.3, ry - 0.2, KNIT_ROSE, { normal: (_x, _y, dx, dy) => n3(dx * 0.45, 0.5 - dy * 0.35, 0.8) });
  for (let y = Math.floor(ty - ry); y <= ty + ry; y++) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      if (y >= ty + ry - 1.2 || c.materialAt(x, y) !== KNIT_ROSE) continue;
      const a = Math.atan2((y + 0.5 - ty) / ry, (x + 0.5 - cx) / rx);
      const w = ((a / (Math.PI * 2)) * 10 + 10) % 1;
      if (w < 0.16) c.shade(x, y, -1);
      else if (w > 0.5 && w < 0.7) c.shade(x, y, 1);
    }
  }
  c.part();
  c.ellipse(cx, ty, 1.2, 0.9, KNIT_CREAM, { bias: 1 });
});

// ---------------------------------------------------------------- Cat bed

const catbed = art('catbed', 2, 12, (c, g) => {
  // A plush round bed, a ginger tabby curled up asleep in it, nose to tail, and a ball of yarn rolled away.
  const cx = g.cx - 0.5;
  const gy = g.y1 - 7.5;
  const rx = 7.5;
  const ry = 5.2;
  drum(c, cx, gy, rx, ry, 0, 3, PLUSH, null, { bias: -1 });
  const roll = (near: boolean) => {
    c.part();
    for (let py = gy - ry - 1; py <= gy + ry + 1; py += 0.5) {
      for (let px = cx - rx - 1; px <= cx + rx + 1; px += 0.5) {
        const ax = (px - cx) / rx;
        const ay = (py - gy) / ry;
        const d = Math.hypot(ax, ay);
        if (d > 1 || d < 0.62 || ay > 0 !== near) continue;
        const u = (d - 0.81) / 0.19;
        const lift = Math.sqrt(Math.max(0, 1 - u * u)) * 1.6;
        const seam = ((Math.atan2(ay, ax) / (Math.PI * 2)) * 14 + 14) % 1 < 0.1;
        c.px(px, py - 3 - lift, PLUSH, n3((ax / d) * u * 0.75, -(ay / d) * u * 0.75 + 0.3, Math.sqrt(Math.max(0.1, 1 - u * u))), { bias: seam ? -1 : 0 });
      }
    }
  };
  roll(false);
  c.part();
  c.ellipse(cx, gy - 2.6, rx * 0.66, ry * 0.62, FUR_CREAM, { normal: (_x, _y, dx, dy) => n3(-dx * 0.3, 0.4 + dy * 0.3, 0.85) });
  // The near rim, low enough that the sleeper shows over it.
  roll(true);
  // The cat: a round back, a haunch, tabby stripes.
  const bx = cx + 1.2;
  const by = gy - 4.5;
  c.part();
  c.ellipse(bx, by, 4.8, 3.3, GINGER);
  c.ellipse(bx + 2, by - 0.8, 2.8, 2.6, GINGER, { bias: 1 });
  for (let y = Math.floor(by - 4); y < by + 4; y++) {
    for (let x = Math.floor(bx - 5); x < bx + 6; x++) {
      if (c.materialAt(x, y) === GINGER && (x + Math.round(y * 0.6)) % 3 === 0) c.shade(x, y, -1);
    }
  }
  // The tail wrapped round the front, its tip cream.
  c.part();
  const tail: [number, number][] = [[bx + 4.4, by + 0.4], [bx + 3.4, by + 2.4], [bx + 0.5, by + 3.1], [bx - 2.4, by + 3], [bx - 4.4, by + 2.4]];
  for (let k = 0; k < tail.length - 1; k++) {
    const [ax, ay] = tail[k];
    const [qx, qy] = tail[k + 1];
    c.capsule(ax, ay, qx, qy, 1.2, 1.05, k === tail.length - 2 ? FUR_CREAM : GINGER);
  }
  c.shade(bx + 2, by + 2.8, -1);
  c.shade(bx - 1, by + 3.1, -1);
  // The head tucked down on the left, facing us: ears up, eyes shut, a pink nose.
  const hx = Math.round(bx - 4);
  const hy = Math.round(by);
  c.part();
  c.ellipse(hx, hy + 0.5, 2.8, 2.3, GINGER, { bias: 1 });
  // Ears: little triangles, pink inside.
  for (const [x, y, b] of [[-3, -2, 0], [-2, -2, 1], [-3, -3, 2], [-2, -3, 1], [-3, -4, 2], [1, -2, 0], [2, -2, -1], [1, -3, 1], [2, -3, 0], [2, -4, 1]] as [number, number, number][]) {
    c.px(hx + x, hy + y, GINGER, TOP, { bias: b });
  }
  c.px(hx - 2, hy - 2, KNIT_ROSE, FACE, { bias: 2 });
  c.px(hx + 1, hy - 2, KNIT_ROSE, FACE, { bias: 1 });
  c.shade(hx - 1, hy - 1, -1);
  c.shade(hx, hy - 1, -1);
  c.part();
  c.ellipse(hx - 0.5 + 0.5, hy + 1.8, 1.4, 0.9, FUR_CREAM, { bias: 1 });
  // Shut eyes: a short dark curve each.
  for (const ex of [hx - 2, hx + 1]) {
    c.px(ex, hy + 0, SOOT, FACE, { bias: 1 });
    c.px(ex + (ex < hx ? -0 : 0) + (ex < hx ? 1 : -1), hy + 1, SOOT, FACE, { bias: 0 });
  }
  c.px(hx - 0.5 + 0.5, hy + 1, TULIP_P, FACE, { bias: 2 });
  // Two cream paws tucked over the tail.
  c.px(hx + 2.5, hy + 2.5, FUR_CREAM, TOP, { bias: 2 });
  c.px(hx + 3.5, hy + 2.6, FUR_CREAM, TOP, { bias: 1 });
  // A ball of blue yarn, its end trailing.
  c.part();
  c.line(cx + 5, gy + 5, cx + 2, gy + 5.6, YARN_END, () => FACE, { bias: 2 });
  c.line(cx + 2, gy + 5.6, cx, gy + 5, YARN_END, () => FACE, { bias: 1 });
  c.part();
  c.ellipse(cx + 6.6, gy + 3.4, 2, 1.9, RIBBON, { bias: 1 });
  for (let y = Math.floor(gy + 1); y < gy + 6; y++) for (let x = Math.floor(cx + 4); x < cx + 9; x++) if (c.materialAt(x, y) === RIBBON && (x - y) % 3 === 0) c.shade(x, y, -1);
});

// ---------------------------------------------------------------- Nightstand

const nightstand = art('nightstand', 1, 26, (c, g) => {
  // A little bedside table: a drawer over an open shelf with books, a glazed lamp lit on top, a cup of tea.
  const x0 = g.cx - 6;
  const x1 = g.cx + 6;
  const y0 = g.y0 + 4;
  const y1 = g.y1 - 3;
  for (const x of [x0, x1 - 2]) box(c, x, x + 2, y0, y0 + 2, 0, 11, OAKW);
  box(c, x0 + 1, x1 - 1, y0, y0 + 1, 3, 11, DARKW, { bias: -1 });
  box(c, x0, x1, y0, y1, 2, 4, OAKW);
  box(c, x0 + 2, x0 + 8, y0 + 2, y1 - 1, 4, 6, BOOKS[1]);
  box(c, x0 + 3, x0 + 7, y0 + 2, y1 - 2, 6, 7, BOOKS[0]);
  c.part();
  for (let x = x0 + 3; x < x0 + 7; x++) c.px(x, y1 - 1 - 5, GOLD_CLOTH, FACE, { bias: 1 });
  for (let z = 4; z < 7; z++) c.px(x1 - 3, y1 - 1 - z, BOOKS[2], FACE, { bias: 1 });
  for (const x of [x0, x1 - 1]) box(c, x, x + 1, y0, y1, 2, 8, OAKW);
  box(c, x0, x1, y0 + 1, y1, 7, 11, OAKW);
  for (let x = x0 + 1; x < x1 - 1; x++) {
    c.shade(x, y1 - 11, 1);
    c.shade(x, y1 - 8, -2);
  }
  c.part();
  c.px(g.cx - 0.5, y1 - 10, BRASS, FACE, { bias: 2 });
  c.px(g.cx - 0.5, y1 - 9, BRASS, FACE, { bias: 0 });
  for (const x of [x0, x1 - 2]) box(c, x, x + 2, y1 - 2, y1, 0, 3, OAKW);
  box(c, x0 - 1, x1 + 1, y0 - 1, y1 + 1, 11, 13, OAKW, { topBias: 1 });
  grain(c, x0 - 1, x1 + 1, y0 - 14, y1 - 12, 511);
  // The lamp: a glazed base, a brass neck, a pleated shade glowing.
  const lx = x0 + 3.5;
  const ly = y0 + 3;
  drum(c, lx, ly, 2, 1.1, 13, 16, GLAZE);
  c.part();
  c.ellipse(lx, ly - 15.5, 1.8, 1.6, GLAZE, { bias: 1 });
  for (let z = 17; z < 20; z++) c.px(lx - 0.5, ly - z, BRASS, FACE, { bias: 1 });
  c.part();
  const st = ly - 25;
  for (let y = st; y < st + 6; y++) {
    const hw = 2 + ((y - st) / 5) * 1.6;
    for (let x = Math.floor(lx - hw); x < lx + hw; x++) {
      const t = (x + 0.5 - lx) / hw;
      c.px(x, y, SHADE, cyl(t, 0.1), { bias: (x % 2 ? -1 : 0) + (y === st ? 1 : 0) + (y === st + 5 ? 1 : 0) });
    }
  }
  for (let x = Math.floor(lx - 3); x < lx + 3; x++) c.spark(x, st + 6, WARM, 0.5);
  halo(c, lx, st + 3, 9, WARM, 0.35);
  // A book lying beyond, and a teacup near the edge.
  box(c, x1 - 6, x1, y0 + 1, y0 + 5, 13, 16, BOOKS[3]);
  c.part();
  for (let x = x1 - 6; x < x1 - 1; x++) c.px(x, y0 + 5 - 15, LINEN, FACE, { bias: 1 });
  drum(c, x1 - 3, y1 - 2, 1.4, 0.8, 13, 15, LINEN, SEEDS);
  c.part();
  c.px(x1 - 1, y1 - 2 - 14, LINEN, FACE, { bias: 0 });
});

// ---------------------------------------------------------------- Piano

const piano = art('piano', 1, 34, (c, g, f) => {
  // An upright in black lacquer: keys, a red felt strip, music on the stand,
  // candles in brass sconces, flowers and a metronome on top, and its bench.
  const x0 = g.x0 + 1;
  const x1 = g.x1 - 1;
  const y0 = g.y0 + 1;
  const fy = y0 + 6;
  const H = 25;
  box(c, x0, x1, y0, fy, 0, H, EBONY);
  box(c, x0 - 1, x1 + 1, y0 - 1, fy + 1, H, H + 2, EBONY, { topBias: 1 });
  // Gloss: long diagonal reflections across the lacquer.
  for (let y = fy - H; y < fy; y++) {
    for (let x = x0 + 1; x < x1 - 1; x++) {
      const d = (x - y + 400) % 13;
      if (d === 0) c.shade(x, y, 2);
      else if (d === 1) c.shade(x, y, 1);
    }
  }
  // Carved panels: upper either side of the music, lower below the keys.
  const panel = (a: number, b: number, z0: number, z1: number) => {
    for (let x = a; x < b; x++) {
      c.shade(x, fy - z1, -2);
      c.shade(x, fy - z0, 1);
    }
    for (let z = z0; z <= z1; z++) {
      c.shade(a, fy - z, -2);
      c.shade(b - 1, fy - z, 1);
    }
  };
  panel(x0 + 2, Math.round(g.cx) - 7, 15, 22);
  panel(Math.round(g.cx) + 7, x1 - 2, 15, 22);
  panel(x0 + 4, x1 - 4, 2, 8);
  // Pedals.
  c.part();
  for (const dx of [-2, 0, 2]) c.px(g.cx + dx, fy - 1, BRASS, TOP, { bias: 2 });
  // Legs under the keybed.
  for (const x of [x0 + 1, x1 - 3]) box(c, x, x + 2, fy + 1, fy + 4, 0, 10, EBONY);
  // The keybed, cheeks either end, and the keys.
  box(c, x0 + 1, x1 - 1, fy, fy + 4, 10, 12, EBONY);
  const kx0 = x0 + 3;
  const kx1 = x1 - 3;
  c.part();
  for (let x = kx0; x < kx1; x++) c.px(x, fy - 12, VELVET, TOP, { bias: -1 });
  for (let x = kx0; x < kx1; x++) c.px(x, fy - 12, QUILT_R, TOP, { bias: -1 });
  for (let y = fy - 11; y < fy - 8; y++) {
    for (let x = kx0; x < kx1; x++) {
      const k = x - kx0;
      const gap = k % 2 === 1;
      const white = Math.floor(k / 2) % 7;
      if (gap && y < fy - 9 && [0, 1, 3, 4, 5].includes(white)) c.px(x, y, EBONY, TOP, { bias: y === fy - 11 ? 3 : 1 });
      else c.px(x, y, IVORY, TOP, { bias: (gap ? -2 : 1) + (y === fy - 9 ? -1 : 0) });
    }
  }
  for (const x of [x0 + 1, x1 - 3]) box(c, x, x + 2, fy - 1, fy + 4, 10, 14, EBONY);
  // The music desk and the sheet on it.
  box(c, Math.round(g.cx) - 7, Math.round(g.cx) + 7, fy, fy + 1, 14, 15, EBONY, { topBias: 1 });
  c.part();
  for (let z = 15; z < 21; z++) {
    for (let x = Math.round(g.cx) - 6; x < Math.round(g.cx) + 6; x++) {
      const fold = x === Math.round(g.cx) - 1 || x === Math.round(g.cx);
      const staff = (z === 17 || z === 19) && !fold;
      const note = staff && hash2(x, z, 521) > 0.6;
      c.px(x, fy - z, note ? SOOT : LINEN, FACE, { bias: fold ? (x === Math.round(g.cx) ? -2 : 0) : staff ? -1 : 1 });
    }
  }
  // Candles in sconces either side.
  for (const [k, x] of [[0, x0 + 3], [1, x1 - 4]]) {
    c.part();
    c.line(x - (k ? -1 : 1), fy - 15, x, fy - 16, BRASS, () => FACE, { bias: 1 });
    c.ellipse(x + 0.5, fy - 16.5, 1.5, 0.8, BRASS, { bias: 1 });
    for (let z = 17; z < 21; z++) c.px(x, fy - z, WAX, FACE, { bias: 2 });
    flame(c, x + 0.5, fy - 22, 0.9, 3, (f + k * 2) % 4, 531 + k);
    halo(c, x + 0.5, fy - 22, 5, WARM, 0.3);
  }
  // On top: a vase of flowers and a metronome.
  const tz = H + 2;
  drum(c, x0 + 5, y0 + 3, 1.7, 0.9, tz, tz + 4, QUILT_B);
  c.part();
  for (const [dx, dy, m] of [[-2, -3, ROSE], [0, -5, TULIP_Y], [2, -3, LAVENDER], [1, -4, ROSE], [-1, -4, TULIP_P]] as [number, number, Material][]) {
    c.line(x0 + 5, y0 + 3 - tz - 4, x0 + 5 + dx, y0 + 3 - tz - 4 + dy + 1, STEM);
    c.px(x0 + 5 + dx, y0 + 3 - tz - 4 + dy, m, sphere(0, 0.4), { bias: 2 });
  }
  c.part();
  const mx = x1 - 6;
  const my = y0 + 4 - tz;
  c.shape(my - 6, my, (y) => {
    const hw = 0.8 + ((y - (my - 6)) / 6) * 1.8;
    return [mx - hw, mx + hw];
  }, PALEW, (_x, _y, t) => n3(t * 0.6, -0.2, 0.8));
  c.line(mx - 0.5, my - 1, mx + 0.5, my - 6, BRASS, () => FACE, { bias: 2 });
  // The bench.
  const bx0 = Math.round(g.cx) - 7;
  const bx1 = Math.round(g.cx) + 7;
  const by0 = g.y1 - 6;
  const by1 = g.y1 - 1;
  for (const x of [bx0, bx1 - 1]) box(c, x, x + 1, by0, by0 + 1, 0, 6, EBONY);
  for (const x of [bx0, bx1 - 1]) box(c, x, x + 1, by1 - 1, by1, 0, 6, EBONY);
  box(c, bx0, bx1, by0, by1, 5, 7, EBONY, { top: QUILT_R, topBias: 1 });
  for (const x of [bx0 + 4, bx1 - 5]) c.shade(x, by0 - 5, -2);
});

// ---------------------------------------------------------------- Harp

const harp = art('harp', 4, 32, (c, g) => {
  // A gilded floor harp: a fluted pillar, a curling neck, a painted soundbox, red C and blue F strings.
  const cx = g.cx;
  const gy = g.y1 - 6;
  const p = cx - 6;
  const sx0 = cx - 3;
  const sz0 = 3;
  const sx1 = cx + 7;
  const sz1 = 21;
  const neck = (x: number) => {
    const t = (x - (p + 1)) / (sx1 - (p + 1));
    return 28 - 7 * t + 2.2 * Math.sin(t * Math.PI * 2);
  };
  const soundAt = (x: number) => sz0 + ((x - sx0) * (sz1 - sz0)) / (sx1 - sx0);
  box(c, p - 2, cx + 1, gy - 2, gy + 2, 0, 3, DARKW);
  c.part();
  for (let x = p - 2; x < cx + 1; x++) c.px(x, gy + 2 - 3, BRASS, FACE, { bias: 1 });
  c.part();
  let k = 0;
  for (let x = p + 2; x < sx1; x += 2, k++) {
    const top = neck(x) - 1;
    const bottom = Math.max(sz0 + 1, soundAt(x));
    const m = k % 7 === 0 ? HARP_RED : k % 7 === 3 ? HARP_BLUE : HARP_STR;
    for (let z = Math.ceil(bottom); z < top; z++) c.px(x, gy - z, m, FACE, { bias: z % 5 === 0 ? 1 : 0 });
    // The light catching each string a little lower the further right.
    c.spark(x, gy - top + 3 + k, [255, 240, 200], 0.4);
  }
  c.part();
  c.capsule(sx0, gy - sz0, sx1, gy - sz1, 2.5, 1.3, PALEW);
  grain(c, sx0 - 3, sx1 + 2, gy - sz1 - 2, gy - sz0 + 3, 541, false);
  c.part();
  c.line(sx0 - 2, gy - sz0 - 1, sx1 - 1, gy - sz1 - 1, BRASS, () => FACE, { bias: 1 });
  for (let j = 1; j < 4; j++) {
    const x = sx0 + ((sx1 - sx0) * j) / 4;
    c.px(x + 0.5, gy - soundAt(x) + 0.5, j % 2 ? ROSE : TULIP_Y, FACE, { bias: 1 });
    c.px(x + 1.5, gy - soundAt(x) + 0.5, LEAF, FACE, { bias: 1 });
  }
  // The pillar, its base and capital.
  drum(c, p + 1, gy, 1.9, 1, 3, 5, BRASS);
  drum(c, p + 1, gy, 1.1, 0.6, 5, 27, BRASS, null);
  for (const z of [8, 14, 20]) for (const x of [p, p + 1]) c.shade(x, gy - z, 2);
  c.part();
  c.ellipse(p + 1, gy - 28, 2, 1.3, BRASS, { bias: 1 });
  c.px(p + 0.5, gy - 30, BRASS, TOP, { bias: 2 });
  // The neck curling over to the soundbox, a scroll at its end.
  c.part();
  for (let x = p + 1; x < sx1; x++) c.capsule(x, gy - neck(x), x + 1, gy - neck(x + 1), 1.1, 1.1, BRASS);
  for (let x = p + 3; x < sx1; x += 2) c.shade(x, gy - neck(x) + 1, -2);
  c.ellipse(sx1 + 0.8, gy - neck(sx1) + 0.8, 1.4, 1.4, BRASS, { bias: 1 });
  c.shade(sx1 + 0.8, gy - neck(sx1) + 0.8, -2);
});

// ---------------------------------------------------------------- Spinning wheel

const spinwheel = art('spinwheel', 4, 26, (c, g) => {
  // A Saxony wheel: the big spoked wheel, a treadle and its rod, the flyer with
  // a bobbin of spun yarn, and a cloud of wool tied to the distaff.
  const cx = g.cx;
  const gy = g.y1 - 6;
  const wx = cx + 3;
  const wy = gy - 18;
  const R = 6.6;
  // Legs and the slanted table.
  c.part();
  c.line(cx - 1, gy - 8, cx - 1, gy - 3, OAKW, () => FACE, { bias: -1 });
  box(c, cx - 1, cx + 6, gy - 1, gy + 2, 0, 1, OAKW);
  c.part();
  c.line(wx + 1, gy - 1, wx + 1, wy + 2, PALEW, () => FACE, { bias: 0 });
  box(c, cx - 8, cx + 6, gy - 2, gy + 1, 8, 10, PALEW, { topBias: 1 });
  grain(c, cx - 8, cx + 6, gy - 12, gy - 8, 551);
  c.part();
  c.capsule(cx - 6, gy - 8, cx - 7, gy + 1, 0.7, 0.6, OAKW);
  c.capsule(cx + 4, gy - 8, cx + 5, gy + 2, 0.7, 0.6, OAKW);
  // The back upright, the wheel, its spokes and hub.
  c.part();
  c.line(wx, gy - 10, wx, wy, OAKW, () => FACE, { bias: -1 });
  c.part();
  for (let y = Math.floor(wy - R - 1); y <= wy + R + 1; y++) {
    for (let x = Math.floor(wx - R - 1); x <= wx + R + 1; x++) {
      const dx = x + 0.5 - wx;
      const dy = y + 0.5 - wy;
      const d = Math.hypot(dx, dy);
      if (d < R - 1.2 || d > R + 0.2) continue;
      c.px(x, y, OAKW, n3((dx / d) * 0.6, (-dy / d) * 0.6, 0.6), { bias: d > R - 0.5 ? 0 : 1 });
    }
  }
  c.part();
  for (let s = 0; s < 8; s++) {
    const a = (s / 8) * Math.PI * 2 + 0.2;
    c.line(wx + Math.cos(a) * 1.4, wy + Math.sin(a) * 1.4, wx + Math.cos(a) * (R - 1.2), wy + Math.sin(a) * (R - 1.2), PALEW, () => FACE, { bias: s % 2 });
  }
  c.part();
  c.ellipse(wx, wy, 1.6, 1.6, DARKW, { bias: 1 });
  c.px(wx - 0.5, wy - 0.5, BRASS, FACE, { bias: 2 });
  // The treadle rod up to the crank, and the front upright.
  c.part();
  c.line(cx + 4, gy - 1, wx + 1.5, wy + 1.5, DARKW, () => FACE, { bias: 0 });
  c.line(wx - 1, gy - 9, wx - 0.5, wy + 1, OAKW, () => FACE, { bias: 1 });
  // The mother-of-all, its maidens and the flyer with a full bobbin.
  c.part();
  c.line(cx - 5, gy - 10, cx - 5, gy - 15, OAKW, () => FACE, { bias: 0 });
  c.line(cx - 8, gy - 15, cx - 2, gy - 15, OAKW, () => TOP, { bias: 1 });
  c.line(cx - 8, gy - 15, cx - 8, gy - 19, OAKW, () => FACE, { bias: 1 });
  c.line(cx - 3, gy - 15, cx - 3, gy - 19, OAKW, () => FACE, { bias: 0 });
  c.part();
  c.ellipse(cx - 5.5, gy - 18.5, 1.8, 1.6, KNIT_CREAM, { bias: 1 });
  c.line(cx - 7, gy - 20, cx - 4, gy - 20, BRASS, () => FACE, { bias: 1 });
  c.line(cx - 7, gy - 17, cx - 4, gy - 17, BRASS, () => FACE, { bias: 0 });
  c.px(cx - 9, gy - 19, BRASS, FACE, { bias: 2 });
  // The drive band looped round the wheel and the whorl.
  c.part();
  c.line(cx - 3, gy - 19, wx - 1, wy - R + 0.5, BAND, () => FACE, { bias: 1 });
  c.line(cx - 3, gy - 18, wx - 1, wy + R - 0.5, BAND, () => FACE, { bias: 0 });
  // The distaff and its wool, a strand drawn down to the orifice.
  c.part();
  c.line(cx - 8, gy - 10, cx - 9, gy - 23, OAKW, () => FACE, { bias: 0 });
  c.part();
  const W = rng(552);
  for (let k = 0; k < 7; k++) c.ellipse(cx - 9 + (W() - 0.5) * 3, gy - 24 - W() * 3, 1.6 + W() * 0.6, 1.4 + W() * 0.5, KNIT_CREAM, { bias: Math.floor(W() * 2) });
  c.part();
  c.line(cx - 9, gy - 23, cx - 8, gy - 23, QUILT_R, () => FACE, { bias: 2 });
  c.line(cx - 10, gy - 21, cx - 9.5, gy - 19, BAND, () => FACE, { bias: 2 });
});

// ---------------------------------------------------------------- Globe

const globe = art('globe', 3, 24, (c, g) => {
  // A floor globe: seas and lands round a tilted axis, a brass meridian, and the wooden horizon ring on three legs.
  const cx = g.cx;
  const gy = g.y1 - 6;
  const sy = gy - 14;
  const R = 5.5;
  const tilt = 0.4;
  const ringY = sy + 1;
  // The back leg and the ring's far half.
  c.part();
  c.capsule(cx, ringY - 2, cx, gy - 3, 0.8, 0.7, OAKW);
  const ring = (near: boolean) => {
    c.part();
    for (let a = 0; a < 96; a++) {
      const th = (a / 96) * Math.PI * 2;
      if (Math.sin(th) > 0 !== near) continue;
      const x = cx + Math.cos(th) * 7.4;
      const y = ringY + Math.sin(th) * 2.4;
      c.px(x, y, OAKW, TOP, { bias: near ? 2 : 0 });
      if (near) c.px(x, y + 1, OAKW, FACE, { bias: -1 });
    }
  };
  ring(false);
  // The world.
  c.part();
  for (let y = Math.floor(sy - R); y <= sy + R; y++) {
    for (let x = Math.floor(cx - R); x <= cx + R; x++) {
      const dx = (x + 0.5 - cx) / R;
      const dy = (y + 0.5 - sy) / R;
      const d2 = dx * dx + dy * dy;
      if (d2 > 1) continue;
      const dz = Math.sqrt(1 - d2);
      const X = dx * Math.cos(tilt) + dy * Math.sin(tilt);
      const Y = -dx * Math.sin(tilt) + dy * Math.cos(tilt);
      const lat = Math.asin(Math.max(-1, Math.min(1, -Y)));
      const lon = Math.atan2(X, dz) + 0.6;
      const land = Math.sin(lon * 2 + 0.5) * Math.cos(lat * 2.2) + 0.55 * Math.sin(lon * 3.3 - lat * 2.5 + 1.7) + 0.35 * Math.cos(lat * 4.5 + lon * 1.3);
      const m = Math.abs(lat) > 1.15 ? KNIT_CREAM : land > 0.45 ? LAND : SEA;
      c.px(x, y, m, sphere(dx, dy), { bias: m === LAND && land > 0.9 ? 1 : 0 });
    }
  }
  // The brass meridian round it, pinned at the poles.
  c.part();
  for (let a = 0; a < 80; a++) {
    const th = (a / 80) * Math.PI * 2;
    c.px(cx + Math.sin(th) * 6.6, sy - Math.cos(th) * 6.6, BRASS, n3(Math.sin(th) * 0.6, Math.cos(th) * 0.6, 0.6), { bias: 1 });
  }
  c.px(cx + Math.sin(tilt) * 7.6, sy - Math.cos(tilt) * 7.6, BRASS, TOP, { bias: 2 });
  ring(true);
  // Front legs bowed out to brass feet, a stretcher between them.
  c.part();
  for (const s of [-1, 1]) {
    c.capsule(cx + s * 7.2, ringY + 1.5, cx + s * 7.6, gy - 6, 0.9, 0.8, OAKW);
    c.capsule(cx + s * 7.6, gy - 6, cx + s * 6, gy, 0.8, 0.8, OAKW);
  }
  c.line(cx - 6.5, gy - 3, cx + 6.5, gy - 3, OAKW, () => FACE, { bias: 1 });
  c.part();
  for (const s of [-1, 1]) c.ellipse(cx + s * 6, gy + 0.5, 1.1, 0.9, BRASS, { bias: 1 });
  c.ellipse(cx, gy - 3, 1.2, 1, BRASS, { bias: 1 });
});

// ---------------------------------------------------------------- Telescope

/** A tube from (ax, ay) to (bx, by), round across its width; `bias(t)` bands it along its length. */
function tube(c: PixelCanvas, ax: number, ay: number, bx: number, by: number, r0: number, r1: number, m: Material, bias: (t: number) => number): void {
  c.part();
  const vx = bx - ax;
  const vy = by - ay;
  const len = Math.hypot(vx, vy);
  const ux = vx / len;
  const uy = vy / len;
  const R = Math.max(r0, r1) + 1;
  for (let y = Math.floor(Math.min(ay, by) - R); y <= Math.max(ay, by) + R; y++) {
    for (let x = Math.floor(Math.min(ax, bx) - R); x <= Math.max(ax, bx) + R; x++) {
      const qx = x + 0.5 - ax;
      const qy = y + 0.5 - ay;
      const t = (qx * ux + qy * uy) / len;
      if (t < 0 || t > 1) continue;
      const s = -qx * uy + qy * ux;
      const r = r0 + (r1 - r0) * t;
      if (Math.abs(s) > r) continue;
      const k = s / r;
      c.px(x, y, m, n3(-uy * k * 0.9, -ux * k * 0.9 + 0.15, Math.sqrt(1 - k * k * 0.81)), { bias: bias(t) });
    }
  }
}

const telescope = art('telescope', 6, 28, (c, g) => {
  // A brass refractor on a wooden tripod, tilted at the sky, a star chart rolled at its feet.
  const cx = g.cx;
  const gy = g.y1 - 6;
  const mx = cx - 1;
  const my = gy - 14;
  c.part();
  c.capsule(mx, my, cx, gy - 4, 0.8, 0.7, DARKW);
  c.part();
  c.capsule(mx, my, cx - 7, gy + 1, 0.9, 0.7, OAKW);
  c.capsule(mx, my, cx + 5, gy + 1, 0.9, 0.7, OAKW);
  for (const [x, y] of [[cx - 7, gy + 1], [cx + 5, gy + 1]]) c.px(x - 0.5, y, BRASS, FACE, { bias: 1 });
  c.part();
  c.line(cx - 4, gy - 6, cx + 2, gy - 6, BRASS, () => FACE, { bias: 0 });
  c.ellipse(mx, my - 1, 1.6, 1.4, BRASS, { bias: 1 });
  // The tube: banded brass, a leather grip, a dew shield, the lens catching starlight.
  const ex = cx - 7;
  const ey = gy - 12;
  const ox = cx + 9;
  const oy = gy - 24;
  tube(c, ex, ey, ox, oy, 1.3, 1.9, BRASS, (t) => (Math.abs(t - 0.2) < 0.03 || Math.abs(t - 0.62) < 0.03 ? -2 : 0));
  const lerp = (t: number): [number, number] => [ex + (ox - ex) * t, ey + (oy - ey) * t];
  const [gx0, gy0] = lerp(0.34);
  const [gx1, gy1] = lerp(0.5);
  tube(c, gx0, gy0, gx1, gy1, 1.7, 1.8, LEATHER, () => 0);
  const [dx0, dy0] = lerp(0.84);
  tube(c, dx0, dy0, ox, oy, 2.2, 2.3, BRASS, (t) => (t < 0.15 ? -1 : 1));
  // The finder riding on top.
  const [fx0, fy0] = lerp(0.42);
  const [fx1, fy1] = lerp(0.66);
  c.part();
  c.line(fx0 - 1.2, fy0 - 2, fx1 - 1.2, fy1 - 2, BRASS, () => TOP, { bias: 2 });
  // The objective end, open to the sky.
  c.part();
  const len = Math.hypot(ox - ex, oy - ey);
  const ux = (ox - ex) / len;
  const uy = (oy - ey) / len;
  for (let y = Math.floor(oy - 4); y <= oy + 4; y++) {
    for (let x = Math.floor(ox - 4); x <= ox + 4; x++) {
      const qx = x + 0.5 - ox;
      const qy = y + 0.5 - oy;
      const a = (qx * ux + qy * uy) / 1.1;
      const s = (-qx * uy + qy * ux) / 2.3;
      const d = a * a + s * s;
      if (d > 1) continue;
      c.px(x, y, d < 0.35 ? GLASS : BRASS, n3(ux * 0.5, -uy * 0.5, 0.7), { bias: d < 0.35 ? -1 : 2 });
    }
  }
  c.spark(ox - 0.5, oy - 0.5, [220, 240, 255], 0.7);
  // The eyepiece.
  c.part();
  c.capsule(ex, ey, ex - 1.5, ey + 1.5, 0.8, 0.7, SOOT);
  c.px(ex + 1, ey + 2, BRASS, FACE, { bias: 2 });
  // A star chart rolled against the leg.
  c.part();
  c.capsule(cx + 1, gy + 1, cx + 4, gy - 2, 1, 1, PARCH);
  c.px(cx + 1.5, gy + 0.5, QUILT_R, FACE, { bias: 1 });
});

// ---------------------------------------------------------------- Fishbowl

const fishbowl = art('fishbowl', 2, 22, (c, g, f) => {
  // A round glass bowl on a little pedestal and lace: a goldfish, pebbles, a weed, bubbles rising.
  const cx = g.cx;
  const gy = g.y1 - 6;
  drum(c, cx, gy, 3.4, 1.9, 0, 1, DARKW);
  drum(c, cx, gy, 1.3, 0.7, 1, 6, OAKW, null);
  drum(c, cx, gy, 4.8, 2.6, 6, 8, OAKW);
  c.part();
  for (let a = 0; a < 40; a++) {
    const th = (a / 40) * Math.PI * 2;
    const r = a % 2 ? 4.4 : 4.9;
    c.px(cx + Math.cos(th) * r, gy - 8 + Math.sin(th) * r * 0.5, LINEN, TOP, { bias: 1 });
  }
  const R = 5.8;
  const by = gy - 8 - R + 1;
  const water = by - 2.2;
  c.part();
  for (let y = Math.floor(by - R); y <= by + R - 1; y++) {
    for (let x = Math.floor(cx - R); x <= cx + R; x++) {
      const dx = (x + 0.5 - cx) / R;
      const dy = (y + 0.5 - by) / R;
      const d = Math.hypot(dx, dy);
      if (d > 1) continue;
      if (d > 0.84) c.px(x, y, GLASS, sphere(dx, dy), { bias: 1 });
      else if (y < water) c.px(x, y, GLASS, sphere(dx * 0.5, dy * 0.5), { bias: -2 });
      else c.px(x, y, AQUA, sphere(dx * 0.6, dy * 0.6), { bias: y < water + 1 ? 2 : 0 });
    }
  }
  // Pebbles and a weed on the bottom.
  c.part();
  const P = rng(561);
  const stones = [TERRA, PALE_STONE, PETAL_Y, QUILT_B, PALE_STONE];
  for (let x = Math.floor(cx - 3.5); x < cx + 3.5; x++) {
    const m = stones[Math.floor(P() * stones.length)];
    c.px(x, by + R - 2, m, sphere(0, 0.5), { bias: 1 });
    if (P() < 0.6) c.px(x, by + R - 3, m, sphere(0, 0.5), { bias: 2 });
  }
  c.part();
  for (let k = 0; k < 7; k++) {
    c.px(cx - 2.5 + Math.round(Math.sin(k * 0.9)), by + R - 4 - k, LEAF, FACE, { bias: k % 2 ? 1 : 0 });
    if (k < 5) c.px(cx - 1 + Math.round(Math.sin(k * 0.9 + 2)), by + R - 4 - k, LEAF_DARK, FACE, { bias: 1 });
  }
  // The goldfish.
  const fx = cx + 1;
  const fy = by + 0.5;
  c.part();
  c.shape(fy - 1.5, fy + 1.5, (y) => {
    const w = 1.6 - Math.abs(y + 0.5 - fy) * 0.7;
    return [fx - 3.2 - w, fx - 2];
  }, GOLDFISH, (_x, _y, t) => n3(t * 0.3, 0.1, 0.9), { bias: 1 });
  c.ellipse(fx, fy, 2.2, 1.4, GOLDFISH, { bias: 0 });
  c.px(fx - 0.5, fy - 2, GOLDFISH, TOP, { bias: 2 });
  c.px(fx + 1, fy - 0.5, SOOT, FACE, { bias: 0 });
  c.px(fx - 0.5, fy + 0.5, GOLDFISH, FACE, { bias: 3 });
  // The rim at the mouth and a bright sheen on the glass.
  c.part();
  for (let a = 0; a < 24; a++) {
    const th = (a / 24) * Math.PI * 2;
    c.px(cx + Math.cos(th) * 3.2, by - R + 1.4 + Math.sin(th) * 1.1, GLASS, TOP, { bias: Math.sin(th) > 0 ? 3 : 1 });
  }
  for (let a = 0; a < 6; a++) {
    const th = Math.PI * (0.62 + a * 0.06);
    c.px(cx + Math.cos(th) * R * 0.72, by - Math.sin(th) * R * 0.72, GLASS, FACE, { bias: 5 });
  }
  c.px(cx + R * 0.55, by + R * 0.4, GLASS, FACE, { bias: 4 });
  // Bubbles rising from the fish.
  for (let k = 0; k < 3; k++) {
    const yy = fy - 1 - ((f + k * 1.4) % 4) * 1.2;
    c.spark(fx + 2.5 + (k % 2) * 0.6, yy, [220, 250, 255], 0.55);
  }
}, 4, 3);

// ---------------------------------------------------------------- Coat rack

const coatrack = art('coatrack', 6, 40, (c, g) => {
  // A turned wooden stand: a plum cloak behind, a felt hat with a feather, a striped scarf and a satchel.
  const cx = g.cx;
  const gy = g.y1 - 6;
  // The cloak, hung from a back peg.
  c.part();
  const ct = gy - 27;
  const cb = gy - 3;
  for (let y = ct; y < cb; y++) {
    const u = (y - ct) / (cb - ct);
    const hw = 2.4 + u * 3.6;
    for (let x = Math.floor(cx - hw); x < cx + hw; x++) {
      if (y === cb - 1 && x % 3 === 0) continue;
      const t = (x + 0.5 - cx) / hw;
      const fold = Math.sin((x + 0.5 - cx) * 1.5 + u);
      c.px(x, y, PLUM, n3(t * 0.4 + fold * 0.35, -0.3, 0.85), { bias: fold > 0.6 ? 1 : fold < -0.6 ? -1 : 0 });
    }
  }
  c.part();
  c.ellipse(cx, ct - 1, 3.2, 2.4, PLUM, { bias: 1 });
  c.ellipse(cx, ct - 0.5, 1.6, 1.2, PLUM, { bias: -2 });
  c.px(cx - 0.5, ct + 2, BRASS, FACE, { bias: 2 });
  // Feet and the pole.
  c.part();
  c.capsule(cx, gy - 2, cx + 1, gy - 5, 0.8, 0.7, DARKW);
  c.part();
  c.capsule(cx, gy - 2, cx - 6, gy + 1, 0.9, 0.7, DARKW);
  c.capsule(cx, gy - 2, cx + 6, gy + 1, 0.9, 0.7, DARKW);
  c.capsule(cx, gy - 2, cx - 1, gy + 2.5, 0.9, 0.7, DARKW);
  for (const [x, y] of [[cx - 6, gy + 1], [cx + 6, gy + 1], [cx - 1, gy + 2.5]]) c.px(x - 0.5, y, BRASS, FACE, { bias: 1 });
  drum(c, cx, gy, 1.1, 0.6, 1, 33, DARKW, null);
  for (const z of [6, 7, 19, 20]) for (const x of [cx - 1, cx]) c.shade(x, gy - z, 2);
  c.part();
  c.ellipse(cx, gy - 34, 1.5, 1.4, DARKW, { bias: 1 });
  // Pegs.
  c.part();
  for (const s of [-1, 1]) {
    c.capsule(cx, gy - 28, cx + s * 4, gy - 30, 0.6, 0.6, DARKW);
    c.ellipse(cx + s * 4.2, gy - 30.2, 0.9, 0.9, DARKW, { bias: 1 });
  }
  c.capsule(cx, gy - 20, cx - 3.5, gy - 21.5, 0.6, 0.6, DARKW);
  // The satchel on the low peg.
  c.part();
  c.line(cx - 3.5, gy - 21, cx - 6.5, gy - 13, LEATHER, () => FACE, { bias: 1 });
  c.line(cx - 3.5, gy - 21, cx - 2.5, gy - 13, LEATHER, () => FACE, { bias: 0 });
  c.part();
  for (let y = gy - 13; y < gy - 8; y++) for (let x = cx - 7; x < cx - 2; x++) c.px(x, y, LEATHER, FACE, { bias: (x === cx - 7 ? 1 : x === cx - 3 ? -1 : 0) + (y === gy - 9 ? -1 : 0) });
  for (let x = cx - 7; x < cx - 2; x++) for (let y = gy - 13; y < gy - 11; y++) c.shade(x, y, y === gy - 12 ? -1 : 1);
  c.px(cx - 5, gy - 11, BRASS, FACE, { bias: 2 });
  // The scarf over the right peg.
  c.part();
  const tails: [number, number, number][] = [[cx + 3, gy - 28, gy - 15], [cx + 5, gy - 28, gy - 17]];
  for (const [x, top, end] of tails) {
    for (let y = top; y < end; y++) {
      for (let k = 0; k < 2; k++) {
        const stripe = (y - top) % 4 < 2;
        c.px(x + k + (y > end - 6 && x > cx + 4 ? 1 : 0), y, stripe ? QUILT_R : KNIT_CREAM, FACE, { bias: k === 0 ? 1 : -1 });
      }
    }
    for (const k of [0, 1]) c.px(x + k + (x > cx + 4 ? 1 : 0), end + (k ? 0 : 1), KNIT_CREAM, FACE, { bias: 0 });
  }
  c.part();
  c.ellipse(cx + 4.5, gy - 29.5, 2.1, 1.3, QUILT_R, { bias: 1 });
  // The hat on the left peg, a red feather in its band.
  c.part();
  c.ellipse(cx - 5, gy - 30.8, 3.6, 1.1, FELT, { bias: 0 });
  c.ellipse(cx - 5, gy - 33, 2.2, 2.1, FELT, { bias: 1 });
  c.shade(cx - 5, gy - 34.5, -2);
  c.part();
  for (let x = cx - 7; x < cx - 2; x++) c.px(x, gy - 32, LEATHER, FACE, { bias: 0 });
  c.line(cx - 3, gy - 33, cx - 1, gy - 37, RED_PAINT, () => FACE, { bias: 1 });
  c.px(cx - 1, gy - 38, PETAL_Y, FACE, { bias: 2 });
});

// ---------------------------------------------------------------- Wall decor

const mirror = decor((c) => {
  // An oval looking glass with a soft diagonal sheen, in a beaded gilt frame with a shell crest.
  const cx = 8;
  const cy = 9;
  c.part();
  for (let y = 0; y < 18; y++) {
    for (let x = 0; x < 16; x++) {
      const dx = (x + 0.5 - cx) / 4.3;
      const dy = (y + 0.5 - cy) / 5.7;
      const d = dx * dx + dy * dy;
      if (d <= 1) {
        const u = x + y * 0.7;
        const sheen = Math.abs(u - 12.5) < 0.8 ? 3 : Math.abs(u - 15) < 0.5 ? 2 : 0;
        c.px(x, y, MIRROR, FACE, { bias: sheen + (y < cy - 2 ? 1 : 0) - (y > cy + 2 ? 1 : 0) });
      }
    }
  }
  c.part();
  for (let y = 0; y < 18; y++) {
    for (let x = 0; x < 16; x++) {
      const gx = (x + 0.5 - cx) / 4.3;
      const gy = (y + 0.5 - cy) / 5.7;
      const dx = (x + 0.5 - cx) / 5.7;
      const dy = (y + 0.5 - cy) / 7.1;
      if (gx * gx + gy * gy <= 1 || dx * dx + dy * dy > 1) continue;
      const bead = Math.round((Math.atan2(dy, dx) / Math.PI) * 14) % 2 === 0;
      c.px(x, y, BRASS, n3(dx * 0.6, -dy * 0.6, 0.65), { bias: bead ? 1 : 0 });
    }
  }
  c.part();
  for (const [x, y, b] of [[8, 0, 2], [7, 1, 1], [8, 1, 2], [9, 1, 0], [6, 2, 1], [10, 2, -1], [7, 16, 1], [8, 16, 0], [8, 17, -1], [2, 9, 1], [13, 9, -1]] as [number, number, number][]) {
    c.px(x - (x === 8 ? 0.5 : 0), y, BRASS, FACE, { bias: b });
  }
});

const cuckoo = decor((c) => {
  // A carved cuckoo clock: a steep roof, the little bird at its door, a dial, a pendulum and pinecone weights on chains.
  c.part();
  for (const [x, end] of [[5, 14], [11, 12]]) for (let y = 12; y < end; y++) c.px(x, y, BRASS, FACE, { bias: y % 2 ? 1 : -1 });
  c.part();
  for (const [x, y] of [[5.5, 15.5], [11.5, 13.5]]) {
    c.ellipse(x, y, 1.2, 1.9, DARKW, { bias: 1 });
    for (let yy = Math.floor(y - 1.5); yy < y + 2; yy++) for (let xx = Math.floor(x - 1); xx < x + 1; xx++) if ((xx + yy) % 2 === 0) c.shade(xx, yy, 2);
  }
  c.part();
  c.line(8, 12, 8, 14, BRASS, () => FACE, { bias: 1 });
  c.ellipse(8.5, 15.2, 1.4, 1.3, OAKW, { bias: 1 });
  c.shade(8.5, 15.2, -1);
  // The case, its dial and carved leaves.
  c.part();
  for (let y = 6; y < 12; y++) for (let x = 4; x < 12; x++) c.px(x, y, OAKW, FACE, { bias: x === 4 ? 1 : x === 11 ? -1 : y === 11 ? -1 : 0 });
  grain(c, 4, 12, 6, 12, 571, false);
  c.part();
  c.ellipse(8, 8.8, 2.3, 2.3, DIAL, { normal: () => FACE, bias: 1 });
  c.line(8, 9, 8, 7, SOOT, () => FACE);
  c.px(9, 9, SOOT, FACE);
  for (const [x, y] of [[4, 11], [4, 10], [5, 11], [11, 11], [11, 10], [10, 11]]) c.px(x, y, PALEW, FACE, { bias: 2 });
  // The roof, the gable, and the bird in its doorway.
  c.part();
  for (let y = 1; y < 6; y++) {
    const w = 0.6 + (y - 1) * 1.6;
    for (let x = 1; x < 15; x++) {
      const d = w - Math.abs(x + 0.5 - 8);
      if (d < 0) continue;
      if (d < 2.2 || y === 5) c.px(x, y, DARKW, FACE, { bias: (x < 8 ? 1 : -1) + (y === 5 && x % 2 ? -1 : 0) });
      else c.px(x, y, PALEW, FACE, { bias: 0 });
    }
  }
  c.part();
  c.px(7, 3, SOOT, FACE);
  c.px(8, 3, SOOT, FACE);
  c.px(7, 4, SOOT, FACE);
  c.px(8, 4, SOOT, FACE);
  c.px(7, 3, PETAL_Y, FACE, { bias: 2 });
  c.px(6, 3, PUMPKIN, FACE, { bias: 2 });
  c.px(8, 0, OAKW, FACE, { bias: 2 });
  c.px(7, 0, OAKW, FACE, { bias: 0 });
});

const oldmap = decor((c) => {
  // A parchment map pinned up: a coast, mountains, a wood, a dotted trail to a red X, a curled corner.
  c.part();
  for (let y = 3; y < 15; y++) {
    for (let x = 2; x < 14; x++) {
      const edge = x === 2 || x === 13 || y === 3 || y === 14;
      if (edge && hash2(x, y, 461) < 0.22) continue;
      if (x + y >= 25) continue;
      const coast = 6.2 + Math.sin(y * 0.8) * 1.3 + (y > 10 ? (y - 10) * 0.5 : 0);
      const sea = x + 0.5 < coast;
      c.px(x, y, sea ? INK_SEA : PARCH, n3(Math.sin(y * 0.9) * 0.1, -0.4, 0.9), { bias: (edge ? -1 : 0) + (hash2(x, y, 462) > 0.85 ? -1 : 0) + (sea && (x + y * 2) % 7 === 0 ? 1 : 0) });
    }
  }
  // The coastline inked in.
  for (let y = 3; y < 15; y++) {
    for (let x = 2; x < 13; x++) if (c.materialAt(x, y) === INK_SEA && c.materialAt(x + 1, y) === PARCH) c.px(x + 1, y, SEEDS, FACE, { bias: 2 });
  }
  c.part();
  for (const [x, y] of [[9, 5], [8, 6], [10, 6], [12, 5], [11, 6], [13, 6], [8, 10], [7, 13], [9, 13], [10, 12], [4, 10], [3, 11], [5, 11], [4, 12]]) c.px(x, y, SEEDS, FACE, { bias: 1 });
  c.px(8, 9, LEAF, FACE, { bias: 1 });
  c.px(7, 9, LEAF, FACE, { bias: 0 });
  c.px(4, 11, PARCH, FACE, { bias: 3 });
  for (const [x, y] of [[10, 8], [12, 8], [11, 9], [10, 10], [12, 10]]) c.px(x, y, RED_PAINT, FACE, { bias: 1 });
  // The curl, and the pins.
  c.part();
  for (const [x, y, b] of [[12, 12, 3], [11, 13, 2], [12, 13, 0], [10, 14, 1], [13, 11, 1]]) c.px(x, y, PARCH, FACE, { bias: b });
  c.part();
  for (const x of [3, 12]) {
    c.px(x, 4, RED_PAINT, FACE, { bias: 2 });
    c.px(x + 1, 5, SOOT, FACE, { bias: 0 });
  }
});

const hangplant = decor((c) => {
  // A macramé hanger from a hook: knotted cords round a terracotta pot, a tassel, a pothos trailing down both sides.
  c.part();
  c.px(8, 0, IRON, FACE, { bias: 2 });
  c.px(7, 0, IRON, FACE, { bias: 0 });
  c.part();
  for (const x of [5, 11]) c.line(7.5, 1, x, 8, CORD, () => FACE, { bias: 1 });
  c.px(7.5, 2, CORD, FACE, { bias: 2 });
  c.px(7.5, 3, CORD, FACE, { bias: 0 });
  // The pot.
  c.part();
  c.shape(8, 12, (y) => {
    const hw = y < 9 ? 3.5 : 3.2 - (y - 9) * 0.5;
    return [8 - hw, 8 + hw];
  }, TERRA, (_x, _y, t) => cyl(t, 0));
  for (let x = 5; x < 11; x++) c.shade(x, 8, 2);
  // The netting over it and the tassel below.
  c.part();
  for (const [x, y] of [[5, 9], [6, 10], [7, 11], [10, 9], [9, 10], [8, 11]]) c.px(x, y, CORD, FACE, { bias: 2 });
  for (let y = 12; y < 16; y++) c.px(7.5, y, CORD, FACE, { bias: y === 12 ? 2 : 0 });
  c.px(7, 15, CORD, FACE, { bias: -1 });
  c.px(8, 15, CORD, FACE, { bias: 0 });
  c.px(7.5, 16, CORD, FACE, { bias: -1 });
  // Leaves heaped on top, then the vines falling.
  c.part();
  const L = rng(581);
  for (let k = 0; k < 8; k++) c.ellipse(5 + L() * 6, 5.5 + L() * 1.6, 1.3, 1, k % 3 ? LEAF : LEAF_DARK, { bias: Math.floor(L() * 3) });
  c.part();
  const vine = (x0: number, dir: number, len: number) => {
    for (let k = 0; k < len; k++) {
      const x = x0 + Math.round(Math.sin(k * 0.8) * 0.8) + (k > 4 ? dir : 0);
      const y = 8 + k;
      c.px(x, y, STEM, FACE, { bias: 0 });
      if (k % 2 === 1) c.px(x + (k % 4 === 1 ? -1 : 1), y, k % 4 === 1 ? LEAF : LEAF_DARK, FACE, { bias: 2 });
    }
  };
  vine(3, -1, 10);
  vine(12, 1, 8);
  vine(4, 0, 6);
});

const garland = decor((c, f) => {
  // A draped string of little lamps with paper stars hung between them, twinkling in turn.
  const sag = (x: number) => 2 + 5 * (1 - ((x + 0.5 - 8) / 8) ** 2);
  c.part();
  for (let x = 0; x < 16; x++) c.px(x, sag(x), THREAD, FACE, { bias: 1 });
  const stars: [number, number][] = [[2.5, 3], [8, 4], [13.5, 3]];
  stars.forEach(([sx, drop], k) => {
    const top = Math.floor(sag(Math.floor(sx))) + 1;
    c.part();
    for (let y = top; y < top + drop - 1; y++) c.px(sx, y, THREAD, FACE, { bias: 0 });
    // Bright on its own beat, dim between.
    const on = (f + k * 2) % 4 === 0 ? 1 : (f + k * 2) % 4 === 1 || (f + k * 2) % 4 === 3 ? 0.65 : 0.4;
    const y = top + drop;
    c.part();
    for (const [dx, dy, b] of [[0, -2, 1], [-1, -1, 1], [0, -1, 2], [1, -1, 0], [-2, 0, 0], [-1, 0, 1], [0, 0, 2], [1, 0, 1], [2, 0, -1], [-1, 1, 0], [1, 1, -1], [-1, 2, -1], [1, 2, -1]] as [number, number, number][]) {
      c.px(sx + dx, y + dy, STAR, FACE, { bias: b, glow: 0.35 + on * 0.6 });
    }
    if (on === 1) {
      for (const [dx, dy] of [[0, -3], [-3, 0], [3, 0], [0, 3]]) c.spark(sx + dx, y + dy, [255, 236, 170], 0.5);
    }
    halo(c, sx, y, 4, [255, 220, 140], 0.15 + on * 0.25);
  });
  // The little lamps along the string.
  [5, 10.5, 0.5, 15.5].forEach((bx, k) => {
    const m = BULBS[k % BULBS.length];
    const on = (f + k) % 2 === 0 ? 1 : 0.55;
    const y = sag(Math.floor(bx)) + 1;
    c.part();
    c.px(bx, y, m, FACE, { bias: 2, glow: on });
    halo(c, bx, y, 3, [255, 210, 160], 0.2 * on);
  });
}, 4, 4);

const tapestry = decor((c) => {
  // A woven hanging on a rod: a tree of life with golden fruit among cream stars, a gold border, tasselled hem.
  c.part();
  c.line(3, 2, 8, 0, CORD, () => FACE, { bias: 1 });
  c.line(8, 0, 13, 2, CORD, () => FACE, { bias: 0 });
  c.part();
  for (let y = 3; y < 15; y++) {
    for (let x = 3; x < 13; x++) {
      const border = x === 4 || x === 11 || y === 4 || y === 13;
      const weave = (x + y) % 2 ? 0 : 1;
      c.px(x, y, border ? GOLD_CLOTH : WINE, n3(Math.sin(x * 1.1) * 0.15, -0.35, 0.9), { bias: border ? 1 : weave - (y > 11 ? 1 : 0) });
    }
  }
  c.part();
  for (let y = 9; y < 13; y++) c.px(7.5, y, OAKW, FACE, { bias: 1 });
  c.px(6.5, 12, OAKW, FACE, { bias: 0 });
  c.px(8.5, 12, OAKW, FACE, { bias: 0 });
  c.part();
  c.ellipse(8, 7.5, 2.6, 2.2, VELVET, { normal: () => FACE, bias: 2 });
  for (const [x, y] of [[7, 7], [9, 6], [8, 8.5], [6, 8]]) c.px(x, y, GOLD_CLOTH, FACE, { bias: 3 });
  c.px(6, 5, KNIT_CREAM, FACE, { bias: 2 });
  c.px(5, 6, KNIT_CREAM, FACE, { bias: 1 });
  c.px(10, 11, KNIT_CREAM, FACE, { bias: 1 });
  c.px(5, 11, KNIT_CREAM, FACE, { bias: 1 });
  // The rod with brass ends, then the tassels.
  c.part();
  for (let x = 2; x < 14; x++) c.px(x, 2, DARKW, FACE, { bias: 1 });
  c.px(1, 2, BRASS, FACE, { bias: 2 });
  c.px(14, 2, BRASS, FACE, { bias: 0 });
  c.part();
  for (let x = 3; x < 13; x++) {
    c.px(x, 15, x % 2 ? GOLD_CLOTH : KNIT_CREAM, FACE, { bias: 1 });
    if (x % 2 === 0) c.px(x, 16, KNIT_CREAM, FACE, { bias: -1 });
  }
});

// ---------------------------------------------------------------- Registry

export const ROOM_ART: Record<string, PropArt> = {
  armchair,
  rocker,
  bathtub: bathFront,
  pouf,
  catbed,
  nightstand,
  piano,
  harp,
  spinwheel,
  globe,
  telescope,
  fishbowl,
  coatrack,
  mirror,
  cuckoo,
  oldmap,
  hangplant,
  garland,
  tapestry,
};

/** The views the turning pieces have besides their front: the side (facing east; west mirrors it) and the back. */
export const ROOM_TURNS: Record<string, { side: PropArt; back: PropArt }> = {
  armchair: { side: armchairSide, back: armchairBack },
  rocker: { side: rockerSide, back: rockerBack },
  bathtub: { side: bathSide, back: bathBack },
};
