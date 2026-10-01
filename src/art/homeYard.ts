// The yard's later pieces (see world/homeParts.ts): garden ornaments, a deck
// chair, a doghouse, a rose arch, a swing and a fountain, and a few lights,
// drawn the same way as homeProps.ts: the game's high three-quarter view, lit
// from the upper left, with a glow layer that alone animates.

import { PixelCanvas, cyl, sphere, type Material } from './pixel';
import { FIRE_COLS, hash2, rng } from './env';
import { FIELDSTONE, IRON } from './sanctum';
import {
  art, sized, box, drum, grain, flame, halo, tufts, rose, mat, n3,
  FACE, TOP, FLOOR,
  OAKW, DARKW, PALEW, BRASS, LINEN, LEAF, LEAF_DARK, STEM, ROSE, TERRA, SOIL, PALE_STONE, MOSS, WATER,
  TULIP_R, TULIP_Y, TULIP_P, LAVENDER, PETAL_Y, SOOT, SKIN, LAMP, WAX, HAY, BURLAP, QUILT_R, QUILT_B, GLASS, LILY,
  type Foot, type PropArt,
} from './homeProps';

// ---------------------------------------------------------------- Materials

const HAT_RED: Material = { ...mat('#1a0204', '#420810', '#6c0e18', '#961a22', '#bc2a2c', '#da443a', '#f0664e', '#fc8e6c'), shine: true };
const COAT = mat('#060a1c', '#0e1838', '#182858', '#223a78', '#2e4e96', '#4064b0', '#5a80c8', '#7a9cdc');
const BEARD = mat('#3a3a42', '#8a8890', '#b2b0b4', '#d2d0d0', '#e8e6e2', '#f6f4ee', '#fffef8');
const NOSE = mat('#2a0e0a', '#7a3c30', '#a45444', '#c8705a', '#e08e74', '#f2aa8e', '#ffc6a8');
const FROGSTONE = mat('#0c120e', '#202a24', '#303c34', '#425046', '#56665a', '#6c7c6c', '#849482', '#9eac98', '#bac6b2');
const CACTUS = mat('#04120c', '#0c2618', '#143a26', '#1d5034', '#286642', '#367c50', '#4c945e', '#6aac70');
const GLAZE: Material = { ...mat('#04121a', '#0a2836', '#123e50', '#1c566a', '#2a7084', '#3e8c9c', '#5aa8b2', '#84c6c8'), shine: true };
const COPPER: Material = { ...mat('#180804', '#361406', '#56220c', '#784016', '#9a5a22', '#b87432', '#d29048', '#e8ae66', '#f8d098'), shine: true };
const VERDI = mat('#06140e', '#14382c', '#205044', '#2e6a5a', '#428472', '#5ca08a');
const HONEY: Material = { ...mat('#2a1402', '#6a3a04', '#a0600a', '#d08c14', '#f0b028', '#ffd250', '#fff09a'), shine: true, emissive: 0.25, noAO: true };
const TEAL_PAINT: Material = { ...mat('#04121a', '#0a2630', '#123a44', '#1c4e58', '#28666e', '#388084', '#4e9a9a', '#6cb4b0'), shine: false };
const WHITEW = mat('#24242a', '#5e5c64', '#848288', '#a8a6aa', '#c8c5c4', '#e0dcd6', '#f0ece4', '#fcfaf2');
const BARN = mat('#140404', '#34090a', '#521010', '#701a16', '#8c261e', '#a8362a', '#c24a38', '#d6644c');
const SLATE = mat('#06080e', '#121822', '#1c2432', '#283244', '#364256', '#46546a', '#5a6a80', '#728498');
const ROBIN = mat('#120a06', '#2e1c12', '#46301e', '#5e432c', '#78583a', '#92704c');
const BREAST = mat('#2a0c02', '#6a2406', '#9a3a0c', '#c45618', '#e2742a', '#f69444');
const CUSHION = mat('#24080e', '#4e1426', '#782240', '#a0345a', '#c24c74', '#dc6c8e', '#f092aa', '#fcb8c8');
const STRIPE = mat('#0a1426', '#162c52', '#22427a', '#30589c', '#4270b6', '#5a8ac8', '#7aa4d8');
const SHADE: Material = { ...mat('#3a2410', '#8a6036', '#b48450', '#d4a670', '#ecc690', '#fae0b0', '#fff2d4'), emissive: 0.55 };
const BAMBOO = mat('#141206', '#363214', '#544e20', '#72692e', '#8e843c', '#a89e4c', '#c2b864', '#d8d084');
const PAPER_PINK: Material = { ...mat('#3a0e1a', '#7a2a40', '#a8445e', '#d06680', '#ec8ea0', '#fcb6c0', '#ffdade'), emissive: 0.7, noAO: true };
const PAPER_PEACH: Material = { ...mat('#3a1a0a', '#7e4220', '#ac6634', '#d68c4e', '#f0ae6c', '#fccc94', '#ffe6c4'), emissive: 0.7, noAO: true };
const TASSEL = mat('#1a0204', '#4a0a0e', '#7a1418', '#a82222', '#d03a2e');
const WAX_PINK = mat('#2a1418', '#6e4450', '#946070', '#ba8290', '#d8a4b0', '#eec4cc', '#fce2e6');
const WAX_HONEY = mat('#2a1a08', '#6a4a1c', '#906a2c', '#b68c42', '#d6ae5e', '#ecca80', '#fae4a8');
const SEEDS_K = mat('#140804', '#3a200c', '#5a3214', '#7a4a1e', '#98622a');
const FALL: Material = { ...mat('#0a2a34', '#2a6a76', '#4a8e96', '#70b2b4', '#a2d4d0', '#d4f0ea'), noAO: true, noOutline: true };

// ---------------------------------------------------------------- Helpers

/** Repaint what's drawn of one material in a rect as another, keeping its shading: stripes, trim and patches. */
function recolor(c: PixelCanvas, x0: number, x1: number, y0: number, y1: number, from: Material, to: Material, keep: (x: number, y: number) => boolean): void {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (c.materialAt(x, y) !== from || !keep(x, y)) continue;
      const i = y * c.w + x;
      c.px(x, y, to, { x: c.nx[i], y: c.ny[i], z: c.nz[i] }, { bias: c.bias[i] });
    }
  }
}

/** Height of a gable roof whose ridge runs north-south over `cx`, falling to `zEave` at `hw` either side. */
const roofZ = (x: number, cx: number, hw: number, zEave: number, zApex: number): number => zApex - (Math.abs(x + 0.5 - cx) / hw) * (zApex - zEave);

/**
 * A gable roof seen from its gable end: the ridge runs away from us over
 * ground rows [yb, yf], the two slopes fall east and west, shingled in
 * courses, with a painted barge board along the front edge.
 */
function gableRoof(c: PixelCanvas, cx: number, hw: number, yb: number, yf: number, zEave: number, zApex: number, m: Material, trim: Material): void {
  c.part();
  for (let x = Math.floor(cx - hw); x < Math.ceil(cx + hw); x++) {
    const d = x + 0.5 - cx;
    if (Math.abs(d) > hw) continue;
    const z = roofZ(x, cx, hw, zEave, zApex);
    const top = Math.round(yb - z);
    const bot = Math.round(yf - z);
    const side = d < 0 ? -1 : 1;
    const course = Math.floor(Math.abs(d) / 3);
    for (let y = top; y <= bot + 1; y++) {
      let b = 0;
      if (Math.abs(d) % 3 < 1) b -= 1;
      if ((y - top + course * 2) % 4 === 0) b -= 1;
      if (Math.abs(d) < 1) b += 1;
      if (y === bot + 1) b = -2;
      c.px(x, y, m, n3(side * 0.6, 0.45, 0.66), { bias: b });
    }
  }
  // The barge board along the front edge.
  c.part();
  for (let x = Math.floor(cx - hw); x < Math.ceil(cx + hw); x++) {
    if (Math.abs(x + 0.5 - cx) > hw) continue;
    const y = Math.round(yf - roofZ(x, cx, hw, zEave, zApex));
    c.px(x, y, trim, FACE, { bias: x < cx ? 1 : 0 });
    c.px(x, y + 1, trim, FACE, { bias: -1 });
  }
}

/** The wall under a gable roof, facing us: from `z0` up to just under the roof. */
function gableWall(c: PixelCanvas, x0: number, x1: number, yf: number, z0: number, cx: number, hw: number, zEave: number, zApex: number, m: Material): void {
  c.part();
  for (let x = x0; x < x1; x++) {
    const top = Math.round(yf - roofZ(x, cx, hw, zEave, zApex)) + 1;
    for (let y = top; y < yf - z0; y++) c.px(x, y, m, FACE, { bias: (x === x0 ? 1 : x === x1 - 1 ? -1 : 0) + (y === yf - z0 - 1 && z0 === 0 ? -1 : 0) });
  }
}

/** A little flower: four petals round a bright eye. */
function posy(c: PixelCanvas, x: number, y: number, petal: Material, eye: Material = PETAL_Y): void {
  c.part();
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) c.px(x + dx, y + dy, petal, sphere(dx * 0.5, -dy * 0.5), { bias: dy < 0 || dx < 0 ? 2 : 1 });
  c.px(x, y, eye, TOP, { bias: 2 });
}

/** A round lantern of paper on its little cap and foot, ribbed, a tassel under it. */
function paperLantern(c: PixelCanvas, x: number, y: number, r: number, m: Material, f: number, k: number): void {
  const breath = [0, 1, 1, 0][(f + k) % 4];
  c.part();
  c.ellipse(x, y, r, r * 1.05, m, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.8), bias: breath });
  // Ribs round it, and its brightest heart.
  for (let yy = Math.floor(y - r); yy <= y + r; yy++) if ((yy - Math.floor(y - r)) % 2 === 1) for (let xx = Math.floor(x - r); xx <= x + r; xx++) if (c.materialAt(xx, yy) === m) c.shade(xx, yy, -1);
  c.shade(x - 1, y, 1);
  c.shade(x, y, 1);
  c.part();
  for (let xx = Math.round(x - r * 0.5); xx < Math.round(x + r * 0.5); xx++) {
    c.px(xx, Math.round(y - r) - 1, DARKW, TOP, { bias: 2 });
    c.px(xx, Math.round(y + r), DARKW, FACE, { bias: 0 });
  }
  c.part();
  c.px(x - 0.5, y + r + 1, TASSEL, FACE, { bias: 1 });
  c.px(x - 0.5, y + r + 2, TASSEL, FACE, { bias: 2 });
  halo(c, x - 0.5, y, r + 4, [255, 170, 150], 0.22 + breath * 0.05);
}

// ---------------------------------------------------------------- Garden

const gnome = art('gnome', 5, 18, (c, g, f) => {
  // A garden gnome in a tall red hat, his beard over a blue coat, holding a
  // tiny lantern out and a toadstool beside his boots.
  const cx = g.cx;
  const gy = g.y1 - 5;
  tufts(c, cx, gy + 2, 6, 2101, 6);
  // The toadstool by his feet.
  c.part();
  c.line(cx - 6, gy + 1, cx - 6, gy - 1, LINEN, () => FACE, { bias: 0 });
  c.part();
  c.ellipse(cx - 6, gy - 2, 1.8, 1.2, TULIP_R, { bias: 1 });
  c.px(cx - 7, gy - 3, LINEN, TOP, { bias: 3 });
  c.px(cx - 5, gy - 2, LINEN, TOP, { bias: 2 });
  // Boots.
  c.part();
  c.ellipse(cx - 2.2, gy - 0.5, 2, 1.3, DARKW, { bias: 2 });
  c.ellipse(cx + 1.7, gy - 0.5, 2, 1.3, DARKW, { bias: 2 });
  // The coat, flaring to its hem.
  c.part();
  c.shape(gy - 11, gy - 1, (y) => {
    const u = (y - gy + 11) / 10;
    const hw = 2.8 + u * 1.8;
    return [cx - hw, cx + hw];
  }, COAT, (_x, _y, t, u) => n3(t * 0.75, 0.25 - u * 0.5, 0.75));
  for (let x = cx - 4; x < cx + 5; x++) c.shade(x, gy - 1, -1);
  // A leather belt with a brass buckle.
  c.part();
  for (let x = cx - 4; x < cx + 4; x++) if (c.materialAt(x, gy - 4) === COAT || c.materialAt(x, gy - 4) === null) if (Math.abs(x + 0.5 - cx) < 4.2) c.px(x, gy - 4, OAKW, cyl((x + 0.5 - cx) / 4.2, -0.2), { bias: 0 });
  c.px(cx - 1, gy - 4, BRASS, FACE, { bias: 2 });
  c.px(cx, gy - 4, BRASS, FACE, { bias: 1 });
  // Arms: one at his side, one holding the lantern out.
  c.part();
  c.capsule(cx - 3.2, gy - 10, cx - 4.6, gy - 6, 1.3, 1.1, COAT);
  c.capsule(cx + 3, gy - 10, cx + 5, gy - 8, 1.3, 1.1, COAT);
  c.part();
  c.ellipse(cx - 4.6, gy - 5.2, 1.1, 1, SKIN, { bias: 1 });
  c.ellipse(cx + 5.6, gy - 7.8, 1.1, 1, SKIN, { bias: 1 });
  // The beard, white and wavy, to a point at his belt.
  c.part();
  c.shape(gy - 13, gy - 3, (y) => {
    const u = (y - gy + 13) / 10;
    const hw = 3.6 * Math.pow(1 - u, 0.7) + 0.4 + (Math.round(y) % 2 ? 0.3 : 0);
    return [cx - hw, cx + hw];
  }, BEARD, (_x, _y, t, u) => n3(t * 0.7, 0.3 - u * 0.5, 0.75));
  for (let y = gy - 12; y < gy - 4; y++) for (let x = cx - 3; x < cx + 3; x++) if (c.materialAt(x, y) === BEARD && (x + y * 2) % 5 === 0) c.shade(x, y, -1);
  // His face under the brim: twinkling eyes, rosy cheeks, a big round nose.
  c.part();
  c.ellipse(cx, gy - 14.5, 3.4, 1.8, SKIN, { flatten: 0.8 });
  c.px(cx - 3, gy - 15, SOOT, FACE, { bias: 1 });
  c.px(cx + 2, gy - 15, SOOT, FACE, { bias: 1 });
  c.px(cx - 3, gy - 14, NOSE, FACE, { bias: 1 });
  c.px(cx + 2, gy - 14, NOSE, FACE, { bias: 0 });
  c.part();
  c.ellipse(cx, gy - 13.5, 1.4, 1.3, NOSE, { bias: 1 });
  // The hat: a tall cone, its tip flopping over to one side.
  c.part();
  c.shape(gy - 27, gy - 16, (y) => {
    const u = (y - gy + 27) / 11;
    const sx = cx + Math.pow(1 - u, 2) * 4;
    const hw = 0.5 + Math.pow(u, 0.9) * 4.1;
    return [sx - hw, sx + hw];
  }, HAT_RED, (_x, _y, t, u) => n3(t * 0.75, 0.45 - u * 0.25, 0.62));
  // A crease where it folds, and the brim's shadow on his brow.
  c.shade(cx + 1, gy - 22, -1);
  c.shade(cx + 2, gy - 23, -1);
  for (let x = cx - 4; x < cx + 5; x++) c.shade(x, gy - 16, -1);
  // The lantern, hanging from his hand.
  const lx = cx + 6;
  c.part();
  c.px(lx, gy - 7, IRON, FACE, { bias: 2 });
  c.px(lx - 1, gy - 6, IRON, TOP, { bias: 2 });
  c.px(lx, gy - 6, IRON, TOP, { bias: 1 });
  for (let y = gy - 5; y < gy - 2; y++) {
    c.px(lx - 2, y, IRON, FACE, { bias: 1 });
    c.px(lx - 1, y, LAMP, FACE, { bias: 2 });
    c.px(lx, y, LAMP, FACE, { bias: 1 });
    c.px(lx + 1, y, IRON, FACE, { bias: -1 });
  }
  for (let x = lx - 2; x < lx + 2; x++) c.px(x, gy - 2, IRON, FACE, { bias: 0 });
  c.spark(lx - 1, gy - 4, FIRE_COLS[f % 2], 0.8);
  halo(c, lx - 0.5, gy - 4, 5, [255, 190, 110], 0.25 + (f % 2) * 0.05);
}, 4, 5);

const frogstatue = art('frogstatue', 3, 12, (c, g) => {
  // A fat stone frog on a round slab, gone green with moss, grinning, a
  // little pink flower growing on its head.
  const cx = g.cx;
  const gy = g.y1 - 6;
  drum(c, cx, gy, 7, 3, 0, 2, PALE_STONE);
  for (let x = cx - 7; x < cx + 7; x++) if (hash2(x, 0, 2201) > 0.6) c.shade(x, gy + 1 + Math.round(Math.sqrt(Math.max(0, 1 - ((x + 0.5 - cx) / 7) ** 2)) * 3) - 1, -1);
  const z = 2;
  const by = gy - z;
  // Haunches either side, the body, then the round belly.
  c.part();
  c.ellipse(cx - 4.5, by - 3, 3, 2.8, FROGSTONE);
  c.ellipse(cx + 4.5, by - 3, 3, 2.8, FROGSTONE, { bias: -1 });
  c.part();
  c.ellipse(cx, by - 5, 5.4, 4.8, FROGSTONE);
  c.part();
  c.ellipse(cx, by - 3.5, 3.2, 2.8, FROGSTONE, { bias: 1, flatten: 0.7 });
  // Front feet with three toes each.
  c.part();
  for (const fx of [cx - 2.5, cx + 2]) {
    c.ellipse(fx, by - 0.8, 1.6, 1, FROGSTONE, { bias: 1 });
    for (const t of [-1, 0, 1]) c.px(fx + t * 1.2, by, FROGSTONE, FACE, { bias: 1 });
  }
  // The broad head and the bulging eyes.
  c.part();
  c.ellipse(cx, by - 9.5, 5.6, 3.4, FROGSTONE);
  c.part();
  for (const ex of [cx - 3, cx + 2.6]) {
    c.ellipse(ex, by - 12.2, 2, 1.9, FROGSTONE, { bias: 1 });
    // A carved pupil, a slit with the light caught above it.
    c.px(ex - 0.3, by - 12, SOOT, FACE, { bias: 1 });
    c.px(ex + 0.7, by - 12, SOOT, FACE, { bias: 0 });
    c.px(ex - 0.8, by - 13.4, FROGSTONE, TOP, { bias: 3 });
  }
  // A wide, contented grin.
  for (let x = cx - 4; x <= cx + 3; x++) c.shade(x, by - 8 - (x === cx - 4 || x === cx + 3 ? 1 : 0), -3);
  // Weathering: pits and a hairline crack.
  for (let y = by - 15; y < by + 1; y++) for (let x = cx - 8; x < cx + 8; x++) if (c.materialAt(x, y) === FROGSTONE && hash2(x, y, 2202) > 0.9) c.shade(x, y, -1);
  c.shade(cx + 3, by - 5, -2);
  c.shade(cx + 4, by - 4, -2);
  c.shade(cx + 4, by - 3, -2);
  // Moss where rain sits: crown, shoulders, the tops of the haunches.
  c.part();
  for (let y = by - 15; y < by - 2; y++) {
    for (let x = cx - 8; x < cx + 8; x++) {
      if (c.materialAt(x, y) !== FROGSTONE) continue;
      const above = c.materialAt(x, y - 1);
      const crown = above === null || above === MOSS || c.materialAt(x, y - 2) === null;
      // Not over its eyes: they should stay clear to see it grin.
      const eyes = y < by - 10 && Math.abs(x + 0.5 - cx) < 5.5;
      if (crown && !eyes && hash2(x, y, 2203) > 0.45) c.px(x, y, MOSS, sphere((x - cx) / 8, 0.6), { bias: hash2(x, y, 2204) > 0.6 ? 1 : 0 });
    }
  }
  // The flower between its eyes.
  c.part();
  c.line(cx, by - 12, cx, by - 13, STEM);
  posy(c, cx, by - 15, TULIP_P);
  tufts(c, cx, gy + 3, 8, 2205, 6);
});

/** A terracotta pot (or glazed one) with its soil showing. */
function pot(c: PixelCanvas, x: number, gy: number, rx: number, h: number, m: Material): void {
  drum(c, x, gy, rx, rx * 0.52, 0, h, m, SOIL, { topBias: -1 });
  drum(c, x, gy, rx + 0.5, (rx + 0.5) * 0.52, h - 1.5, h, m, null, { bias: 1 });
  c.part();
  for (let xx = Math.floor(x - rx * 0.6); xx < x + rx * 0.6; xx++) c.px(xx, gy - h, SOIL, TOP, { bias: hash2(xx, gy, 2301) > 0.6 ? 1 : 0 });
}

/** Ribs down a cactus (darker grooves) and pale spines along the ridges. */
function ribs(c: PixelCanvas, cx: number, x0: number, x1: number, y0: number, y1: number, step: number, seed: number): void {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (c.materialAt(x, y) !== CACTUS) continue;
      const k = Math.round(x + 0.5 - cx);
      if (k % step === 0) c.shade(x, y, -1);
      else if ((y + (k & 1)) % 3 === 0 && hash2(x, y, seed) > 0.25) c.px(x, y, LINEN, FACE, { bias: x < cx ? 2 : 1 });
    }
  }
}

const cacti = art('cacti', 4, 18, (c, g) => {
  // Three cacti in pots: a tall one with arms at the back, a round barrel in
  // a glazed pot in bloom, and a little paddle one at the front.
  const cx = g.cx;
  const gy = g.y1 - 6;
  // The tall one.
  const tx = cx + 2;
  const ty = gy - 4;
  pot(c, tx, ty, 3.3, 5, TERRA);
  c.part();
  c.capsule(tx - 0.5, ty - 6, tx - 4.5, ty - 10, 1.4, 1.2, CACTUS);
  c.capsule(tx - 4.5, ty - 10, tx - 4.5, ty - 14, 1.2, 1.2, CACTUS);
  c.capsule(tx + 0.5, ty - 9, tx + 3.8, ty - 12, 1.2, 1.1, CACTUS);
  c.capsule(tx + 3.8, ty - 12, tx + 3.8, ty - 15, 1.1, 1.1, CACTUS);
  c.part();
  c.shape(ty - 21, ty - 5, (y) => {
    const u = (y - ty + 21) / 16;
    const hw = u < 0.15 ? 0.8 + (u / 0.15) * 1.2 : 2;
    return [tx - 0.5 - hw, tx - 0.5 + hw];
  }, CACTUS, (_x, _y, t) => cyl(t, 0.1));
  ribs(c, tx - 0.5, tx - 7, tx + 6, ty - 22, ty - 5, 2, 2302);
  // The barrel cactus in its glazed pot, a pink flower on its crown.
  const bx = cx - 3.5;
  const byy = gy + 1;
  pot(c, bx, byy, 3.5, 4, GLAZE);
  for (let x = Math.floor(bx - 3.5); x < bx + 3.5; x++) c.shade(x, byy + Math.round(Math.sqrt(Math.max(0, 1 - ((x + 0.5 - bx) / 3.5) ** 2)) * 1.8) - 2, 1);
  c.part();
  c.ellipse(bx, byy - 7.5, 3.3, 3.4, CACTUS);
  ribs(c, bx, bx - 4, bx + 4, byy - 11, byy - 4, 2, 2303);
  c.part();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.4;
    c.capsule(bx, byy - 11.5, bx + Math.cos(a) * 2.3, byy - 11.5 + Math.sin(a) * 1.4, 0.9, 0.6, TULIP_P, { bias: 1 });
  }
  c.part();
  c.px(bx - 0.5, byy - 12, PETAL_Y, TOP, { bias: 2 });
  c.px(bx + 0.5, byy - 11, PETAL_Y, TOP, { bias: 1 });
  // The little paddle cactus, a yellow bud on its top pad.
  const px = cx + 4.5;
  const py = gy + 2.5;
  pot(c, px, py, 2.5, 3, TERRA);
  c.part();
  c.ellipse(px - 0.5, py - 6, 1.8, 2.6, CACTUS, { flatten: 0.6 });
  c.part();
  c.ellipse(px + 1.3, py - 9.2, 1.4, 1.9, CACTUS, { flatten: 0.6, bias: -1 });
  c.ellipse(px - 2, py - 9, 1.2, 1.6, CACTUS, { flatten: 0.6 });
  for (const [dx, dy] of [[-1, -7], [0, -5], [1, -9], [-2, -9], [0, -4], [2, -10]]) c.px(px + dx, py + dy, LINEN, FACE, { bias: 1 });
  c.part();
  c.px(px + 1, py - 11, TULIP_Y, TOP, { bias: 2 });
  c.px(px + 2, py - 11, TULIP_Y, TOP, { bias: 1 });
});

const wateringcan = art('wateringcan', 4, 8, (c, g) => {
  // A copper watering can left in the grass: round body with rolled seams,
  // a long spout and its rose, a hoop handle over the top and one behind.
  const cx = g.cx - 2;
  const gy = g.y1 - 6;
  tufts(c, cx + 1, gy + 3, 9, 2401, 7);
  // The handle behind, curving off its back.
  c.part();
  c.capsule(cx - 4, gy - 7, cx - 6.5, gy - 5.5, 0.8, 0.8, COPPER);
  c.capsule(cx - 6.5, gy - 5.5, cx - 4, gy - 2, 0.8, 0.8, COPPER);
  drum(c, cx, gy, 4.4, 2.4, 0, 8, COPPER, COPPER, { topBias: 0 });
  // Rolled seams near its foot and its shoulder, and a few rivets.
  for (const z of [1, 7]) {
    for (let x = Math.floor(cx - 4.4); x < cx + 4.4; x++) {
      const t = (x + 0.5 - cx) / 4.4;
      if (Math.abs(t) > 1) continue;
      const y = Math.round(gy - z + Math.sqrt(1 - t * t) * 2.4);
      c.shade(x, y, z === 7 ? 1 : -1);
    }
  }
  c.shade(cx - 2, gy - 3, -2);
  c.shade(cx + 2, gy - 3, -2);
  // Verdigris creeping round the foot.
  recolor(c, cx - 5, cx + 5, gy - 1, gy + 3, COPPER, VERDI, (x, y) => hash2(x, y, 2402) > 0.55);
  // The filler on top, and the top handle arching over it.
  c.part();
  c.ellipse(cx - 1.5, gy - 8.5, 1.8, 0.9, SOOT, { normal: () => TOP });
  c.part();
  const N = 10;
  for (let k = 0; k < N; k++) {
    const a0 = Math.PI + (k / N) * Math.PI;
    const a1 = Math.PI + ((k + 1) / N) * Math.PI;
    c.capsule(cx + Math.cos(a0) * 3.4, gy - 8 + Math.sin(a0) * 4, cx + Math.cos(a1) * 3.4, gy - 8 + Math.sin(a1) * 4, 0.75, 0.75, COPPER);
  }
  // The spout, from low on its front up and out, and the rose on its end.
  c.part();
  c.capsule(cx + 3, gy - 2.5, cx + 9, gy - 9, 1.3, 0.8, COPPER);
  c.part();
  c.ellipse(cx + 9.6, gy - 9.8, 1.5, 1.9, COPPER, { bias: 1 });
  c.shade(cx + 9, gy - 10, -2);
  c.shade(cx + 10, gy - 9, -2);
  c.shade(cx + 10, gy - 11, -2);
  // A last drop hanging from it, and a daisy it was watering.
  c.part();
  c.px(cx + 10, gy - 7, FALL, FACE, { bias: 4 });
  posy(c, cx + 8, gy + 1, LINEN);
  c.part();
  c.line(cx + 8, gy + 2, cx + 8, gy + 3, STEM);
});

const beehive = art('beehive', 4, 14, (c, g, f) => {
  // A straw skep on a little wooden stand: coils of straw bound with willow,
  // a dark door at its foot with honey running from it, bees coming and
  // going, and lavender beside it for them.
  const cx = g.cx;
  const gy = g.y1 - 6;
  // Lavender at its foot, behind.
  c.part();
  for (let k = 0; k < 3; k++) {
    const x = cx + 6 + k * 2;
    const lean = k - 1;
    const h = 6 + (k % 2) * 2;
    c.line(x, gy, x + lean, gy - h, STEM);
    for (let j = 0; j < 3; j++) c.px(x + lean, gy - h - 1 - j, LAVENDER, sphere(-0.3, 0.4), { bias: 2 - j });
  }
  // The stand: a board on four legs.
  for (const x of [cx - 6, cx + 5]) box(c, x, x + 1, gy - 3, gy - 2, 0, 5, DARKW);
  box(c, cx - 7, cx + 7, gy - 3, gy + 2, 5, 7, PALEW);
  grain(c, cx - 7, cx + 7, gy - 10, gy - 5, 2501);
  for (const x of [cx - 6, cx + 5]) box(c, x, x + 1, gy + 1, gy + 2, 0, 5, DARKW);
  // The skep, built up in coils from the board: each slice a full disc, so
  // the higher ones cover the lower ones' tops.
  const base = gy - 7;
  const H = 13;
  const R0 = 5.8;
  c.part();
  for (let z = 0; z <= H; z += 0.5) {
    const r = R0 * Math.pow(Math.max(0, 1 - Math.pow(z / H, 2.2)), 0.5) + (z < 1 ? -0.3 : 0);
    if (r < 0.6) continue;
    const ry = r * 0.5;
    const coil = Math.floor(z / 2.2);
    const ph = (z % 2.2) / 2.2;
    for (let y = Math.floor(base - z - ry); y <= base - z + ry; y++) {
      for (let x = Math.floor(cx - r); x < cx + r; x++) {
        const dx = (x + 0.5 - cx) / r;
        const dy = (y + 0.5 - (base - z)) / ry;
        if (dx * dx + dy * dy > 1) continue;
        let b = ph > 0.55 ? 1 : ph < 0.2 ? -1 : 0;
        // Willow binding, stitched round each coil, staggered.
        if (dy > 0.3) {
          const a = Math.asin(Math.max(-1, Math.min(1, dx)));
          const s = (a * 2.4 + coil * 0.5 + 10) % 1;
          if (s < 0.14 && ph > 0.15) b -= 2;
        }
        c.px(x, y, HAY, n3(dx * 0.8, -dy * 0.35 + (z / H) * 0.9, 0.6), { bias: b });
      }
    }
  }
  // Its little door, and honey running from the sill down the board.
  const fy = Math.round(base + R0 * 0.5) - 1;
  c.part();
  for (let y = fy - 3; y <= fy; y++) for (let x = cx - 2; x < cx + 2; x++) if (!(y === fy - 3 && (x === cx - 2 || x === cx + 1))) c.px(x, y, SOOT, FACE, { bias: y === fy ? 0 : 1 });
  c.part();
  for (let x = cx - 2; x < cx + 3; x++) c.px(x, fy + 1, HONEY, TOP, { bias: x === cx ? 2 : 1 });
  c.px(cx + 2, fy + 2, HONEY, FACE, { bias: 1 });
  c.px(cx + 2, fy + 3, HONEY, FACE, { bias: 0 });
  c.px(cx + 2, gy + 2 - 5, HONEY, FACE, { bias: 2 });
  c.px(cx + 2, gy + 2 - 4, HONEY, FACE, { bias: 1 });
  c.px(cx + 2, gy + 2 - 3, HONEY, sphere(-0.4, 0.3), { bias: 2 });
  // Bees: yellow and black, their wings a shimmer in the glow.
  const bees: [number, number, number][] = [[cx - 7, gy - 15, 0], [cx + 6, gy - 18, 1], [cx + 1, gy - 23, 0], [cx - 3, gy - 6, 1]];
  c.part();
  for (const [x, y, d] of bees) {
    c.px(x, y, PETAL_Y, FACE, { bias: 2 });
    c.px(x + (d ? -1 : 1), y, SOOT, FACE, { bias: 2 });
    c.px(x + (d ? 1 : -1), y, PETAL_Y, FACE, { bias: 0 });
  }
  for (const [x, y, d] of bees) {
    const up = (f + d) % 2;
    c.spark(x, y - 1 - up, [235, 245, 255], 0.55);
    c.spark(x + (d ? -1 : 1), y - 1 - (1 - up), [235, 245, 255], 0.35);
  }
}, 2, 10);

const birdhouse = art('birdhouse', 6, 28, (c, g) => {
  // A painted birdhouse on a post: teal walls, a white ring round its door
  // and a perch below, a red shingled roof, and a robin sitting on the ridge.
  const cx = g.cx;
  const gy = g.y1 - 6;
  box(c, cx - 1, cx + 1, gy - 1, gy + 1, 0, 17, OAKW);
  grain(c, cx - 1, cx + 1, gy - 18, gy + 1, 2601, false);
  // A bracket under the floor.
  c.part();
  c.line(cx - 1, gy - 11, cx - 3, gy - 15, OAKW, () => FACE, { bias: 1 });
  c.line(cx, gy - 11, cx + 2, gy - 15, OAKW, () => FACE, { bias: -1 });
  const yf = gy + 2;
  const hw = 7.5;
  const zE = 23;
  const zA = 30;
  box(c, cx - 5, cx + 5, gy - 4, yf, 15, 16, OAKW, { bias: -1 });
  gableWall(c, cx - 5, cx + 5, yf, 16, cx, hw, zE, zA, TEAL_PAINT);
  // Boards up the front.
  for (let x = cx - 5; x < cx + 5; x++) if ((x - cx + 5) % 3 === 2) for (let y = yf - 30; y < yf - 16; y++) if (c.materialAt(x, y) === TEAL_PAINT) c.shade(x, y, -1);
  // The door: a white ring, the dark round hole, the perch peg below.
  c.part();
  c.ellipse(cx, yf - 22, 2.5, 2.5, WHITEW);
  c.part();
  c.ellipse(cx, yf - 22, 1.6, 1.6, SOOT, { normal: () => FACE });
  c.part();
  c.px(cx - 1, yf - 18, OAKW, TOP, { bias: 2 });
  c.px(cx, yf - 18, OAKW, TOP, { bias: 1 });
  c.px(cx - 1, yf - 17, OAKW, FACE, { bias: -1 });
  c.px(cx, yf - 17, OAKW, FACE, { bias: -1 });
  // A painted flower either side of it.
  posy(c, cx - 3.5, yf - 19, WHITEW, TULIP_R);
  posy(c, cx + 3, yf - 19, WHITEW, TULIP_R);
  gableRoof(c, cx, hw, gy - 5, yf + 1, zE, zA, BARN, WHITEW);
  // The robin, perched on the ridge.
  c.part();
  const rx = cx + 1;
  const ry = gy - 5 - zA + 3;
  c.ellipse(rx, ry, 2, 1.5, ROBIN, { bias: 1 });
  c.px(rx + 2, ry + 1, ROBIN, FACE, { bias: 0 });
  c.px(rx + 3, ry + 1, ROBIN, FACE, { bias: -1 });
  c.part();
  c.ellipse(rx - 1.5, ry - 2, 1.4, 1.3, ROBIN, { bias: 2 });
  c.px(rx - 2, ry, BREAST, FACE, { bias: 2 });
  c.px(rx - 1, ry, BREAST, FACE, { bias: 1 });
  c.px(rx - 2, ry + 1, BREAST, FACE, { bias: 1 });
  c.px(rx - 3, ry - 2, SOOT, FACE, { bias: 2 });
  c.px(rx - 4, ry - 2, PETAL_Y, FACE, { bias: 1 });
  // Flowers round the post's foot.
  tufts(c, cx, gy + 2, 6, 2602, 6);
  posy(c, cx - 4, gy, TULIP_Y, OAKW);
  posy(c, cx + 4, gy + 1, LAVENDER);
});

// ---------------------------------------------------------------- The deck chair

/** A deck chair's cushion: stripes running from its back to its front. */
function cushionStripes(c: PixelCanvas, x0: number, x1: number, y0: number, y1: number, across: boolean): void {
  recolor(c, x0, x1, y0, y1, LINEN, STRIPE, (x, y) => (across ? Math.floor((y - y0) / 2) : Math.floor((x - x0) / 2)) % 2 === 0);
}

const DECK_TOP = (k: number, n: number): number => 20 + Math.round(Math.cos(((k + 0.5) / n - 0.5) * Math.PI) * 3);

const deckchair = art('deckchair', 3, 24, (c, g) => {
  // An Adirondack chair facing us: a fan of slats leaning back, a striped
  // cushion on the seat, broad flat arms, and a glass of lemonade on one.
  const cx = g.cx;
  const x0 = cx - 7;
  const x1 = cx + 7;
  const yb = g.y0 + 4;
  const yf = g.y1 - 3;
  for (const x of [x0 + 2, x1 - 3]) box(c, x, x + 1, yb, yb + 1, 0, 9, DARKW);
  // A rail behind the slats, showing between them.
  box(c, cx - 6, cx + 6, yb, yb + 1, 14, 16, PALEW, { bias: -2 });
  // The slats, reclined, their tops fanning.
  c.part();
  const slats = 4;
  for (let k = 0; k < slats; k++) {
    const sx = cx - 5 + k * 3;
    const top = DECK_TOP(k, slats);
    for (let z = 6; z < top; z++) {
      for (let x = sx; x < sx + 2; x++) {
        const y = yb + 1 - z;
        const cap = z === top - 1;
        c.px(x, y, PALEW, n3(0, -0.1, 0.95), { bias: (x === sx ? 1 : 0) + (cap ? 1 : 0) });
      }
    }
  }
  grain(c, cx - 5, cx + 6, yb - 23, yb - 5, 2701, false);
  // Seat and cushion.
  box(c, x0 + 1, x1 - 1, yb + 1, yf - 1, 5, 7, PALEW);
  box(c, cx - 5, cx + 6, yb + 1, yf - 2, 7, 9, LINEN, { topBias: 1 });
  cushionStripes(c, cx - 5, cx + 6, yb - 10, yf - 9, false);
  c.shade(cx, yb + 1 - 9 + 3, -2);
  // Front legs, then the broad arms on top of them.
  for (const x of [x0, x1 - 2]) box(c, x, x + 2, yf - 2, yf, 0, 10, PALEW, { bias: -1 });
  for (const x of [x0 - 1, x1 - 2]) {
    box(c, x, x + 3, yb, yf + 1, 10, 11, PALEW);
    grain(c, x, x + 3, yb - 11, yf - 9, 2702 + x, false);
  }
  // The lemonade, on the right arm.
  const gx = x1 - 0.5;
  drum(c, gx, yf - 3, 1.2, 0.7, 11, 15, GLASS, PETAL_Y);
  c.part();
  c.px(gx - 1, yf - 3 - 14, GLASS, FACE, { bias: 4 });
  c.px(gx, yf - 3 - 16, TULIP_Y, TOP, { bias: 2 });
});

const deckchairSide = sized(1, 1, 3, 24, (c, g) => {
  // Facing east: the slatted back reclined along the west, the arms seen end to end.
  const cx = g.cx;
  const yN = g.y0 + 2;
  const yS = g.y1 - 2;
  const xb = cx - 4;
  const xf = cx + 5;
  // The far arm and its leg, with the lemonade on it.
  box(c, xf - 2, xf, yN, yN + 1, 0, 10, PALEW, { bias: -1 });
  box(c, xb - 2, xf + 2, yN - 1, yN + 2, 10, 11, PALEW, { bias: -1 });
  drum(c, xf - 0.5, yN + 0.5, 1.2, 0.7, 11, 15, GLASS, PETAL_Y);
  c.part();
  c.px(xf - 1.5, yN - 14, GLASS, FACE, { bias: 4 });
  // The back, leaning away west: its slats run up its face, gaps between.
  c.part();
  const slats = 4;
  for (let z = 6; z < 24; z++) {
    const lean = Math.round((z - 6) * 0.3);
    for (let yg = yN + 1; yg < yS; yg++) {
      const k = Math.floor((yg - yN - 1) / 3);
      if ((yg - yN - 1) % 3 === 2 || k >= slats) continue;
      if (z >= DECK_TOP(k, slats)) continue;
      for (let w = 0; w < 2; w++) c.px(xb - lean - w, yg - z, PALEW, n3(-0.2, 0.55, 0.8), { bias: w === 0 ? 0 : 1 });
    }
  }
  // Seat and striped cushion, the stripes now running across.
  box(c, xb - 1, xf + 1, yN + 1, yS - 1, 5, 7, PALEW);
  box(c, xb, xf, yN + 2, yS - 2, 7, 9, LINEN, { topBias: 1 });
  cushionStripes(c, xb, xf, yN - 7, yS - 9, true);
  // The near arm on its leg, and the back legs.
  box(c, xb - 1, xb + 1, yS - 2, yS - 1, 0, 7, DARKW);
  box(c, xf - 2, xf, yS - 2, yS, 0, 10, PALEW);
  box(c, xb - 2, xf + 2, yS - 2, yS + 1, 10, 11, PALEW);
  grain(c, xb - 2, xf + 2, yS - 13, yS - 10, 2711);
});

const deckchairBack = sized(1, 1, 3, 24, (c, g) => {
  // Its back to us: the slats' backs and two rails across them, the arms reaching away.
  const cx = g.cx;
  const x0 = cx - 7;
  const x1 = cx + 7;
  const yN = g.y0 + 3;
  const yS = g.y1 - 4;
  for (const x of [x0, x1 - 2]) box(c, x, x + 2, yN, yN + 2, 0, 10, PALEW, { bias: -1 });
  for (const x of [x0 - 1, x1 - 2]) box(c, x, x + 3, yN - 1, yS + 1, 10, 11, PALEW);
  // The lemonade, on the left arm now.
  drum(c, x0 + 0.5, yN + 1, 1.2, 0.7, 11, 15, GLASS, PETAL_Y);
  c.part();
  c.px(x0 - 0.5, yN + 1 - 14, GLASS, FACE, { bias: 4 });
  box(c, x0 + 1, x1 - 1, yN + 1, yS, 5, 7, PALEW, { bias: -1 });
  c.part();
  const slats = 4;
  for (let k = 0; k < slats; k++) {
    const sx = cx - 5 + k * 3;
    const top = DECK_TOP(k, slats);
    for (let z = 3; z < top; z++) for (let x = sx; x < sx + 2; x++) c.px(x, yS - z, PALEW, n3(0, -0.6, 0.75), { bias: (x === sx ? 0 : -1) + (z === top - 1 ? 2 : 0) });
  }
  grain(c, cx - 5, cx + 6, yS - 23, yS - 3, 2721, false);
  for (const [z0, z1] of [[8, 10], [15, 17]]) box(c, cx - 7, cx + 7, yS, yS + 1, z0, z1, PALEW);
  for (const x of [x0 + 2, x1 - 3]) box(c, x, x + 1, yS, yS + 1, 0, 9, DARKW);
});

// ---------------------------------------------------------------- Wheelbarrow

const wheelbarrow = art('wheelbarrow', 2, 18, (c, g) => {
  // A wooden wheelbarrow heaped with soil and flowers:
  // its spoked wheel at the east end, its handles reaching back west.
  const yc = g.cy;
  const yN = yc - 5;
  const yS = yc + 4;
  const xa = g.x0 + 8;
  const xb = g.x1 - 10;
  const wx = xb + 5;
  // The far handle and leg.
  c.part();
  c.capsule(wx - 1, yN - 5, g.x0 + 2, yN - 9, 0.8, 0.8, DARKW);
  // The wheel: an iron tyre on a wooden rim, six spokes, a brass hub.
  c.part();
  const wy = yc - 5;
  const R = 5.2;
  for (let y = Math.floor(wy - R); y <= wy + R; y++) {
    for (let x = Math.floor(wx - R); x <= wx + R; x++) {
      const dx = x + 0.5 - wx;
      const dy = y + 0.5 - wy;
      const d = Math.hypot(dx, dy);
      if (d > R) continue;
      const nrm = n3((dx / R) * 0.6, (-dy / R) * 0.6, 0.6);
      if (d > R - 1.1) c.px(x, y, IRON, nrm, { bias: dy < 0 ? 1 : 0 });
      else if (d > R - 2.1) c.px(x, y, OAKW, nrm, { bias: 0 });
      else {
        const a = (Math.atan2(dy, dx) / (Math.PI * 2)) * 6 + 6;
        if (Math.abs(a - Math.round(a)) < 0.17 + 0.3 / Math.max(1, d)) c.px(x, y, PALEW, FACE, { bias: 0 });
      }
    }
  }
  c.part();
  c.ellipse(wx, wy, 1.2, 1.2, BRASS, { bias: 1 });
  // The tray: its sides flaring, the front end raked out over the wheel.
  c.part();
  for (let z = 5; z <= 13; z++) {
    const u = (z - 5) / 8;
    const l = xa + 2 - u * 2;
    const r = xb - 1 + u * 5;
    const y = yS - z;
    for (let x = Math.round(l); x < Math.round(r); x++) {
      let b = (z - 5) % 3 === 2 ? -1 : 0;
      if (x === Math.round(l)) b += 1;
      if (z === 13) b += 1;
      c.px(x, y, OAKW, FACE, { bias: b });
    }
  }
  grain(c, xa, xb + 4, yS - 13, yS - 4, 2801);
  // Iron straps at its corners.
  for (let z = 5; z <= 13; z++) {
    const u = (z - 5) / 8;
    c.px(Math.round(xa + 2 - u * 2) + 1, yS - z, IRON, FACE, { bias: 1 });
    c.px(Math.round(xb - 1 + u * 5) - 2, yS - z, IRON, FACE, { bias: 0 });
  }
  // Inside: the far rim, then a heap of soil.
  c.part();
  for (let x = xa; x < xb + 4; x++) c.px(x, yN - 13, PALEW, TOP, { bias: 1 });
  c.part();
  for (let y = yN - 12; y < yS - 13; y++) {
    for (let x = xa + 1; x < xb + 3; x++) {
      const heap = Math.sin(((x - xa) / (xb + 3 - xa)) * Math.PI);
      c.px(x, y - (heap > 0.6 && y < yN - 9 ? 1 : 0), SOIL, n3(0, 0.4, 0.9), { bias: (hash2(x, y, 2802) > 0.6 ? 1 : 0) + (heap > 0.7 ? 1 : 0) });
    }
  }
  // Flowers planted in it: stems, leaves, then their heads, back to front.
  const R2 = rng(2803);
  const heads = [TULIP_R, TULIP_Y, TULIP_P, LAVENDER, ROSE, TULIP_Y, TULIP_P, TULIP_R, LINEN, ROSE, LAVENDER, TULIP_Y];
  const list = heads.map((m, k) => ({ m, x: xa + 3 + k * 1.6 + (R2() - 0.5) * 1.5, y: yN - 11 + R2() * 6, h: 2 + R2() * 3 })).sort((a, b) => a.y - b.y);
  for (const fl of list) {
    c.part();
    c.line(fl.x, fl.y, fl.x + (R2() - 0.5), fl.y - fl.h, STEM);
    c.ellipse(fl.x + (R2() < 0.5 ? -1.4 : 1.4), fl.y - fl.h * 0.4, 1.4, 0.9, LEAF, { flatten: 0.7 });
    if (fl.m === ROSE) rose(c, fl.x, fl.y - fl.h - 1, ROSE);
    else posy(c, Math.round(fl.x), Math.round(fl.y - fl.h - 1), fl.m, fl.m === TULIP_Y ? OAKW : PETAL_Y);
  }
  // Ivy spilling over the front edge.
  c.part();
  for (let k = 0; k < 4; k++) {
    const x = xa + 6 + k * 4;
    for (let j = 0; j < 2 + (k % 2) * 2; j++) c.px(x + (j % 2), yS - 13 + j, LEAF_DARK, sphere(0, 0), { bias: 2 - (j % 2) });
  }
  // The near handle and leg, in front of everything.
  c.part();
  c.capsule(wx - 1, yS - 5, g.x0 + 3, yS - 9, 0.9, 0.9, OAKW);
  c.capsule(g.x0 + 3, yS - 9, g.x0 + 0.5, yS - 9.5, 1.1, 1.1, DARKW);
  c.part();
  c.line(xa + 2, yS - 7, xa + 1, yS, OAKW, () => FACE, { bias: -1 });
  c.px(xa + 1, yS, OAKW, FACE, { bias: -1 });
  tufts(c, g.cx, g.y1 - 2, 14, 2804, 8);
});

// ---------------------------------------------------------------- Doghouse

const DOG_EAVE = 14;
const DOG_APEX = 26;

/** A doghouse seen from a gable end, its door in it or not (its back). */
function kennelEnd(door: boolean): (c: PixelCanvas, g: Foot) => void {
  return (c, g) => {
    const cx = g.cx;
    const x0 = g.x0 + 3;
    const x1 = g.x1 - 3;
    const yb = g.y0 + 3;
    const yf = g.y1 - 4;
    const hw = (x1 - x0) / 2 + 2;
    box(c, x0 - 1, x1 + 1, yb, yf + 1, 0, 1, DARKW, { bias: -1 });
    gableWall(c, x0, x1, yf, 0, cx, hw, DOG_EAVE, DOG_APEX, BARN);
    // Clapboards, white corner boards.
    for (let y = yf - DOG_APEX; y < yf; y++) for (let x = x0; x < x1; x++) if (c.materialAt(x, y) === BARN && (yf - y) % 3 === 0) c.shade(x, y, -1);
    if (!door) for (let y = yf - DOG_APEX; y < yf; y++) for (let x = x0; x < x1; x++) if (c.materialAt(x, y) === BARN) c.shade(x, y, -1);
    recolor(c, x0, x1, yf - 20, yf, BARN, WHITEW, (x) => x === x0 || x === x1 - 1);
    if (door) {
      // The arched doorway, a white arch round it, a cushion glimpsed inside.
      const dw = 5;
      const dh = 10;
      c.part();
      for (let y = yf - dh - 1; y < yf; y++) {
        const k = y - (yf - dh - 1);
        const hw2 = k < 3 ? [2.6, 4.2, 5][k] + 1 : dw + 1;
        for (let x = Math.round(cx - hw2); x < Math.round(cx + hw2); x++) c.px(x, y, WHITEW, FACE, { bias: x < cx ? 1 : 0 });
      }
      c.part();
      for (let y = yf - dh; y < yf; y++) {
        const k = y - (yf - dh);
        const hw2 = k < 3 ? [2.2, 3.6, 4.4][k] : dw;
        for (let x = Math.round(cx - hw2); x < Math.round(cx + hw2); x++) c.px(x, y, SOOT, FACE, { bias: y > yf - 3 ? 0 : 1 });
      }
      c.part();
      for (let x = cx - 4; x < cx + 4; x++) c.px(x, yf - 1, QUILT_R, TOP, { bias: x < cx - 2 ? 0 : -1 });
      // The name plate above it, its letters burnt in, a nail each end.
      box(c, cx - 5, cx + 5, yf - 1, yf, 13, 16, PALEW);
      for (const x of [cx - 3, cx - 2, cx, cx + 2, cx + 3]) c.shade(x, yf - 15 + (x & 1), -3);
      c.shade(cx - 1, yf - 14, -3);
      c.shade(cx + 1, yf - 15, -3);
      c.px(cx - 5, yf - 15, IRON, FACE, { bias: 2 });
      c.px(cx + 4, yf - 15, IRON, FACE, { bias: 1 });
    } else {
      // A round vent high in the back wall.
      c.part();
      c.ellipse(cx, yf - 17, 1.6, 1.6, SOOT, { normal: () => FACE });
    }
    gableRoof(c, cx, hw, yb - 1, yf + 1, DOG_EAVE, DOG_APEX, SLATE, WHITEW);
    if (door) {
      // A bowl of kibble and a bone on the grass out front.
      drum(c, x1 - 1, g.y1 - 1, 2.6, 1.3, 0, 2, QUILT_B, SEEDS_K);
      c.part();
      const bx = x0 + 2;
      const by = g.y1 - 1;
      c.line(bx, by, bx + 3, by - 1, LINEN, () => TOP, { bias: 1 });
      for (const [dx, dy] of [[-1, 0], [0, 1], [3, -2], [4, -1]]) c.px(bx + dx, by + dy, LINEN, TOP, { bias: 2 });
    }
    tufts(c, cx, g.y1, 14, door ? 2901 : 2902, 7);
  };
}


const doghouse = art('doghouse', 2, 30, kennelEnd(true));

const doghouseSide = sized(1, 2, 4, 26, (c, g) => {
  // Its door facing east, so its ridge runs away from us: the south gable end
  // a tiny house front of clapboards, the two slopes side by side behind it,
  // shingle courses down their length. The bowl and a ball wait by the east wall.
  const cx = g.cx;
  const x0 = g.x0 + 2;
  const x1 = g.x1 - 2;
  const yb = g.y0 + 3;
  const yf = g.y1 - 3;
  const hw = (x1 - x0) / 2 + 2;
  const zA = 22;
  box(c, x0 - 1, x1 + 1, yb, yf + 1, 0, 1, DARKW, { bias: -1 });
  // The east wall's foot, where the bowl and ball sit.
  drum(c, x1 + 1.5, yf - 9, 2.4, 1.2, 0, 2, QUILT_B, SEEDS_K);
  c.part();
  c.ellipse(x1 + 2, yf - 3, 1.5, 1.4, TULIP_R, { bias: 1 });
  c.px(x1 + 1, yf - 4, LINEN, TOP, { bias: 2 });
  c.px(x1 + 2, yf - 4, LINEN, TOP, { bias: 1 });
  gableWall(c, x0, x1, yf, 0, cx, hw, DOG_EAVE, zA, BARN);
  for (let y = yf - zA; y < yf; y++) for (let x = x0; x < x1; x++) if (c.materialAt(x, y) === BARN && (yf - y) % 3 === 0) c.shade(x, y, -1);
  recolor(c, x0, x1, yf - zA, yf, BARN, WHITEW, (x) => x === x0 || x === x1 - 1);
  // A round vent in the little gable.
  c.part();
  c.ellipse(cx, yf - 16, 1.6, 1.5, SOOT, { normal: () => FACE });
  gableRoof(c, cx, hw, yb - 1, yf + 1, DOG_EAVE, zA, SLATE, WHITEW);
  // The north gable's barge board, showing over the far end of the ridge.
  c.part();
  for (let x = Math.floor(cx - hw); x < Math.ceil(cx + hw); x++) {
    if (Math.abs(x + 0.5 - cx) > hw) continue;
    c.px(x, Math.round(yb - 1 - roofZ(x, cx, hw, DOG_EAVE, zA)) - 1, WHITEW, TOP, { bias: 1 });
  }
  tufts(c, cx, g.y1, 7, 2903, 6);
});

const doghouseBack = sized(2, 1, 2, 30, kennelEnd(false));

// ---------------------------------------------------------------- Rose arch

const arbor = art('arbor', 3, 34, (c, g) => {
  // A white rose arch: a post each side, a curved top of two beams with
  // slats between, roses climbing it all; open in the middle to walk under.
  const xl = g.x0 + 3;
  const xr = g.x1 - 5;
  const yf = g.y1 - 4;
  const yb = g.y0 + 4;
  const zs = 23;
  const rise = 8;
  const archZ = (x: number) => zs + Math.sin(Math.max(0, Math.min(1, (x + 0.5 - xl - 1) / (xr - xl))) * Math.PI) * rise;
  // Back posts, the arch (back beam, slats, front beam), then front posts.
  for (const x of [xl, xr]) box(c, x, x + 2, yb, yb + 1, 0, zs + 1, WHITEW, { bias: -1 });
  c.part();
  for (let x = xl - 1; x < xr + 3; x++) {
    const z = Math.round(archZ(x));
    for (let t = 0; t < 2; t++) c.px(x, yb - z - t, WHITEW, t ? TOP : FACE, { bias: t ? 1 : -1 });
  }
  c.part();
  for (let x = xl; x < xr + 2; x += 3) {
    const z = Math.round(archZ(x));
    for (let y = yb - z - 1; y <= yf - z; y++) c.px(x, y, WHITEW, TOP, { bias: x === xl ? 1 : 0 });
  }
  c.part();
  for (let x = xl - 1; x < xr + 3; x++) {
    const z = Math.round(archZ(x));
    c.px(x, yf - z - 1, WHITEW, TOP, { bias: 2 });
    c.px(x, yf - z, WHITEW, FACE, { bias: 1 });
    c.px(x, yf - z + 1, WHITEW, FACE, { bias: -1 });
  }
  for (const x of [xl, xr]) {
    box(c, x, x + 2, yf - 1, yf, 0, zs, WHITEW);
    // A finial cap and a little foot.
    box(c, x - 1, x + 3, yf - 1, yf + 1, 0, 2, WHITEW, { bias: -1 });
  }
  // Rose canes climbing the posts and along the arch: leaves, then blooms.
  const R = rng(3001);
  const spots: [number, number][] = [];
  for (const x of [xl, xr]) {
    for (let z = 2; z < zs; z += 2) {
      const sx = x + 1 + Math.sin(z * 0.7 + x) * 2;
      spots.push([sx, yf - z]);
    }
  }
  for (let x = xl; x < xr + 2; x += 2) spots.push([x + R() - 0.5, yf - archZ(x) - 1 + (R() - 0.5) * 2]);
  c.part();
  for (const [x, y] of spots) {
    c.ellipse(x + (R() - 0.5) * 2, y + (R() - 0.5), 1.5, 1.1, R() < 0.5 ? LEAF : LEAF_DARK, { flatten: 0.7 });
  }
  const blooms = spots.filter((_, k) => hash2(k, 0, 3002) > 0.55);
  for (const [k, [x, y]] of blooms.entries()) {
    rose(c, x + (R() - 0.5) * 1.5, y + (R() - 0.5), k % 3 === 1 ? TULIP_P : ROSE);
  }
  // A few buds.
  c.part();
  for (const [x, y] of spots.filter((_, k) => hash2(k, 1, 3003) > 0.8)) c.px(x + 1, y - 1, ROSE, sphere(0, 0.5), { bias: 1 });
  tufts(c, xl + 1, yf + 2, 4, 3004, 4);
  tufts(c, xr + 1, yf + 2, 4, 3005, 4);
});

// ---------------------------------------------------------------- Swing

const swing = art('swing', 3, 26, (c, g) => {
  // A garden swing: two A-frames of round timber, a beam across, and a
  // little bench seat hung on ropes, a pink cushion on it; sweet peas wound
  // up one leg.
  const yc = g.cy + 2;
  const ends = [g.x0 + 4, g.x1 - 4];
  const top = yc - 30;
  c.part();
  for (const e of ends) {
    c.capsule(e, top + 1, e - 4.5, yc, 1, 1.3, OAKW);
    c.capsule(e, top + 1, e + 4.5, yc, 1, 1.3, OAKW);
  }
  c.part();
  for (const e of ends) c.line(e - 3, yc - 9, e + 3, yc - 9, DARKW, () => FACE, { bias: 1 });
  c.part();
  c.capsule(g.x0 + 1, top, g.x1 - 1, top, 1.6, 1.6, OAKW);
  for (const e of ends) c.shade(e, top, -2);
  grain(c, g.x0 + 1, g.x1 - 1, top - 1, top + 2, 3101);
  // The seat: its back, then the seat and its cushion.
  const sx0 = Math.round(g.cx) - 8;
  const sx1 = Math.round(g.cx) + 8;
  const sb = yc - 2;
  const sf = yc + 3;
  box(c, sx0, sx1, sb - 1, sb, 9, 17, PALEW);
  for (let x = sx0; x < sx1; x++) if ((x - sx0) % 3 === 2) for (let y = sb - 16; y < sb - 9 - 1; y++) c.erase(x, y);
  grain(c, sx0, sx1, sb - 17, sb - 9, 3102, false);
  box(c, sx0, sx1, sb, sf, 7, 9, PALEW);
  box(c, sx0 + 1, sx1 - 1, sb, sf - 1, 9, 11, CUSHION, { topBias: 1 });
  // Piping and two buttons.
  for (let x = sx0 + 1; x < sx1 - 1; x++) c.shade(x, sf - 1 - 11, 1);
  c.shade(Math.round(g.cx) - 4, sb + 2 - 11, -2);
  c.shade(Math.round(g.cx) + 3, sb + 2 - 11, -2);
  // A little round pillow against the back.
  c.part();
  c.ellipse(sx1 - 4, sb - 13, 2.6, 2.4, LINEN, { bias: 1 });
  c.shade(sx1 - 4, sb - 13, -1);
  // Ropes from the beam to the seat's corners, twisted.
  c.part();
  for (const x of [sx0, sx1 - 1]) {
    for (let y = top + 2; y < sf - 9; y++) c.px(x, y, HAY, cyl(x < g.cx ? -0.4 : 0.4, 0), { bias: (y & 1) ? 1 : -1 });
    c.px(x, top + 1, IRON, FACE, { bias: 2 });
  }
  // Sweet peas wound up the left leg.
  c.part();
  const e = ends[0];
  const cols = [TULIP_P, LAVENDER, LINEN, CUSHION];
  for (let k = 0; k < 9; k++) {
    const u = k / 9;
    const x = e - 4.5 + u * 4.5 + Math.sin(k * 1.9) * 1.5;
    const y = yc - u * 27;
    c.ellipse(x, y, 1.3, 0.9, LEAF, { flatten: 0.7 });
    if (k % 2 === 1) posy(c, Math.round(x + 1), Math.round(y - 1), cols[(k >> 1) % cols.length]);
  }
  tufts(c, ends[0], yc + 2, 6, 3103, 5);
  tufts(c, ends[1], yc + 2, 6, 3104, 5);
});

// ---------------------------------------------------------------- Fountain

const fountain = art('fountain', 2, 16, (c, g, f) => {
  // A round stone fountain: a wide basin, a fluted pedestal standing in it,
  // a bowl on top that spills in thin falls, a bubbling finial; lily pad,
  // a wish of coins, and light glinting on the water.
  const cx = g.cx;
  const gy = g.cy + 2;
  const RX = 14.5;
  const RY = 9;
  c.part();
  c.ellipse(cx, gy + 1, RX + 1.5, RY + 1.2, MOSS, { normal: () => FLOOR });
  drum(c, cx, gy, RX, RY, 0, 6, PALE_STONE, null);
  // Its side in courses of dressed stone, a moulding near the top.
  for (let y = gy - 6; y < gy + RY + 1; y++) {
    for (let x = cx - RX; x < cx + RX; x++) {
      if (c.materialAt(x, y) !== PALE_STONE) continue;
      const t = (x + 0.5 - cx) / RX;
      const z = gy + Math.sqrt(Math.max(0, 1 - t * t)) * RY - y;
      const a = Math.asin(Math.max(-1, Math.min(1, t))) * 4;
      if (Math.floor(z) === 4) c.shade(x, y, 1);
      else if (Math.floor(z) === 3) c.shade(x, y, -1);
      else if (Math.abs(a - Math.round(a)) < 0.1) c.shade(x, y, -2);
    }
  }
  // Rim, the inner wall, then the water a little below the rim.
  c.part();
  c.ellipse(cx, gy - 6, RX, RY, PALE_STONE, { normal: () => TOP, bias: 1 });
  c.part();
  c.ellipse(cx, gy - 6, RX - 2, RY - 1.6, PALE_STONE, { normal: () => FACE, bias: -2 });
  c.part();
  for (let y = Math.floor(gy - 6 - RY); y < gy; y++) {
    for (let x = Math.floor(cx - RX); x < cx + RX; x++) {
      if (c.materialAt(x, y) !== PALE_STONE) continue;
      const dx = (x + 0.5 - cx) / (RX - 2);
      const dy = (y + 0.5 - (gy - 5)) / (RY - 1.8);
      if (dx * dx + dy * dy > 1) continue;
      const d0x = (x + 0.5 - cx) / (RX - 2);
      const d0y = (y + 0.5 - (gy - 6)) / (RY - 1.6);
      if (d0x * d0x + d0y * d0y > 1) continue;
      c.px(x, y, WATER, TOP, { bias: dy < -0.5 ? 1 : 0 });
    }
  }
  // Rings on the water round where the falls land.
  for (let a = 0; a < 40; a++) {
    const t = (a / 40) * Math.PI * 2;
    for (const r of [7.5, 10]) {
      const x = cx + Math.cos(t) * r;
      const y = gy - 5 + Math.sin(t) * r * 0.55;
      if (c.materialAt(x, y) === WATER && hash2(a, r, 3201) > 0.3) c.shade(x, y, 1);
    }
  }
  // A lily pad with its flower, and coins on the bottom.
  c.part();
  c.ellipse(cx + 8, gy - 2, 2.6, 1.6, LILY, { normal: () => TOP });
  c.erase(cx + 10, gy - 2);
  c.part();
  c.px(cx + 7, gy - 3, TULIP_P, TOP, { bias: 2 });
  c.px(cx + 8, gy - 3, TULIP_P, TOP, { bias: 1 });
  c.px(cx + 7, gy - 4, LINEN, TOP, { bias: 2 });
  c.part();
  for (const [dx, dy] of [[-8, -4], [-6, -2], [5, -9]]) c.px(cx + dx, gy + dy, BRASS, TOP, { bias: 1 });
  // The pedestal, fluted, flared at its foot.
  drum(c, cx, gy - 5, 3.6, 2, 0, 2, PALE_STONE);
  drum(c, cx, gy - 5, 2.2, 1.3, 2, 13, PALE_STONE, null);
  for (let x = cx - 2; x < cx + 2; x++) if ((x & 1) === 0) for (let y = gy - 5 - 13; y < gy - 5 - 1; y++) if (c.materialAt(x, y) === PALE_STONE) c.shade(x, y, -1);
  // The upper bowl, flaring out from the pedestal's top.
  const bz = gy - 5;
  c.part();
  for (let z = 11; z <= 16; z += 0.5) {
    const r = 2.6 + Math.pow((z - 11) / 5, 0.8) * 5;
    const ry = r * 0.55;
    for (let x = Math.floor(cx - r); x < cx + r; x++) {
      const t = (x + 0.5 - cx) / r;
      if (Math.abs(t) > 1) continue;
      const y = Math.round(bz - z + Math.sqrt(1 - t * t) * ry);
      c.px(x, y, PALE_STONE, n3(t * 0.8, -0.45, 0.55), { bias: z > 15.5 ? 1 : 0 });
    }
  }
  c.part();
  c.ellipse(cx, bz - 16.5, 7.6, 4.2, PALE_STONE, { normal: () => TOP, bias: 1 });
  c.part();
  c.ellipse(cx, bz - 16.5, 6, 3.1, WATER, { normal: () => TOP });
  for (let x = cx - 5; x < cx + 5; x++) c.shade(x, bz - 16.5 - 3, -1);
  // The finial and the water bubbling from it.
  drum(c, cx, bz - 14, 1.3, 0.8, 2, 6, PALE_STONE);
  c.part();
  c.ellipse(cx, bz - 21.5, 1.6, 1.4, PALE_STONE, { bias: 1 });
  c.part();
  c.px(cx - 1, bz - 23, FALL, FACE, { bias: 3 });
  c.px(cx, bz - 23, FALL, FACE, { bias: 2 });
  c.px(cx - 1, bz - 24, FALL, FACE, { bias: 4 });
  // Falls from the bowl's front lip down to the basin.
  c.part();
  const falls = [-6, -3.5, -1, 1.5, 4, 6.5];
  for (const dx of falls) {
    const t = dx / 7.6;
    const y0 = Math.round(bz - 16.5 + Math.sqrt(Math.max(0, 1 - t * t)) * 4.2) + 1;
    const y1 = Math.round(gy - 5 + Math.sqrt(Math.max(0, 1 - (dx / 9) ** 2)) * 5);
    for (let y = y0; y <= y1; y++) c.px(cx + dx, y, FALL, FACE, { bias: (y + Math.round(dx)) % 3 === 0 ? 1 : 0 });
    c.spark(cx + dx, y1 + 1, [200, 240, 255], 0.25);
    // Glints sliding down each fall.
    const len = y1 - y0;
    for (let k = 0; k < 2; k++) {
      const y = y0 + ((f * 3 + k * 5 + Math.round(dx * 2) + 20) % Math.max(1, len));
      c.spark(cx + dx, y, [230, 250, 255], 0.55);
    }
  }
  // Ripples spreading where they land, and sparkles on the basin.
  for (const dx of [-6, 1.5, 6.5]) {
    const r = 1 + ((f + Math.round(dx)) & 3) * 0.8;
    const a = 0.45 - ((f + Math.round(dx)) & 3) * 0.1;
    const fy = gy - 5 + Math.sqrt(Math.max(0, 1 - (dx / 9) ** 2)) * 5 + 1;
    for (let k = 0; k < 10; k++) {
      const t = (k / 10) * Math.PI * 2;
      c.spark(cx + dx + Math.cos(t) * r, fy + Math.sin(t) * r * 0.5, [200, 240, 255], a);
    }
  }
  const R = rng(3202 + f);
  for (let k = 0; k < 3; k++) {
    const t = R() * Math.PI * 2;
    const r = 3 + R() * 8;
    c.spark(cx + Math.cos(t) * r, gy - 5 + Math.sin(t) * r * 0.5, [255, 255, 255], 0.7);
  }
  c.spark(cx - 1, bz - 25 - (f % 2), [230, 250, 255], 0.6);
  c.spark(cx - 2 + (f % 3), bz - 17, [255, 255, 255], 0.5);
}, 4, 6);

// ---------------------------------------------------------------- Lights

const floorlamp = art('floorlamp', 6, 24, (c, g) => {
  // A standing lamp: a round brass foot, a slim pole with a knop, and a
  // pleated shade glowing from within, a pull chain hanging from it.
  const cx = g.cx;
  const gy = g.y1 - 5;
  drum(c, cx, gy, 3.8, 2, 0, 1.5, BRASS);
  drum(c, cx, gy, 2.2, 1.1, 1.5, 2.5, BRASS);
  drum(c, cx, gy, 0.8, 0.5, 2.5, 22, BRASS, null);
  drum(c, cx, gy, 1.5, 0.8, 11, 12.5, BRASS);
  // The shade: wider at its foot, pleats round it, a gold band top and bottom.
  const z0 = 21;
  const z1 = 31;
  c.part();
  c.shape(gy - z1, gy - z0, (y) => {
    const u = (y - gy + z1) / (z1 - z0);
    const hw = 3.4 + u * 2.6;
    return [cx - hw, cx + hw];
  }, SHADE, (_x, _y, t) => cyl(t, 0.25));
  for (let y = gy - z1; y <= gy - z0; y++) for (let x = cx - 6; x < cx + 6; x++) if (c.materialAt(x, y) === SHADE && (x & 1)) c.shade(x, y, -1);
  recolor(c, cx - 7, cx + 7, gy - z1, gy - z0 + 1, SHADE, BRASS, (_x, y) => y === gy - z1 || y === gy - z0);
  // Its open top, bright with the bulb inside.
  c.part();
  c.ellipse(cx, gy - z1, 3.2, 1.1, LAMP, { normal: () => TOP, bias: 1 });
  // The bulb's light falling from its open foot.
  c.part();
  for (let x = cx - 5; x < cx + 5; x++) c.px(x, gy - z0 + 1, LAMP, FACE, { bias: Math.abs(x + 0.5 - cx) < 2 ? 2 : 0 });
  // The pull chain.
  c.part();
  for (let y = gy - z0 + 2; y < gy - z0 + 5; y++) c.px(cx + 3, y, BRASS, FACE, { bias: y & 1 });
  c.px(cx + 3, gy - z0 + 5, BRASS, sphere(-0.3, 0.3), { bias: 2 });
  halo(c, cx, gy - 26, 9, [255, 200, 130], 0.3);
  halo(c, cx, gy - 18, 5, [255, 210, 150], 0.15);
});

const paperlanterns = art('paperlanterns', 6, 32, (c, g, f) => {
  // A bamboo pole with a crossbar, three paper lanterns hung from it, pink
  // and peach, glowing softly and breathing their light in and out.
  const sx = g.cx - 4;
  const gy = g.y1 - 5;
  c.part();
  c.ellipse(sx, gy + 0.5, 3, 1.5, FIELDSTONE, { flatten: 0.8 });
  // The pole, its nodes ringed, then the crossbar lashed to it.
  c.part();
  c.shape(gy - 36, gy, () => [sx - 1.1, sx + 1.1], BAMBOO, (_x, _y, t) => cyl(t, 0));
  for (let y = gy - 36; y < gy; y++) if ((gy - y) % 7 === 0) for (const x of [sx - 1, sx]) { c.shade(x, y, -2); c.shade(x, y - 1, 1); }
  c.part();
  c.capsule(sx - 3, gy - 34, sx + 10, gy - 33, 0.8, 0.7, BAMBOO);
  c.part();
  c.px(sx - 1, gy - 34, HAY, FACE, { bias: 1 });
  c.px(sx, gy - 33, HAY, FACE, { bias: 0 });
  // Strings and lanterns, the big one at the end of the bar.
  const hang = (x: number, from: number, y: number, r: number, m: Material, k: number) => {
    c.part();
    c.line(x, from, x, y - r - 1, BURLAP, () => FACE, { bias: 1 });
    paperLantern(c, x + 0.5, y, r, m, f, k);
  };
  hang(sx + 9, gy - 32, gy - 26, 3.4, PAPER_PINK, 0);
  hang(sx + 4, gy - 32, gy - 21, 2.6, PAPER_PEACH, 1);
  hang(sx - 3, gy - 33, gy - 25, 2.4, PAPER_PINK, 2);
  // A sprig of leaves where the bar meets the pole.
  c.part();
  c.ellipse(sx + 2, gy - 35, 1.6, 0.9, LEAF, { flatten: 0.6 });
  c.ellipse(sx - 2, gy - 36, 1.4, 0.8, LEAF_DARK, { flatten: 0.6 });
  tufts(c, sx, gy + 2, 5, 3301, 5);
}, 4, 4);

const candles = art('candles', 3, 14, (c, g, f) => {
  // A cluster of pillar candles on the ground, tall and short, wax run down
  // their sides and pooled at their feet, each flame flickering its own way.
  const cx = g.cx;
  const gy = g.y1 - 6;
  c.part();
  c.ellipse(cx, gy + 1, 6, 2.2, WAX, { normal: () => FLOOR, bias: -1 });
  // Ivory, rose and beeswax, so each stands apart from its neighbours.
  const list = [
    { x: cx - 3, y: gy - 2, r: 1.9, h: 11, m: WAX },
    { x: cx + 3, y: gy - 2, r: 2.1, h: 8, m: WAX_HONEY },
    { x: cx + 6, y: gy + 1, r: 1.5, h: 5, m: WAX },
    { x: cx - 6, y: gy + 1, r: 1.7, h: 7, m: WAX_PINK },
    { x: cx, y: gy + 2, r: 2.3, h: 4, m: WAX_PINK },
  ];
  list.forEach((k, i) => {
    drum(c, k.x, k.y, k.r, k.r * 0.5, 0, k.h, k.m, k.m, { topBias: 1, bias: -1 });
    // A dip round the wick, drips down the front.
    c.shade(k.x - 0.5, k.y - k.h, -2);
    c.part();
    const R = rng(3401 + i);
    for (let d = 0; d < 2; d++) {
      const x = Math.round(k.x - k.r + 0.5 + R() * (k.r * 2 - 1));
      const len = 1 + Math.floor(R() * Math.min(4, k.h - 1));
      const top = Math.round(k.y - k.h + k.r * 0.5);
      for (let j = 0; j < len; j++) c.px(x, top + j, k.m, FACE, { bias: j === len - 1 ? 3 : 2 });
    }
    c.part();
    c.px(k.x - 0.5, k.y - k.h - 1, SOOT, FACE, { bias: 0 });
    // The wax under the flame takes its glow.
    c.px(k.x - 0.5, k.y - k.h, k.m, TOP, { bias: 3, glow: 0.5 });
    flame(c, k.x - 0.5, k.y - k.h - 1, 0.9, 3 + (i % 2), (f + i) % 4, 3402 + i);
    halo(c, k.x - 0.5, k.y - k.h - 2, 4, [255, 190, 110], 0.18);
  });
  halo(c, cx, gy - 7, 9, [255, 170, 90], 0.15 + (f % 2) * 0.03);
}, 4, 8);

const hooklantern = art('hooklantern', 6, 30, (c, g, f) => {
  // A shepherd's crook of black iron, curled at its end, a little iron
  // lantern hanging from it with a candle flickering inside, ivy climbing
  // its foot.
  const sx = g.cx - 3;
  const gy = g.y1 - 5;
  c.part();
  c.ellipse(sx, gy + 0.5, 2.6, 1.3, SOOT, { normal: () => FLOOR });
  // The post, then the crook arcing over to the right, a scroll at its end.
  c.part();
  c.shape(gy - 32, gy, () => [sx - 0.9, sx + 0.9], IRON, (_x, _y, t) => cyl(t, 0));
  c.part();
  const ar = 3.8;
  const acx = sx + ar;
  const acy = gy - 32;
  for (let k = 0; k < 12; k++) {
    const a0 = Math.PI + (k / 12) * Math.PI;
    const a1 = Math.PI + ((k + 1) / 12) * Math.PI;
    c.capsule(acx + Math.cos(a0) * ar, acy + Math.sin(a0) * ar, acx + Math.cos(a1) * ar, acy + Math.sin(a1) * ar, 0.8, 0.8, IRON);
  }
  c.capsule(sx + ar * 2, acy, sx + ar * 2 + 0.5, acy + 1.5, 0.7, 0.7, IRON);
  // The scroll curling under the arm.
  c.part();
  c.px(sx + 2, acy + 1, IRON, FACE, { bias: 1 });
  c.px(sx + 3, acy + 2, IRON, FACE, { bias: 0 });
  c.px(sx + 2, acy + 2, IRON, FACE, { bias: 1 });
  // The ring and the lantern: a peaked cap, panes round the flame, a foot.
  const lx = Math.round(sx + ar * 2);
  const top = acy + 3;
  c.part();
  c.px(lx, top - 1, IRON, FACE, { bias: 2 });
  c.px(lx, top, IRON, FACE, { bias: 1 });
  c.part();
  c.shape(top + 1, top + 3, (y) => {
    const hw = 0.8 + (y - top - 1) * 1.3;
    return [lx + 0.5 - hw, lx + 0.5 + hw];
  }, IRON, (_x, _y, t) => n3(t * 0.7, 0.6, 0.6));
  c.part();
  for (let y = top + 4; y <= top + 9; y++) {
    for (let x = lx - 2; x <= lx + 3; x++) {
      const bar = x === lx - 2 || x === lx + 3;
      if (bar) c.px(x, y, IRON, FACE, { bias: x < lx ? 1 : -1 });
      else c.px(x, y, LAMP, FACE, { bias: (Math.abs(x + 0.5 - (lx + 0.5)) < 1.2 && y > top + 5 ? 1 : -1) + (f % 2) });
    }
  }
  c.part();
  for (let x = lx - 2; x <= lx + 3; x++) c.px(x, top + 10, IRON, TOP, { bias: 1 });
  for (let x = lx - 1; x <= lx + 2; x++) c.px(x, top + 11, IRON, FACE, { bias: -1 });
  flame(c, lx + 0.5, top + 8, 1.1, 4, f, 3501, 0.85);
  halo(c, lx + 0.5, top + 7, 8, [255, 180, 90], 0.3 + (f % 2) * 0.05);
  // Ivy twining up the post.
  c.part();
  for (let k = 0; k < 7; k++) {
    const y = gy - 1 - k * 2;
    const side = k % 2 ? 1 : -1;
    c.ellipse(sx + side * 1.6, y, 1.4, 1, k % 3 ? LEAF : LEAF_DARK, { flatten: 0.6 });
  }
  tufts(c, sx, gy + 2, 5, 3502, 5);
}, 4, 8);

// ---------------------------------------------------------------- The list

/** Every part drawn here, by id. */
export const YARD_ART: Record<string, PropArt> = {
  gnome,
  frogstatue,
  cacti,
  wateringcan,
  beehive,
  birdhouse,
  deckchair,
  wheelbarrow,
  doghouse,
  arbor,
  swing,
  fountain,
  floorlamp,
  paperlanterns,
  candles,
  hooklantern,
};

/** The turning ones' side (facing east; west is it mirrored) and back views. */
export const YARD_TURNS: Record<string, { side: PropArt; back: PropArt }> = {
  deckchair: { side: deckchairSide, back: deckchairBack },
  doghouse: { side: doghouseSide, back: doghouseBack },
};

