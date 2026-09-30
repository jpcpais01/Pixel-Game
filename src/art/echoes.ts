// Echoes of the fallen: the gravestones left where players died, the pale
// soul flame on each grave's candle, the wisp a blessing flies in on, and the
// blessing's badge. The stones are lit (diffuse + normal) with a faint glowing
// rune in the emissive layer; the flame and the wisp are light only.

import { PixelCanvas, hex, type Material, type RGB, type Vec3 } from './pixel';
import { rng } from './env';

export const GRAVE_W = 24;
export const GRAVE_H = 32;
/** The stones stand on this row (the front of the mound sits a little lower). */
export const GRAVE_FOOT = 26;
/** Where each stone's candle wick is (x the candle's middle, y the wick's row), for the soul flame to sit on. */
export const GRAVE_WICK: { x: number; y: number }[] = [
  { x: 20, y: 23 },
  { x: 5, y: 24 },
  { x: 19, y: 24 },
];
export const GRAVE_KINDS = GRAVE_WICK.length;

export const FLAME_W = 5;
export const FLAME_H = 10;
export const FLAME_FRAMES = 6;
export const WISP_PX = 11;

const ramp = (...c: string[]): RGB[] => c.map(hex);
const INK = hex('#0b0a12');

const STONE: Material = { ramp: ramp('#181722', '#252433', '#353445', '#4a495b', '#626174', '#7e7d8f', '#9c9aab'), outline: INK, outlineLit: hex('#1b1a27') };
const MOSS: Material = { ramp: ramp('#12241c', '#1d3a27', '#2b5232', '#3f6c3c', '#5a8a4a'), outline: INK };
const EARTH: Material = { ramp: ramp('#15110f', '#211a16', '#2e241d', '#3d3026', '#4d3d30'), outline: INK };
const GRASS: Material = { ramp: ramp('#132a1c', '#1e4028', '#2f5a33', '#467a40'), outline: INK, noOutline: true };
const WAX: Material = { ramp: ramp('#4a3e33', '#7d6c58', '#b8a488', '#e4d6b8', '#fff6e0'), outline: hex('#140f0c') };
const WICK: Material = { ramp: ramp('#0e0c0c', '#231c1a'), outline: INK, noOutline: true };
/** The carved rune, faintly alight with what's left of them. */
const GLYPH: Material = { ramp: ramp('#1a3a58', '#2c6690', '#56a8d0', '#a8e6ff'), outline: INK, emissive: 0.75, noAO: true, noOutline: true };
/** Pale asphodel, the flower of the fields of the dead. */
const PETAL: Material = { ramp: ramp('#6a6a86', '#a8a8c6', '#dcdcf0', '#ffffff'), outline: INK, noOutline: true };

const unit = (x: number, y: number, z: number): Vec3 => {
  const l = Math.hypot(x, y, z) || 1;
  return { x: x / l, y: y / l, z: z / l };
};

/** The face of a slab: nearly flat, rounding off at its edges, catching the light along its top. */
const face = (t: number, top: number): Vec3 => unit(Math.sign(t) * Math.max(0, Math.abs(t) - 0.55) * 1.6, 0.18 + top * 0.6, 1);
/** The slab's thickness, seen past its right side and over its top: turned away from the key light. */
const SIDE: Vec3 = unit(0.8, 0.35, 0.5);

/**
 * Draw a slab of stone: its thickness first (offset up and right, so the top
 * and the right side show, as a stone seen from a little above), then its
 * face. `inside(x, y)` says which pixels the face covers.
 */
function slab(c: PixelCanvas, x0: number, x1: number, y0: number, y1: number, inside: (x: number, y: number) => boolean, depth = 2): void {
  c.part();
  for (let y = y0 - depth; y <= y1; y++) {
    for (let x = x0; x <= x1 + depth; x++) {
      for (let d = 1; d <= depth; d++) {
        if (inside(x - d, y + d)) {
          c.px(x, y, STONE, SIDE, { bias: d === depth ? -1 : 0 });
          break;
        }
      }
    }
  }
  c.part();
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!inside(x, y)) continue;
      // Edges of the face bevel toward what's beyond them.
      const l = !inside(x - 1, y);
      const r = !inside(x + 1, y);
      const up = !inside(x, y - 1);
      const t = l ? -1 : r ? 1 : 0;
      c.px(x, y, STONE, up ? unit(t * 0.3, 0.8, 0.6) : face(t, 0));
    }
  }
}

/** Grain and weathering: a scatter of darker and lighter flecks over the stone. */
function weather(c: PixelCanvas, seed: number): void {
  const R = rng(seed);
  for (let y = 0; y < GRAVE_H; y++) {
    for (let x = 0; x < GRAVE_W; x++) {
      if (c.materialAt(x, y) !== STONE) continue;
      const r = R();
      if (r < 0.08) c.shade(x, y, -1);
      else if (r > 0.95) c.shade(x, y, 1);
    }
  }
}

/** A crack: a dark line with a lit lip on its upper-left edge. */
function crack(c: PixelCanvas, pts: [number, number][]): void {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    for (let k = 0; k <= n; k++) {
      const x = Math.round(ax + ((bx - ax) * k) / (n || 1));
      const y = Math.round(ay + ((by - ay) * k) / (n || 1));
      if (c.materialAt(x, y) !== STONE) continue;
      c.shade(x, y, -3);
      if (c.materialAt(x - 1, y) === STONE) c.shade(x - 1, y, 1);
    }
  }
}

/** Carve a pixel of the rune: cut into the stone and lit from within. */
const rune = (c: PixelCanvas, x: number, y: number, bright = 0) => {
  if (c.materialAt(x, y) === STONE) c.px(x, y, GLYPH, unit(0, -0.3, 1), { bias: bright });
};
/** An epitaph's worn lettering: short dark dashes. */
function epitaph(c: PixelCanvas, x0: number, x1: number, y: number, seed: number): void {
  const R = rng(seed);
  for (let x = x0; x <= x1; x++) if (R() < 0.7 && c.materialAt(x, y) === STONE) c.shade(x, y, -2);
}

/** Moss clinging to the stone: soft round patches. */
function moss(c: PixelCanvas, x: number, y: number, rx: number, ry: number): void {
  c.part();
  for (let py = Math.floor(y - ry); py <= Math.ceil(y + ry); py++) {
    for (let px = Math.floor(x - rx); px <= Math.ceil(x + rx); px++) {
      const dx = (px + 0.5 - x) / rx;
      const dy = (py + 0.5 - y) / ry;
      if (dx * dx + dy * dy > 1 || c.materialAt(px, py) !== STONE) continue;
      c.px(px, py, MOSS, unit(dx * 0.6, -dy * 0.6 + 0.3, 0.8));
    }
  }
}

/** The grave's mound: freshly turned earth before the stone, with tufts of grass and a pale flower or two. */
function mound(c: PixelCanvas, cx: number, cy: number, rx: number, seed: number, flowers: [number, number][]): void {
  const R = rng(seed);
  c.part();
  c.ellipse(cx, cy, rx, 2.6, EARTH, { flatten: 0.55 });
  // Clods on the mound.
  for (let i = 0; i < 5; i++) c.shade(Math.round(cx - rx + 2 + R() * (rx * 2 - 4)), Math.round(cy - 1 + R() * 2), R() < 0.5 ? -1 : 1);
  c.part();
  for (const x of [cx - rx + 0.5, cx - rx + 2, cx + rx - 1.5, cx + rx - 0.2]) {
    const h = 1 + Math.floor(R() * 3);
    const bx = Math.round(x);
    const by = Math.round(cy + 1.5 - R() * 1.5);
    for (let k = 0; k < h; k++) c.px(bx + (k === h - 1 && R() < 0.5 ? (R() < 0.5 ? -1 : 1) : 0), by - k, GRASS, unit(0, 0.6, 0.8), { bias: k === h - 1 ? 1 : 0 });
  }
  for (const [fx, fy] of flowers) {
    c.px(fx, fy + 1, GRASS, unit(0, 0.5, 0.8));
    c.px(fx, fy, PETAL, unit(-0.3, 0.6, 0.7), { bias: 1 });
    c.px(fx - 1, fy, PETAL, unit(-0.7, 0.3, 0.6));
    c.px(fx + 1, fy, PETAL, unit(0.7, 0.3, 0.6), { bias: -1 });
    c.px(fx, fy - 1, PETAL, unit(0, 0.9, 0.4), { bias: 1 });
  }
}

/** A stub of a votive candle two pixels wide, centred on `x`, its wick left for the soul flame. */
function candle(c: PixelCanvas, x: number, top: number, h: number): void {
  c.part();
  for (let y = top; y < top + h; y++) {
    c.px(x - 1, y, WAX, unit(-0.6, 0.2, 0.8), { bias: y === top ? 1 : 0 });
    c.px(x, y, WAX, unit(0.5, 0.2, 0.8), { bias: y === top ? 1 : 0 });
  }
  // A drip of wax down its lit side.
  c.px(x - 1, top + 1, WAX, unit(-0.2, 0.5, 0.8), { bias: 2 });
  c.px(x - 2, top + h - 1, WAX, unit(-0.5, 0.2, 0.8));
  c.px(x, top - 1, WICK, unit(0, 0.5, 0.8));
}

/** A rounded headstone, leaning a little, cracked, with a carved rune and moss at its foot. */
function headstone(c: PixelCanvas): void {
  const lean = (y: number) => (GRAVE_FOOT - y) * 0.07;
  const cx = 11;
  const inside = (x: number, y: number) => {
    if (y < 7 || y > GRAVE_FOOT) return false;
    const mid = cx + lean(y);
    let hw = 6.5;
    if (y < 13) {
      const dy = 13 - (y + 0.5);
      hw = Math.sqrt(Math.max(0, 6.5 * 6.5 - dy * dy * 1.05));
    }
    // Chipped: a bite out of its upper-right shoulder.
    if (y === 8 && x >= Math.round(mid + 3)) return false;
    return x + 0.5 >= mid - hw && x + 0.5 <= mid + hw;
  };
  slab(c, 2, 20, 6, GRAVE_FOOT, inside);
  weather(c, 11);
  // A sunken border just inside the edge of its face.
  for (let y = 10; y <= 22; y++) {
    const mid = cx + lean(y);
    let hw = 4.6;
    if (y < 14) {
      const dy = 14 - (y + 0.5);
      hw = Math.sqrt(Math.max(0, 4.6 * 4.6 - dy * dy * 1.1));
    }
    const l = Math.floor(mid - hw);
    const r = Math.floor(mid + hw);
    if (y < 11 || y === 22) for (let x = l; x <= r; x++) c.shade(x, y, -1);
    else {
      c.shade(l, y, -1);
      c.shade(r, y, -1);
    }
  }
  // A cross cut into it, faintly alight.
  const rx = Math.round(cx + lean(14));
  for (let y = 11; y <= 18; y++) rune(c, rx, y, y < 13 ? 1 : 0);
  for (let dx = -2; dx <= 2; dx++) if (dx) rune(c, rx + dx, 13, dx < 0 ? 1 : 0);
  epitaph(c, rx - 3, rx + 3, 19, 3);
  epitaph(c, rx - 2, rx + 2, 21, 7);
  crack(c, [[15, 9], [14, 11], [15, 13], [13, 16]]);
  moss(c, 6, 24, 3.4, 2.4);
  moss(c, 5.5, 11.5, 1.6, 1.4);
  moss(c, 16, 25, 2, 1.2);
  mound(c, 11, 27.5, 8.5, 4, [[4, 26], [15, 28]]);
  const w = GRAVE_WICK[0];
  candle(c, w.x, w.y + 1, 3);
}

/** A stone cross on a stepped plinth, a soul-light burning in the heart of it. */
function stoneCross(c: PixelCanvas): void {
  const cx = 12;
  const post = (x: number, y: number) => y >= 3 && y <= 20 && x >= cx - 2 && x <= cx + 1;
  // The arms, with their ends a pixel taller, as a cut stone cross has.
  const arms = (x: number, y: number) => x >= cx - 7 && x <= cx + 6 && (y >= 8 && y <= 10 || ((x <= cx - 6 || x >= cx + 5) && y >= 7 && y <= 11));
  const upper = (x: number, y: number) => y >= 20 && y <= 22 && x >= cx - 5 && x <= cx + 4;
  const lower = (x: number, y: number) => y >= 23 && y <= GRAVE_FOOT && x >= cx - 7 && x <= cx + 6;
  slab(c, 2, 22, 21, GRAVE_FOOT, lower);
  slab(c, 2, 22, 18, 22, upper);
  // Thinner than a headstone: its thickness a pixel, so the arms stay crisp.
  slab(c, 2, 22, 1, 19, (x, y) => post(x, y) || arms(x, y), 1);
  weather(c, 23);
  // The top step of each tier catches the light.
  for (let x = cx - 7; x <= cx + 6; x++) c.shade(x, 23, 1);
  for (let x = cx - 5; x <= cx + 4; x++) c.shade(x, 20, 1);
  // The soul-light at its heart: a small diamond, and a line of it down the post.
  rune(c, cx - 1, 8, 1);
  rune(c, cx, 8, 1);
  rune(c, cx - 2, 9, 1);
  rune(c, cx + 1, 9);
  rune(c, cx - 1, 10);
  rune(c, cx, 10);
  rune(c, cx - 1, 9, 2);
  rune(c, cx, 9, 2);
  for (let y = 13; y <= 16; y++) if (y !== 15) rune(c, cx - 1, y);
  epitaph(c, cx - 3, cx + 2, 21, 9);
  epitaph(c, cx - 5, cx + 4, 24, 5);
  crack(c, [[cx - 6, 8], [cx - 4, 10]]);
  crack(c, [[cx + 1, 15], [cx, 17], [cx + 1, 19]]);
  moss(c, cx - 5, 25, 2.6, 1.6);
  moss(c, cx - 2, 4, 1.4, 1);
  moss(c, cx + 5, 7.5, 1.2, 1);
  mound(c, cx, 28, 9, 6, [[cx + 7, 27]]);
  const w = GRAVE_WICK[1];
  candle(c, w.x, w.y + 1, 3);
}

/** A tall, narrow stone broken off at the top and leaning hard, ivy climbing it. */
function brokenSlab(c: PixelCanvas): void {
  const lean = (y: number) => -(GRAVE_FOOT - y) * 0.13;
  const cx = 11;
  // The break: a jagged edge falling away to the right.
  const topAt = (x: number) => {
    const u = x - (cx - 4);
    return u < 3 ? 5 - (u === 1 ? 1 : 0) : u < 5 ? 7 : u < 7 ? 8 + (u % 2) : 10;
  };
  const inside = (x: number, y: number) => {
    if (y > GRAVE_FOOT) return false;
    const mid = cx + lean(y);
    const lx = x + 0.5 - mid;
    if (lx < -4.5 || lx > 4.5) return false;
    return y >= topAt(Math.round(x - lean(y)));
  };
  slab(c, 2, 20, 3, GRAVE_FOOT, inside);
  weather(c, 37);
  // The raw break: rough, pale, fresher stone.
  for (let x = 2; x < 20; x++) {
    for (let y = 3; y < 14; y++) {
      if (c.materialAt(x, y) !== STONE || c.materialAt(x, y - 1)) continue;
      c.shade(x, y, (x * 7 + y) % 3 === 0 ? 2 : 1);
      break;
    }
  }
  // A hollow carved ring, the rune of a soul, and a worn line of lettering.
  const rcx = cx + lean(14) - 0.5;
  const ringX = Math.round(rcx);
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (Math.abs(Math.hypot(dx, dy) - 2.5) < 0.5) rune(c, ringX + dx, 14 + dy, dy < 0 ? 1 : 0);
  rune(c, ringX, 14, 2);
  epitaph(c, Math.round(rcx) - 3, Math.round(rcx) + 3, 19, 11);
  epitaph(c, Math.round(rcx) - 2, Math.round(rcx) + 2, 21, 13);
  crack(c, [[Math.round(rcx) + 2, 9], [Math.round(rcx) + 1, 11]]);
  // Ivy up its left edge.
  c.part();
  const R = rng(41);
  let vx = cx - 4;
  for (let y = GRAVE_FOOT - 1; y >= 11; y--) {
    const x = Math.round(vx + lean(y));
    if (c.materialAt(x, y)) c.px(x, y, MOSS, unit(-0.3, 0.4, 0.8), { bias: -1 });
    if (y % 3 === 0) {
      const side = R() < 0.5 ? 1 : -1;
      c.px(x + side, y, MOSS, unit(side * 0.6, 0.5, 0.6), { bias: 1 });
      c.px(x + side, y - 1, MOSS, unit(side * 0.4, 0.8, 0.5), { bias: 2 });
    }
    vx += R() < 0.3 ? 0.5 : R() < 0.15 ? -0.5 : 0;
  }
  moss(c, cx + 3, 25, 2.6, 1.6);
  mound(c, cx, 28, 8.5, 8, [[cx - 6, 27], [cx - 4, 28]]);
  const w = GRAVE_WICK[2];
  candle(c, w.x, w.y + 1, 2);
}

/** One of the gravestones, 24x32, standing on row GRAVE_FOOT. */
export function graveStone(kind: number): PixelCanvas {
  const c = new PixelCanvas(GRAVE_W, GRAVE_H);
  if (kind === 1) stoneCross(c);
  else if (kind === 2) brokenSlab(c);
  else headstone(c);
  return c;
}

const SOUL_FIRE: RGB[] = [hex('#ffffff'), hex('#d4fbff'), hex('#86e4ff'), hex('#3f98e8'), hex('#2a4cb8')];

/** A frame of the soul flame on a grave's candle: a cold, pale tongue of light, the wick at its bottom centre. */
export function soulFlame(f: number): PixelCanvas {
  const c = new PixelCanvas(FLAME_W, FLAME_H);
  const R = rng(300 + f * 13);
  const cx = FLAME_W / 2;
  for (let y = 0; y < FLAME_H - 1; y++) {
    const u = y / (FLAME_H - 2); // 0 at the tip, 1 at the wick
    // A teardrop: a fine tip, full just above the wick, rounded under.
    const hw = u < 0.72 ? 0.3 + Math.pow(u / 0.72, 1.2) * 1.9 : 2.2 * (1 - (u - 0.72) / 0.42);
    const sway = Math.sin(f * ((Math.PI * 2) / FLAME_FRAMES) + y * 0.8) * (1 - u) * (1 - u) * 1.1;
    for (let x = 0; x < FLAME_W; x++) {
      const dx = (x + 0.5 - cx - sway) / Math.max(0.3, hw);
      if (Math.abs(dx) > 1) continue;
      const heat = (1 - Math.abs(dx)) * (0.45 + u * 0.7) + (R() - 0.5) * 0.18;
      if (heat < 0.1) continue;
      const col = heat > 0.9 ? SOUL_FIRE[0] : heat > 0.66 ? SOUL_FIRE[1] : heat > 0.42 ? SOUL_FIRE[2] : heat > 0.24 ? SOUL_FIRE[3] : SOUL_FIRE[4];
      c.spark(x, y, col, 1);
    }
  }
  // A mote breaking off the tip, higher each frame.
  if (f % 3 === 0) c.spark(Math.round(cx - 0.5 + Math.sin(f * 2.1)), 0, SOUL_FIRE[3], 0.6);
  return c;
}

/** The soul wisp a blessing rides in on: a white-hot heart in a cold blue haze, as light only. */
export function soulWisp(): Uint8ClampedArray {
  const s = WISP_PX;
  const px = new Uint8ClampedArray(s * s * 4);
  const c = (s - 1) / 2;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const d = Math.hypot(x - c, y - c) / c;
      if (d > 1) continue;
      // Hard pixel steps rather than a smooth falloff, to sit with the art.
      const col = d < 0.2 ? SOUL_FIRE[0] : d < 0.42 ? SOUL_FIRE[1] : d < 0.66 ? SOUL_FIRE[2] : d < 0.86 ? SOUL_FIRE[3] : SOUL_FIRE[4];
      const a = d < 0.66 ? 255 : d < 0.86 ? 170 : 90;
      const i = (y * s + x) * 4;
      px[i] = col[0];
      px[i + 1] = col[1];
      px[i + 2] = col[2];
      px[i + 3] = a;
    }
  }
  return px;
}

/** The blessing's badge: a small headstone with its rune alight and the soul flame burning before it. */
export function echoBuffIcon(): Uint8ClampedArray {
  const w = 16;
  const px = new Uint8ClampedArray(w * w * 4);
  const put = (x: number, y: number, c: string) => {
    if (x < 0 || y < 0 || x >= w || y >= w) return;
    const n = parseInt(c.slice(1), 16);
    const i = (y * w + x) * 4;
    px[i] = n >> 16;
    px[i + 1] = (n >> 8) & 255;
    px[i + 2] = n & 255;
    px[i + 3] = 255;
  };
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < w && px[(y * w + x) * 4 + 3] === 255;
  // The stone: arched top, lit from the upper left, its thickness showing to the right.
  for (let y = 2; y <= 13; y++) {
    for (let x = 2; x <= 12; x++) {
      const dx = x + 0.5 - 7;
      const dy = y + 0.5 - 6.5;
      if (y < 7 && dx * dx + dy * dy * 1.1 > 4.6 * 4.6) continue;
      if (Math.abs(dx) > 4.6) continue;
      const edge = dx > 3.4 ? '#4a4960' : dx < -3.4 || y === 2 || (y < 5 && dx * dx + dy * dy * 1.1 > 3.6 * 3.6 && dx < 0) ? '#b4b2c6' : '#7e7c94';
      put(x, y, edge);
    }
  }
  // The cross cut into it, glowing.
  for (let y = 4; y <= 10; y++) put(7, y, y < 7 ? '#ffffff' : '#9ae8ff');
  for (const x of [5, 6, 8, 9]) put(x, 6, x < 7 ? '#d4fbff' : '#86e4ff');
  // The mound.
  for (let x = 1; x <= 14; x++) put(x, 14, x < 5 ? '#4d3d30' : '#2e241d');
  for (let x = 2; x <= 13; x++) put(x, 13, x < 6 ? '#5a8a4a' : x > 10 ? '#3d3026' : '#3f6c3c');
  // Outline everything drawn so far.
  const out: [number, number][] = [];
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) if (!filled(x, y) && (filled(x + 1, y) || filled(x - 1, y) || filled(x, y + 1) || filled(x, y - 1))) out.push([x, y]);
  for (const [x, y] of out) put(x, y, '#0b0a12');
  // The soul flame before it, over the outline: pale and cold.
  for (const [x, y, col] of [
    [13, 7, '#86e4ff'],
    [12, 8, '#86e4ff'],
    [13, 8, '#ffffff'],
    [14, 8, '#3f98e8'],
    [12, 9, '#d4fbff'],
    [13, 9, '#ffffff'],
    [14, 9, '#86e4ff'],
    [12, 10, '#3f98e8'],
    [13, 10, '#d4fbff'],
    [14, 10, '#3f98e8'],
    [13, 11, '#e4d6b8'],
    [13, 12, '#b8a488'],
    [12, 11, '#0b0a12'],
    [14, 11, '#0b0a12'],
    [14, 12, '#0b0a12'],
    [12, 12, '#0b0a12'],
    [13, 5, '#86e4ff'],
  ] as const) put(x, y, col);
  return px;
}
