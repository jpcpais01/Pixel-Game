// Saltglass Flats' props, drawn with the shared pixel engine (art/pixel.ts):
// a tea house on stilts with paper walls and a verdigris roof, an old train
// car left on the salt with a lamp still lit inside, a lantern on a crooked
// post, cairns, wind chimes whose ribbons stir, tola shrubs, cardón cacti,
// ichu grass and coral stone for the islands, heaped salt cones, flamingos
// wading and flying, and what moves on the mirror: ripples, the clouds it
// holds, a falling star. Lit from the warm top-left like everything else.
// Pure: the node script paints them too.

import { FLAT, PixelCanvas, cyl, sphere, type Material, type Vec3 } from '../../../art/pixel';
import { rng, valueNoise } from '../../../art/env';
import type { SheetDef } from '../types';
import {
  BEAK, BEAK_TIP, BLOOM, BRASS, CACTUS, CLOUD, CORAL, CREAM, EYE, FLAME, ICHU, IRON, LANTERN, LEG, METEOR, PAINT, PAPER, PAPER_LIT, PLUME, QUILL, RIBBON, RIBBON_BLUE, RIPPLE, ROOF, ROOF_TRIM, RUST, SALT, SILVER, SPINE, STONE_BLUE, STONE_PALE, STONE_TAN, STRING, TOLA, TOLA_DRY, WINDOW_DARK, WINDOW_LIT, WING_ROSE, WOOD_DARK, WOOD_OLD, WOOD_WARM,
} from './palette';

/** Normals: facing up to the sky, facing the viewer, and a roof's slope between. */
const UP: Vec3 = { x: 0, y: 0.6, z: 0.8 };
const FRONT: Vec3 = { x: 0, y: -0.35, z: 0.94 };

const norm = (x: number, y: number, z: number): Vec3 => {
  const l = Math.hypot(x, y, z) || 1;
  return { x: x / l, y: y / l, z: z / l };
};

/** A filled box of one material, one normal. */
function box(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, m: Material, n: Vec3 = FLAT, bias = 0): void {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) c.px(x, y, m, n, { bias });
}

/** An upright post, round across its width. */
function post(c: PixelCanvas, x: number, y0: number, y1: number, hw: number, m: Material, bias = 0): void {
  for (let y = y0; y <= y1; y++) for (let px = Math.floor(x - hw); px < x + hw; px++) c.px(px, y, m, cyl((px + 0.5 - x) / hw, 0.1), { bias });
}

// ---------------------------------------------------------------- the tea house

export const TEA_W = 88;
export const TEA_H = 110;
export const TEA_FOOT_Y = 106;

function teaFrame(): PixelCanvas {
  const c = new PixelCanvas(TEA_W, TEA_H);
  const cx = TEA_W / 2;
  const fy = TEA_FOOT_Y;
  const deckTop = fy - 31;
  const deckFront = fy - 19;
  // The back row of stilts, further off and so standing higher, in shade.
  for (const sx of [-24, -8, 8, 24]) post(c, cx + sx, deckFront - 2, fy - 9, 1.2, WOOD_DARK, -1);
  // The front stilts, braced crosswise.
  c.part();
  for (const sx of [-27, -10, 10, 27]) post(c, cx + sx, deckFront + 2, fy, 1.6, WOOD_OLD);
  c.part();
  for (const [a, b] of [[-27, -10], [10, 27]]) {
    c.line(cx + a + 1, deckFront + 4, cx + b - 1, fy - 4, WOOD_DARK);
    c.line(cx + b - 1, deckFront + 4, cx + a + 1, fy - 4, WOOD_DARK);
  }
  // Steps down each side to the boardwalk.
  c.part();
  for (const side of [-1, 1]) {
    for (let s = 0; s < 3; s++) {
      const x0 = cx + side * (31 + s * 3);
      const top = deckFront + 1 + s * 4;
      for (let x = Math.min(x0, x0 + side * 3); x <= Math.max(x0, x0 + side * 3); x++) {
        c.px(x, top, WOOD_WARM, UP, { bias: 1 });
        c.px(x, top + 1, WOOD_WARM, UP);
        c.px(x, top + 2, WOOD_WARM, FRONT, { bias: -2 });
      }
    }
    post(c, cx + side * 40, deckFront + 9, fy - 3, 0.8, WOOD_DARK);
  }
  // The platform: boards seen from above, its front edge below.
  c.part();
  for (let y = deckTop; y <= deckFront; y++) {
    for (let x = cx - 32; x <= cx + 32; x++) {
      const seam = (x - cx + 64) % 5 === 4;
      c.px(x, y, WOOD_WARM, UP, { bias: (seam ? -1 : 0) + (y === deckTop ? -1 : 0) });
    }
  }
  c.part();
  for (let y = deckFront + 1; y <= deckFront + 3; y++) for (let x = cx - 32; x <= cx + 32; x++) c.px(x, y, WOOD_WARM, FRONT, { bias: y === deckFront + 1 ? 0 : -2 });
  // The house on the back of the platform: posts, paper walls, an open door glowing warm.
  const wallBottom = deckTop + 7;
  const wallTop = wallBottom - 23;
  c.part();
  for (let y = wallTop; y <= wallBottom; y++) {
    for (let x = cx - 24; x <= cx + 24; x++) {
      const lx = x - cx;
      const door = lx >= -6 && lx <= 6 && y > wallTop + 3;
      const grid = (lx + 24) % 6 === 0 || (y - wallTop) % 6 === 0;
      if (door) c.px(x, y, PAPER_LIT, FLAT, { bias: y > wallBottom - 4 ? -1 : (y - wallTop) % 7 === 0 ? 1 : 0 });
      else c.px(x, y, grid ? WOOD_DARK : PAPER, FRONT, { bias: grid ? 1 : y > wallBottom - 3 ? -1 : 0 });
    }
  }
  c.part();
  for (const px of [-25, -7, 7, 25]) post(c, cx + px, wallTop, wallBottom, 1.2, WOOD_WARM);
  c.part();
  for (let x = cx - 25; x <= cx + 25; x++) c.px(x, wallTop, WOOD_WARM, UP, { bias: 1 });
  // A noren curtain over the door, indigo, in two panels.
  c.part();
  for (let y = wallTop + 1; y <= wallTop + 7; y++) {
    for (let x = cx - 6; x <= cx + 6; x++) {
      if (x === cx && y > wallTop + 2) continue;
      c.px(x, y, RIBBON_BLUE, FRONT, { bias: y === wallTop + 1 ? 1 : x < cx ? 0 : -1 });
    }
  }
  c.px(cx - 3, wallTop + 4, PAPER, FLAT, { bias: 2 });
  c.px(cx + 3, wallTop + 4, PAPER, FLAT, { bias: 2 });
  // A pot of flowers on the deck, and a low table by the door.
  c.part();
  c.ellipse(cx + 19, deckFront - 4, 2.4, 2, ROOF_TRIM, { flatten: 0.7 });
  c.part();
  for (const [ox, oy] of [[-1, -7], [1, -8], [0, -9], [2, -6], [-2, -6]]) c.ellipse(cx + 19 + ox, deckFront + oy, 1.5, 1.4, TOLA, { flatten: 0.8 });
  for (const [ox, oy] of [[0, -10], [2, -8], [-2, -7]]) c.px(cx + 19 + ox, deckFront + oy, BLOOM, UP, { bias: 2 });
  c.part();
  for (let x = cx - 21; x <= cx - 13; x++) {
    c.px(x, deckFront - 5, WOOD_DARK, UP, { bias: 2 });
    c.px(x, deckFront - 4, WOOD_DARK, FRONT, { bias: 0 });
  }
  c.px(cx - 20, deckFront - 3, WOOD_DARK, FLAT);
  c.px(cx - 14, deckFront - 3, WOOD_DARK, FLAT);
  c.ellipse(cx - 17, deckFront - 6.5, 1.4, 1, SILVER, { flatten: 0.8 });
  // The railing along the front, open at the steps.
  c.part();
  for (let x = cx - 31; x <= cx + 31; x++) c.px(x, deckFront - 5, WOOD_WARM, UP, { bias: 1 });
  for (let x = cx - 31; x <= cx + 31; x += 6) post(c, x + 0.5, deckFront - 5, deckFront, 0.6, WOOD_WARM, 0);
  // The roof: a curved hip of verdigris tiles, eaves swept up at the corners.
  const ridgeY = wallTop - 21;
  const eaveY = wallTop + 1;
  c.part();
  for (let y = ridgeY; y <= eaveY; y++) {
    const t = (y - ridgeY) / (eaveY - ridgeY);
    const hw = 15 + 20 * Math.pow(t, 1.5);
    for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) {
      const u = (x + 0.5 - cx) / hw;
      // The hips at the sides turn toward and away from the sun; the face between looks at the sky.
      const side = Math.abs(u) > 0.62 ? Math.sign(u) * (Math.abs(u) - 0.62) * 2.2 : 0;
      const n = norm(side * 0.9, 0.45 - t * 0.45, 0.85);
      const row = (eaveY - y) % 3 === 0;
      const seam = (x - cx + 60) % 4 === 0 && !row;
      c.px(x, y, ROOF, n, { bias: (row ? -1 : 0) + (seam ? -1 : 0) + (t < 0.15 ? 1 : 0) });
    }
  }
  // Upturned eaves and the ridge cap.
  c.part();
  for (let x = cx - 36; x <= cx + 36; x++) {
    const lx = Math.abs(x - cx);
    const lift = lx > 30 ? Math.round((lx - 30) * 0.6) : 0;
    c.px(x, eaveY + 1 - lift, ROOF_TRIM, FRONT, { bias: 0 });
    c.px(x, eaveY - lift, ROOF_TRIM, UP, { bias: 1 });
  }
  for (let x = cx - 17; x <= cx + 17; x++) {
    const lx = Math.abs(x - cx);
    c.px(x, ridgeY - (lx > 14 ? lx - 14 : 0), ROOF_TRIM, UP, { bias: 1 });
    c.px(x, ridgeY + 1, ROOF_TRIM, FRONT, { bias: -1 });
  }
  // Paper lanterns hung from the eaves' corners, each with a flame inside.
  for (const side of [-1, 1]) {
    const lx = cx + side * 31;
    const ly = eaveY + 7;
    c.part();
    c.line(lx, eaveY - 1, lx, ly - 4, STRING);
    c.part();
    c.ellipse(lx + 0.5, ly, 2.6, 3.2, LANTERN, { flatten: 0.6 });
    c.part();
    c.px(lx - 1, ly - 3, WOOD_DARK, UP);
    c.px(lx, ly - 3, WOOD_DARK, UP);
    c.px(lx + 1, ly - 3, WOOD_DARK, UP);
    c.px(lx, ly + 3, WOOD_DARK, FLAT);
    c.px(lx, ly + 4, RIBBON, FLAT);
    c.px(lx, ly, FLAME, FLAT);
  }
  return c;
}

// ---------------------------------------------------------------- the train car

export const TRAIN_W = 112;
export const TRAIN_H = 60;
export const TRAIN_FOOT_Y = 55;

function trainFrame(): PixelCanvas {
  const c = new PixelCanvas(TRAIN_W, TRAIN_H);
  const R = rng(5150);
  const fy = TRAIN_FOOT_Y;
  const x0 = 10;
  const x1 = 98;
  const top = fy - 44;
  const roofEdge = fy - 35;
  const bodyBottom = fy - 9;
  // Wheels, half sunk in the salt, under their bogies.
  for (const bx of [x0 + 16, x1 - 16]) {
    for (const wx of [-6, 6]) {
      c.part();
      c.ellipse(bx + wx, fy - 4, 4, 4, IRON, { flatten: 0.6 });
      c.part();
      c.ellipse(bx + wx, fy - 4, 1.4, 1.4, RUST, { flatten: 0.8 });
    }
    c.part();
    box(c, bx - 11, fy - 9, bx + 11, fy - 7, IRON, FRONT);
  }
  // The frame under the floor.
  c.part();
  box(c, x0 + 1, bodyBottom, x1 - 1, bodyBottom + 1, IRON, FRONT, 1);
  // The body's side: a cream band through the windows, faded mint below, rust coming through.
  c.part();
  for (let y = roofEdge + 1; y < bodyBottom; y++) {
    for (let x = x0; x <= x1; x++) {
      const band = y >= roofEdge + 3 && y <= roofEdge + 13;
      const seam = (x - x0) % 22 === 0;
      const lower = (y - roofEdge) / (bodyBottom - roofEdge);
      // Rust in patches, worst low down where the salt water splashed.
      const rusty = valueNoise(x, y, 3, 77) * 0.55 + valueNoise(x, y, 8, 78) * 0.45 > 0.8 - lower * 0.16 - (y > bodyBottom - 3 ? 0.1 : 0);
      const m = rusty ? RUST : band ? CREAM : PAINT;
      c.px(x, y, m, FRONT, { bias: (seam ? -1 : 0) + (y === roofEdge + 1 ? 1 : 0) + (y === roofEdge + 14 ? -1 : 0) });
    }
  }
  // Rust weeping down from under the windows.
  for (let k = 0; k < 9; k++) {
    const x = x0 + 4 + Math.floor(R() * (x1 - x0 - 8));
    const len = 3 + Math.floor(R() * 6);
    for (let y = roofEdge + 13; y < roofEdge + 13 + len && y < bodyBottom; y++) c.px(x, y, RUST, FRONT, { bias: y === roofEdge + 13 ? 1 : 0 });
  }
  // Windows: a lamp lit in two of them.
  const wins = [0, 1, 2, 3, 4, 5];
  for (const k of wins) {
    const wx = x0 + 6 + k * 12;
    c.part();
    const lit = k === 1 || k === 2;
    for (let y = roofEdge + 4; y <= roofEdge + 11; y++) {
      for (let x = wx; x < wx + 7; x++) {
        if (lit) c.px(x, y, WINDOW_LIT, FLAT, { bias: y < roofEdge + 6 ? 1 : 0 });
        else c.px(x, y, WINDOW_DARK, FLAT, { bias: x - wx === y - roofEdge - 4 || x - wx === y - roofEdge - 3 ? 2 : 0 });
      }
    }
    // Lace curtains half drawn in the lit ones.
    if (lit) for (let y = roofEdge + 4; y <= roofEdge + 9; y++) c.px(k === 1 ? wx : wx + 6, y, PAPER, FLAT, { bias: 2 });
  }
  // The door at the end, and its little step.
  c.part();
  const dx = x1 - 9;
  for (let y = roofEdge + 3; y < bodyBottom; y++) for (let x = dx; x < dx + 6; x++) c.px(x, y, PAINT, FRONT, { bias: x === dx ? 1 : y < roofEdge + 10 && x > dx && x < dx + 5 ? -2 : -1 });
  c.px(dx + 4, roofEdge + 14, BRASS, FLAT, { bias: 1 });
  c.part();
  box(c, dx - 1, bodyBottom + 2, dx + 6, bodyBottom + 2, WOOD_OLD, UP, 1);
  box(c, dx - 1, bodyBottom + 3, dx + 6, bodyBottom + 3, WOOD_OLD, FRONT, -1);
  // The roof: a shallow barrel, lit along its top.
  c.part();
  for (let y = top; y <= roofEdge; y++) {
    const t = (y - top) / (roofEdge - top);
    const inset = y === top ? 2 : y === top + 1 ? 1 : 0;
    for (let x = x0 - 1 + inset; x <= x1 + 1 - inset; x++) {
      const rib = (x - x0) % 11 === 0;
      c.px(x, y, PAINT, norm(0, 0.8 - t * 1.1, 0.7), { bias: (rib ? -1 : 0) + 1 });
    }
  }
  // Rust and salt bloom on the roof.
  for (let y = top + 1; y < roofEdge; y++) {
    for (let x = x0; x <= x1; x++) {
      if (c.materialAt(x, y) !== PAINT) continue;
      const n = valueNoise(x, y * 2, 5, 81);
      if (n > 0.78) c.px(x, y, RUST, UP, { bias: n > 0.86 ? 0 : 1 });
      else if (valueNoise(x, y * 2, 4, 83) > 0.82) c.px(x, y, SALT, UP, { bias: 0 });
    }
  }
  // A vent or two on top, and a stovepipe: someone lives here now.
  c.part();
  box(c, x0 + 26, top - 1, x0 + 31, top + 1, IRON, UP, 1);
  c.part();
  post(c, x0 + 60, top - 7, top + 2, 1.5, IRON, 1);
  for (let x = x0 + 58; x <= x0 + 62; x++) c.px(x, top - 8, IRON, UP, { bias: 1 });
  // A lantern by the door.
  c.part();
  c.line(dx - 2, roofEdge + 2, dx - 2, roofEdge + 5, STRING);
  c.part();
  c.ellipse(dx - 1.5, roofEdge + 8, 2, 2.6, LANTERN, { flatten: 0.6 });
  c.px(dx - 2, roofEdge + 8, FLAME, FLAT);
  // Salt drifted against the wheels.
  c.part();
  for (let x = x0 - 2; x <= x1 + 2; x++) {
    const h = Math.round(1.5 + Math.sin(x * 0.4) * 1 + R() * 1.2);
    for (let y = fy - h; y <= fy; y++) c.px(x, y, SALT, UP, { bias: y === fy - h ? 1 : 0 });
  }
  return c;
}

// ---------------------------------------------------------------- the lantern post

export const LAMP_W = 16;
export const LAMP_H = 40;
export const LAMP_FOOT_Y = 38;

function lampFrame(): PixelCanvas {
  const c = new PixelCanvas(LAMP_W, LAMP_H);
  const x = 5;
  post(c, x, 9, LAMP_FOOT_Y, 1.4, WOOD_OLD);
  // A crooked arm out to the right.
  c.part();
  c.capsule(x, 10, x + 6, 7, 1, 0.8, WOOD_OLD);
  c.part();
  c.line(x + 6, 8, x + 6, 12, STRING);
  c.part();
  c.ellipse(x + 6.5, 16, 3, 3.6, LANTERN, { flatten: 0.6 });
  c.part();
  for (let px = x + 4; px <= x + 8; px++) c.px(px, 12, WOOD_DARK, UP, { bias: 1 });
  for (let px = x + 5; px <= x + 7; px++) c.px(px, 20, WOOD_DARK, FLAT);
  c.px(x + 6, 21, RIBBON, FLAT);
  c.px(x + 6, 22, RIBBON, FLAT, { bias: -1 });
  c.px(x + 6, 16, FLAME, FLAT);
  c.px(x + 6, 15, FLAME, FLAT, { bias: 1 });
  // A ribbon tied round the post.
  c.part();
  for (let px = x - 2; px < x + 2; px++) c.px(px, 27, RIBBON, cyl((px + 0.5 - x) / 2, 0.1));
  c.px(x + 2, 28, RIBBON, FLAT, { bias: -1 });
  return c;
}

// ---------------------------------------------------------------- cairns

export const CAIRN_W = 24;
export const CAIRN_H = 32;
export const CAIRN_FOOT_Y = 29;

function cairnFrame(v: number): PixelCanvas {
  const c = new PixelCanvas(CAIRN_W, CAIRN_H);
  const cx = CAIRN_W / 2;
  const b = CAIRN_FOOT_Y;
  const stack: [number, number, number, number, Material][] = [
    [[0, 2, 4.6, 2.2], [0.5, 5.4, 3.4, 1.8], [-0.3, 8, 2.2, 1.4]],
    [[0, 2.4, 6, 2.6], [-0.5, 6.2, 4.8, 2.2], [0.6, 9.6, 3.6, 1.8], [0, 12.4, 2.6, 1.5], [0.3, 14.6, 1.6, 1.1]],
    [[0, 2.6, 6.8, 2.8], [0.6, 6.8, 5.6, 2.4], [-0.4, 10.6, 4.6, 2], [0.4, 14, 3.8, 1.8], [-0.2, 17, 3, 1.5], [0.3, 19.6, 2.2, 1.3], [0, 21.6, 1.3, 1]],
  ][v].map(([ox, oy, rx, ry], k) => [ox, oy, rx, ry, [STONE_PALE, STONE_TAN, STONE_PALE, STONE_BLUE][(k + v) % 4]] as [number, number, number, number, Material]);
  for (const [ox, oy, rx, ry, m] of stack) {
    c.part();
    c.ellipse(cx + ox, b - oy, rx, ry, m, { flatten: 0.7 });
  }
  if (v === 2) {
    // A strip of cloth tied round the top, fluttering.
    c.part();
    const ty = b - 17;
    for (let px = cx - 3; px <= cx + 3; px++) c.px(px, ty, RIBBON, FRONT);
    c.px(cx + 4, ty + 1, RIBBON, FLAT);
    c.px(cx + 5, ty + 1, RIBBON, FLAT, { bias: -1 });
    c.px(cx + 6, ty + 2, RIBBON, FLAT, { bias: -1 });
  }
  return c;
}

// ---------------------------------------------------------------- wind chimes

export const CHIME_W = 26;
export const CHIME_H = 48;
export const CHIME_FOOT_Y = 45;
/** How far (px) the breeze pushes the tubes' feet and the ribbon's tail, frame by frame. */
const CHIME_SWAY = [0, 1, 0, -1];

function chimeFrame(v: number, f: number): PixelCanvas {
  const c = new PixelCanvas(CHIME_W, CHIME_H);
  const s = CHIME_SWAY[f];
  const x = 7;
  const top = v === 0 ? 8 : 11;
  const tube = v === 0 ? SILVER : BRASS;
  const ribbon = v === 0 ? RIBBON : RIBBON_BLUE;
  // A silvered pole bowed over at the top.
  post(c, x, top + 2, CHIME_FOOT_Y, 1.3, WOOD_OLD);
  c.part();
  c.capsule(x, top + 3, x + 4, top, 1.1, 1, WOOD_OLD);
  c.capsule(x + 4, top, x + 10, top + 1, 1, 0.8, WOOD_OLD);
  // The chime hung from its tip: a wooden disc, tubes of different lengths, a clapper and its sail.
  const hx = x + 10;
  c.part();
  c.line(hx, top + 2, hx, top + 4, STRING);
  c.part();
  for (let px = hx - 4; px <= hx + 4; px++) c.px(px, top + 5, WOOD_WARM, UP, { bias: 1 });
  for (let px = hx - 3; px <= hx + 3; px++) c.px(px, top + 6, WOOD_WARM, FRONT, { bias: -1 });
  const lens = v === 0 ? [7, 10, 8, 11, 6] : [9, 12, 10, 7];
  const step = v === 0 ? 2 : 2.5;
  lens.forEach((len, k) => {
    c.part();
    const tx = hx - ((lens.length - 1) * step) / 2 + k * step;
    for (let q = 0; q < len; q++) {
      const t = q / len;
      c.px(tx + s * t * t, top + 8 + q, tube, cyl(k % 2 ? 0.3 : -0.3, 0.1), { bias: q < 2 ? 1 : 0 });
    }
  });
  c.part();
  const cl = top + 8 + 8;
  c.line(hx, top + 7, hx + s, cl, STRING);
  c.ellipse(hx + s + 0.5, cl + 0.5, 1.2, 1.2, WOOD_WARM, { flatten: 0.8 });
  // The ribbon sail, its tail stirring the most.
  c.part();
  for (let q = 0; q < 9; q++) {
    const t = q / 8;
    const rx = hx + s + Math.round(s * 2 * t * t + Math.sin(t * 3 + f) * 0.6);
    c.px(rx, cl + 2 + q, ribbon, FRONT, { bias: q < 3 ? 1 : q > 6 ? -1 : 0 });
    if (q < 6) c.px(rx + 1, cl + 2 + q, ribbon, FRONT, { bias: -1 });
  }
  return c;
}

// ---------------------------------------------------------------- tola shrubs

export const SHRUB_W = 30;
export const SHRUB_H = 24;
export const SHRUB_FOOT_Y = 21;

function shrubFrame(v: number): PixelCanvas {
  const c = new PixelCanvas(SHRUB_W, SHRUB_H);
  const R = rng(2600 + v * 31);
  const cx = SHRUB_W / 2;
  const rx = [10, 12, 8][v];
  const ry = [7, 8, 6][v];
  const cy = SHRUB_FOOT_Y - ry;
  for (let k = -2; k <= 2; k++) c.capsule(cx + k * 1.5, SHRUB_FOOT_Y, cx + k * 3, SHRUB_FOOT_Y - 5, 0.7, 0.5, WOOD_DARK);
  // Little clumps of resinous leaves, back to front, lit on the dome's sunny upper left.
  const bits: { x: number; y: number; r: number; dry: boolean }[] = [];
  for (let k = 0; k < 80 + v * 12; k++) {
    const a = R() * Math.PI * 2;
    const d = Math.sqrt(R());
    bits.push({ x: cx + Math.cos(a) * d * rx, y: cy + Math.sin(a) * d * ry, r: 1 + R() * 0.9, dry: R() < 0.1 });
  }
  bits.sort((a, b) => a.y - b.y);
  for (const b of bits) {
    c.part();
    const u = (b.x - cx) / rx;
    const w = (b.y - cy) / ry;
    c.ellipse(b.x, b.y, b.r, b.r * 0.85, b.dry ? TOLA_DRY : TOLA, { flatten: 0.6, bias: Math.round(-w * 1.8 - u * 0.8) });
  }
  // Pale specks of flower heads.
  for (let k = 0; k < 6; k++) {
    const a = R() * Math.PI * 2;
    const d = Math.sqrt(R()) * 0.8;
    const x = cx + Math.cos(a) * d * rx;
    const y = cy + Math.sin(a) * d * ry - 1;
    if (c.materialAt(x, y) === TOLA) c.px(x, y, ICHU, UP, { bias: 3 });
  }
  return c;
}

// ---------------------------------------------------------------- cardón cacti

export const CACTUS_W = 36;
export const CACTUS_H = 66;
export const CACTUS_FOOT_Y = 63;

function column(c: PixelCanvas, x: number, y0: number, y1: number, hw: number, R: () => number): void {
  // A ribbed column, its top domed.
  for (let y = y0; y <= y1; y++) {
    const dome = y - y0 < hw ? Math.sqrt(1 - Math.pow(1 - (y - y0 + 0.5) / hw, 2)) : 1;
    const w = hw * dome;
    for (let px = Math.floor(x - w); px < x + w; px++) {
      const u = (px + 0.5 - x) / hw;
      const rib = Math.floor(px - x + 20) % 2 === 0;
      const n = y - y0 < hw ? sphere(u, -(1 - (y - y0) / hw) * 0.8, 0.9) : cyl(u, 0.15);
      c.px(px, y, CACTUS, n, { bias: rib ? -1 : 0 });
    }
  }
  // Spines catching the light along the ribs.
  for (let y = y0 + 1; y <= y1 - 2; y += 2) {
    const px = Math.floor(x - hw + R() * hw * 2);
    if (c.materialAt(px, y) === CACTUS && R() < 0.3) c.px(px, y, SPINE, UP, { bias: -1 });
  }
}

function cactusFrame(v: number): PixelCanvas {
  const c = new PixelCanvas(CACTUS_W, CACTUS_H);
  const R = rng(3100 + v * 13);
  const cx = CACTUS_W / 2;
  const fy = CACTUS_FOOT_Y;
  const L = [
    { h: 52, arms: [{ side: -1, at: 30, out: 7, up: 16 }, { side: 1, at: 22, out: 6, up: 12 }] },
    { h: 44, arms: [{ side: 1, at: 26, out: 7, up: 14 }] },
    { h: 58, arms: [{ side: -1, at: 24, out: 6, up: 20 }, { side: 1, at: 34, out: 8, up: 10 }], bloom: true },
  ][v];
  // Arms behind first, bent up from the trunk.
  for (const a of L.arms) {
    c.part();
    const ay = fy - a.at;
    const ax = cx + a.side * (3 + a.out);
    for (let px = Math.min(cx, ax); px <= Math.max(cx, ax); px++) for (let y = ay - 2; y <= ay + 2; y++) c.px(px, y, CACTUS, sphere(0, (y - ay) / 3, 0.9), { bias: (px - cx + 20) % 2 === 0 ? -1 : 0 });
    c.part();
    column(c, ax, ay - a.up, ay + 2, 3, R);
  }
  c.part();
  column(c, cx, fy - L.h, fy, 4.2, R);
  if ('bloom' in L) {
    c.part();
    for (const [ox, oy] of [[0, 0], [-1, 0], [1, 0], [0, -1]]) c.px(cx + ox, fy - L.h - 1 + oy, BLOOM, UP, { bias: oy < 0 ? 2 : 1 });
  }
  return c;
}

// ---------------------------------------------------------------- ichu grass

export const GRASS_W = 20;
export const GRASS_H = 20;
export const GRASS_FOOT_Y = 18;

function grassFrame(v: number): PixelCanvas {
  const c = new PixelCanvas(GRASS_W, GRASS_H);
  const R = rng(3700 + v * 29);
  const n = 8 + v;
  const cx = GRASS_W / 2;
  for (let k = 0; k < n; k++) {
    c.part();
    const u = (k / (n - 1)) * 2 - 1;
    const len = Math.round(9 + (1 - Math.abs(u)) * 6 + R() * 3);
    const lean = u * (3 + R() * 4) + (R() - 0.5) * 1.5;
    for (let s = 0; s < len; s++) {
      const t = s / len;
      const x = cx + u * 1.5 + lean * t * t;
      c.px(x, GRASS_FOOT_Y - s, ICHU, sphere(Math.sign(lean) * 0.5, -0.2, 0.8), { bias: Math.round(-u * 1.2 + t * 3) - 1 });
    }
  }
  return c;
}

// ---------------------------------------------------------------- coral stone

export const ROCK_W = 32;
export const ROCK_H = 24;
export const ROCK_FOOT_Y = 20;

function rockFrame(v: number): PixelCanvas {
  const c = new PixelCanvas(ROCK_W, ROCK_H);
  const R = rng(4300 + v * 11);
  const cx = ROCK_W / 2;
  const b = ROCK_FOOT_Y;
  const parts: [number, number, number, number][] = [
    [[-2, 2, 3.4, 2.4], [3, 1, 2.2, 1.6]],
    [[0, 4, 7, 4.6], [6, 1.2, 2.6, 1.8]],
    [[-1, 7, 10.5, 7.4], [8, 2.6, 4, 3], [-9, 1.6, 2.6, 1.8]],
  ][v] as [number, number, number, number][];
  for (const [ox, oy, rx, ry] of parts) {
    c.part();
    c.ellipse(cx + ox, b - oy, rx, ry, CORAL, { flatten: 0.75 });
  }
  // Old coral's pits and pores.
  for (let k = 0; k < 18 + v * 14; k++) {
    const x = cx - 11 + Math.floor(R() * 22);
    const y = b - 14 + Math.floor(R() * 14);
    if (c.materialAt(x, y) === CORAL && c.materialAt(x, y - 1) === CORAL) c.shade(x, y, -2);
  }
  return c;
}

// ---------------------------------------------------------------- salt cones

export const PILE_W = 20;
export const PILE_H = 18;
export const PILE_FOOT_Y = 15;

function pileFrame(v: number): PixelCanvas {
  const c = new PixelCanvas(PILE_W, PILE_H);
  const R = rng(4700 + v * 7);
  const cx = PILE_W / 2 + (v === 1 ? 0.5 : 0);
  const rx = [6.5, 7.5, 5.5][v];
  const h = [10, 12, 8][v];
  const top = PILE_FOOT_Y - h;
  for (let y = top; y <= PILE_FOOT_Y; y++) {
    const t = (y - top) / h;
    const hw = rx * Math.pow(t, 0.75) + (t < 0.15 ? 0.8 : 0);
    for (let x = Math.floor(cx - hw); x < cx + hw; x++) {
      const u = (x + 0.5 - cx) / Math.max(1, hw);
      const n = norm(u * 0.85, 0.55 - t * 0.3, 0.6);
      // The foot wet where it stands in the water.
      c.px(x, y, SALT, n, { bias: (y >= PILE_FOOT_Y - 1 ? -2 : 0) + (R() < 0.12 ? (R() < 0.5 ? -1 : 1) : 0) });
    }
  }
  return c;
}

// ---------------------------------------------------------------- flamingos

export const FLAM_W = 22;
export const FLAM_H = 32;
export const FLAM_FOOT_Y = 30;

type FlamPose = 'walk0' | 'walk1' | 'walk2' | 'walk3' | 'stand' | 'oneleg' | 'feed0' | 'feed1' | 'preen';

/** The neck's curve for each kind of pose: points from the body's front to the head. */
const NECKS: Record<'up' | 'feed0' | 'feed1' | 'preen', [number, number][]> = {
  up: [[14, 13], [16.5, 10.5], [14.5, 7], [15.5, 4]],
  feed0: [[14, 13], [17, 13.5], [19, 18], [19, 25]],
  feed1: [[14, 13], [17.5, 14], [20, 19], [20, 25.5]],
  preen: [[14, 13], [16, 9], [14, 6.5], [11.5, 10.5]],
};

function flamingoFrame(pose: FlamPose): PixelCanvas {
  const c = new PixelCanvas(FLAM_W, FLAM_H);
  const fy = FLAM_FOOT_Y;
  const bob = pose === 'walk1' || pose === 'walk3' ? -1 : 0;
  // A faint ring round the feet: it stands in the water.
  for (let a = 0; a < 20; a++) {
    const t = (a / 20) * Math.PI * 2;
    if (a % 3 === 2) continue;
    c.px(10 + Math.cos(t) * 4.5, fy + 0.5 + Math.sin(t) * 1.2, RIPPLE, UP, { bias: Math.sin(t) < 0 ? 1 : 0 });
  }
  // Legs: long and thin, the knee bending backward.
  c.part();
  const legs: [number, number, number, number, number, number][] =
    pose === 'walk0' ? [[9, 18, 9, 23, 8, fy], [11, 18, 13, 23, 14, fy - 2]]
      : pose === 'walk1' ? [[9, 18, 9.5, 23, 9, fy], [11, 18, 11.5, 23, 11, fy - 1]]
        : pose === 'walk2' ? [[9, 18, 7, 23, 6, fy - 2], [11, 18, 11, 23, 12, fy]]
          : pose === 'walk3' ? [[9, 18, 9.5, 23, 9, fy - 1], [11, 18, 11.5, 23, 11, fy]]
            : pose === 'oneleg' ? [[10, 18, 10, 23, 10, fy]]
              : [[9, 18, 9, 23, 9, fy], [11, 18, 11, 23, 11, fy]];
  for (const [ax, ay, kx, ky, fx, ffy] of legs) {
    c.line(ax, ay + bob, kx, ky + bob, LEG, () => cyl(-0.3));
    c.line(kx, ky + bob, fx, ffy, LEG, () => cyl(-0.3));
    c.px(kx, ky + bob, LEG, FLAT, { bias: 1 });
    c.px(fx + 1, ffy, LEG, FLAT, { bias: -1 });
  }
  if (pose === 'oneleg') {
    // The other leg tucked up under the belly.
    c.line(11, 18, 13, 21, LEG, () => FLAT);
    c.line(13, 21, 10, 22, LEG, () => FLAT);
  }
  // The body, its wing folded over it, black flight feathers at the tail.
  c.part();
  c.ellipse(10, 15 + bob, 5.6, 3.4, PLUME, { flatten: 0.8 });
  c.part();
  c.ellipse(9, 14 + bob, 4.6, 2.3, WING_ROSE, { flatten: 0.7, bias: 1 });
  c.part();
  for (const [x, y] of [[4, 14], [4, 15], [5, 15], [3, 15], [5, 16]]) c.px(x, y + bob, QUILL, FLAT, { bias: y === 14 ? 1 : 0 });
  for (const [x, y] of [[6, 12], [7, 12], [8, 12]]) c.px(x, y + bob, PLUME, UP, { bias: 2 });
  // The neck, a long S, and the small head with its bent beak.
  const neck = NECKS[pose === 'feed0' ? 'feed0' : pose === 'feed1' ? 'feed1' : pose === 'preen' ? 'preen' : 'up'];
  c.part();
  for (let k = 0; k < neck.length - 1; k++) {
    const [ax, ay] = neck[k];
    const [bx, by] = neck[k + 1];
    c.capsule(ax, ay + bob, bx, by + bob, k === 0 ? 1.5 : 1, 0.9, PLUME);
  }
  const [hx, hy0] = neck[neck.length - 1];
  const hy = hy0 + bob;
  c.part();
  c.ellipse(hx + 0.5, hy, 1.8, 1.5, PLUME, { flatten: 0.8, bias: 1 });
  if (pose === 'feed0' || pose === 'feed1') {
    // Head down, upside down in the water, sifting.
    c.px(hx + 1, hy + 2, BEAK, FLAT);
    c.px(hx, hy + 2, BEAK, FLAT);
    c.px(hx - 1, hy + 3, BEAK_TIP, FLAT);
    c.px(hx, hy - 1, EYE, FLAT);
    for (const ox of [-3, -2, 2, 3]) c.px(hx + ox, hy + 3, RIPPLE, UP, { bias: 1 });
  } else if (pose === 'preen') {
    c.px(hx - 1.5, hy + 1, BEAK, FLAT);
    c.px(hx - 2.5, hy + 1.5, BEAK_TIP, FLAT);
    c.px(hx + 0.5, hy - 0.5, EYE, FLAT);
  } else {
    c.px(hx + 2, hy - 0.5, BEAK, FLAT, { bias: 1 });
    c.px(hx + 3, hy - 0.5, BEAK, FLAT);
    c.px(hx + 3, hy + 0.5, BEAK, FLAT, { bias: -1 });
    c.px(hx + 4, hy + 1, BEAK_TIP, FLAT);
    c.px(hx + 3, hy + 1.5, BEAK_TIP, FLAT);
    c.px(hx + 1, hy - 0.5, EYE, FLAT);
  }
  return c;
}

// ---------------------------------------------------------------- a flamingo in flight

export const FLYER_W = 40;
export const FLYER_H = 24;
/** Wing spread by frame: how far out (px) and how swept back the tips are. */
const FLY_WINGS = [
  { span: 12, sweep: 3, lift: 0 },
  { span: 9, sweep: 2, lift: 1 },
  { span: 4, sweep: 1, lift: 2 },
  { span: 9, sweep: 2, lift: 1 },
];

function flyerFrame(f: number): PixelCanvas {
  const c = new PixelCanvas(FLYER_W, FLYER_H);
  const cy = 12;
  const w = FLY_WINGS[f];
  // Legs trailing far behind, neck reaching far ahead: flamingos fly stretched out.
  c.line(4, cy, 13, cy, LEG, () => FLAT);
  c.px(3, cy, LEG, FLAT, { bias: -1 });
  for (const side of [-1, 1]) {
    c.part();
    for (let s = 0; s <= w.span; s++) {
      const t = s / w.span;
      const x = 19 - w.sweep * t * t - (side < 0 ? w.lift * t : 0);
      const y = cy + side * (1 + s * (side < 0 ? 0.85 : 0.6));
      const tip = t > 0.6;
      const chord = Math.round(4 - t * 1.6);
      for (let q = 0; q < chord; q++) c.px(x - q, y, tip && q > 0 ? QUILL : WING_ROSE, side < 0 ? UP : sphere(0, -0.2, 0.9), { bias: q === 0 ? 1 : 0 });
    }
  }
  c.part();
  c.capsule(14, cy, 21, cy, 1.6, 1.8, PLUME);
  c.part();
  c.capsule(21, cy, 32, cy - 0.5, 0.9, 0.7, PLUME);
  c.ellipse(33, cy - 0.5, 1.4, 1.2, PLUME, { flatten: 0.8, bias: 1 });
  c.px(35, cy - 0.5, BEAK, FLAT);
  c.px(36, cy, BEAK_TIP, FLAT);
  return c;
}

// ---------------------------------------------------------------- ripples and a falling star

export const RIPPLE_W = 40;
export const RIPPLE_H = 18;
export const RIPPLE_FRAMES = 6;

function rippleFrame(f: number): PixelCanvas {
  const c = new PixelCanvas(RIPPLE_W, RIPPLE_H);
  const R = rng(5300 + f);
  const cx = RIPPLE_W / 2;
  const cy = RIPPLE_H / 2;
  // An outer ring spreading and thinning, and a smaller one following it.
  for (const [rx, fade] of [[3 + f * 3.2, f * 0.13], [f >= 2 ? (f - 1.5) * 3 : 0, 0.25 + f * 0.1]]) {
    if (rx < 1.5) continue;
    const ry = rx * 0.42;
    const n = Math.round(rx * 6);
    for (let a = 0; a < n; a++) {
      const t = (a / n) * Math.PI * 2;
      if (R() < fade) continue;
      const near = Math.sin(t) > 0;
      c.px(cx + Math.cos(t) * rx, cy + Math.sin(t) * ry, RIPPLE, UP, { bias: (near ? -1 : 1) - Math.floor(f / 3) });
    }
  }
  return c;
}

function meteorFrame(): PixelCanvas {
  const c = new PixelCanvas(RIPPLE_W, RIPPLE_H);
  // Its head at the lower right, the tail fading up and back.
  for (let k = 0; k <= 30; k++) {
    const t = k / 30;
    c.px(5 + k, 3 + t * 10, METEOR, FLAT, { bias: Math.round(t * 3) - 1 });
  }
  c.px(36, 13, METEOR, FLAT, { bias: 3 });
  c.px(35, 14, METEOR, FLAT, { bias: 1 });
  return c;
}

// ---------------------------------------------------------------- the clouds the mirror holds

export const CLOUD_W = 84;
export const CLOUD_H = 34;

function cloudFrame(v: number): PixelCanvas {
  const c = new PixelCanvas(CLOUD_W, CLOUD_H);
  const R = rng(5900 + v * 37);
  const cx = CLOUD_W / 2;
  const cy = CLOUD_H / 2 + 2;
  const n = 5 + v;
  const blobs: { x: number; y: number; rx: number; ry: number }[] = [];
  for (let k = 0; k < n; k++) {
    const u = (k / (n - 1)) * 2 - 1;
    blobs.push({ x: cx + u * (22 + v * 3) + (R() - 0.5) * 6, y: cy - (1 - Math.abs(u)) * 5 + (R() - 0.5) * 4, rx: 9 + R() * 7 + (1 - Math.abs(u)) * 5, ry: 6 + R() * 3 + (1 - Math.abs(u)) * 3 });
  }
  blobs.sort((a, b) => a.y - b.y);
  for (const b of blobs) {
    c.part();
    c.ellipse(b.x, b.y, b.rx, b.ry, CLOUD, { flatten: 0.9 });
  }
  // Soft, broken edges: the rim thins into dither (decided before any is erased).
  const gone: [number, number][] = [];
  for (let y = 0; y < CLOUD_H; y++) {
    for (let x = 0; x < CLOUD_W; x++) {
      if (!c.filled(x, y)) continue;
      let open = 0;
      for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) if (!c.filled(x + dx, y + dy)) open++;
      if ((open > 0 && (x + y) % 2 === 0) || (open > 1 && R() < 0.5)) gone.push([x, y]);
    }
  }
  for (const [x, y] of gone) c.erase(x, y);
  return c;
}

// ---------------------------------------------------------------- the sheets

const one = (key: string, w: number, h: number, footY: number, names: string[], draw: (k: number) => PixelCanvas, extra: Partial<SheetDef> = {}): SheetDef => ({
  key,
  w,
  h,
  footX: Math.floor(w / 2),
  footY,
  frames: names.map((name, k) => ({ name, draw: () => draw(k) })),
  ...extra,
});

export function saltSheets(): SheetDef[] {
  const chimeFrames: SheetDef['frames'] = [];
  for (let v = 0; v < 2; v++) for (let f = 0; f < CHIME_SWAY.length; f++) chimeFrames.push({ name: `v${v}_${f}`, draw: () => chimeFrame(v, f) });
  const poses: [string, FlamPose][] = [['w0', 'walk0'], ['w1', 'walk1'], ['w2', 'walk2'], ['w3', 'walk3'], ['i0', 'stand'], ['i1', 'oneleg'], ['i2', 'feed0'], ['i3', 'feed1'], ['i4', 'preen']];
  return [
    one('salt_teahouse', TEA_W, TEA_H, TEA_FOOT_Y, ['tea'], teaFrame, { glows: true }),
    one('salt_train', TRAIN_W, TRAIN_H, TRAIN_FOOT_Y, ['car'], trainFrame, { glows: true }),
    one('salt_lamp', LAMP_W, LAMP_H, LAMP_FOOT_Y, ['l0'], lampFrame, { glows: true, footX: 5 }),
    one('salt_cairn', CAIRN_W, CAIRN_H, CAIRN_FOOT_Y, ['c0', 'c1', 'c2'], cairnFrame),
    {
      key: 'salt_chime',
      w: CHIME_W,
      h: CHIME_H,
      footX: 7,
      footY: CHIME_FOOT_Y,
      frames: chimeFrames,
      anims: [0, 1].map((v) => ({ name: `ring${v}`, frames: [`v${v}_0`, `v${v}_1`, `v${v}_0`, `v${v}_3`], fps: 1.4, loop: true })),
    },
    one('salt_shrub', SHRUB_W, SHRUB_H, SHRUB_FOOT_Y, ['b0', 'b1', 'b2'], shrubFrame),
    one('salt_cactus', CACTUS_W, CACTUS_H, CACTUS_FOOT_Y, ['k0', 'k1', 'k2'], cactusFrame),
    one('salt_grass', GRASS_W, GRASS_H, GRASS_FOOT_Y, ['g0', 'g1', 'g2', 'g3'], grassFrame),
    one('salt_rock', ROCK_W, ROCK_H, ROCK_FOOT_Y, ['r0', 'r1', 'r2'], rockFrame),
    one('salt_pile', PILE_W, PILE_H, PILE_FOOT_Y, ['p0', 'p1', 'p2'], pileFrame),
    {
      key: 'salt_flamingo',
      w: FLAM_W,
      h: FLAM_H,
      footX: 10,
      footY: FLAM_FOOT_Y,
      frames: poses.map(([name, pose]) => ({ name, draw: () => flamingoFrame(pose) })),
      anims: [
        { name: 'walk', frames: ['w0', 'w1', 'w2', 'w3'], fps: 5, loop: true },
        { name: 'idle', frames: ['i0', 'i0', 'i0', 'i2', 'i3', 'i2', 'i3', 'i2', 'i0', 'i0', 'i1', 'i1', 'i1', 'i1', 'i1', 'i0', 'i4', 'i4', 'i0'], fps: 2.5, loop: true },
      ],
    },
    {
      key: 'salt_flyer',
      w: FLYER_W,
      h: FLYER_H,
      footX: FLYER_W / 2,
      footY: FLYER_H / 2,
      frames: FLY_WINGS.map((_, f) => ({ name: `f${f}`, draw: () => flyerFrame(f) })),
      anims: [{ name: 'fly', frames: ['f0', 'f1', 'f2', 'f3', 'f0', 'f1', 'f2', 'f3', 'f0', 'f0', 'f0'], fps: 6, loop: true }],
    },
    {
      key: 'salt_ripple',
      w: RIPPLE_W,
      h: RIPPLE_H,
      footX: RIPPLE_W / 2,
      footY: RIPPLE_H / 2,
      frames: [...Array.from({ length: RIPPLE_FRAMES }, (_, f) => ({ name: `r${f}`, draw: () => rippleFrame(f) })), { name: 'm0', draw: meteorFrame }],
      glows: true,
    },
    one('salt_cloud', CLOUD_W, CLOUD_H, CLOUD_H / 2, ['c0', 'c1', 'c2', 'c3'], cloudFrame),
  ];
}
