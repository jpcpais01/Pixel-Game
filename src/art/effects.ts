// Magic effects: the energy ball, its impact burst, and small helper sprites.
// These are pure light, so they only produce emissive pixels.

import { PixelCanvas, hex, type RGB } from './pixel';
import { EMBER_CORE, EMBER_DEEP, EMBER_HOT, EMBER_MID, MAGIC_CORE, MAGIC_DEEP, MAGIC_HOT, MAGIC_MID, MAGIC_VIOLET, HOLY_CORE, HOLY_HOT, HOLY_MID, HOLY_SKY, SUN_CORE, SUN_HOT, SUN_MID, VOID_CORE, VOID_DEEP, VOID_HOT, VOID_MID, VOID_TEAL } from './palette';

/** Colours of a spell, brightest first; `accent` is the contrasting fleck. */
export interface SpellColors {
  core: RGB;
  hot: RGB;
  mid: RGB;
  deep: RGB;
  accent: RGB;
  /** A hollow orb: a bright ring around a dim heart (the void look). */
  hollow?: boolean;
}

export const ARCANE_SPELL: SpellColors = { core: MAGIC_CORE, hot: MAGIC_HOT, mid: MAGIC_MID, deep: MAGIC_DEEP, accent: MAGIC_VIOLET };
export const VOID_SPELL: SpellColors = { core: VOID_CORE, hot: VOID_HOT, mid: VOID_MID, deep: VOID_DEEP, accent: VOID_TEAL, hollow: true };

const hash = (a: number, b: number, c = 0) => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export const ORB_SIZE = 16;
export const ORB_FRAMES = 4;

/**
 * Energy ball: white-hot core, bright body, flickering deep halo, two orbiting motes.
 * A hollow orb swaps the core for a dim heart inside a blazing ring.
 */
export function orbFrame(f: number, k: SpellColors = ARCANE_SPELL): PixelCanvas {
  const c = new PixelCanvas(ORB_SIZE, ORB_SIZE);
  const cx = 8;
  const cy = 8;
  const pulse = f % 2 === 0 ? 0 : 0.35;
  for (let y = 0; y < ORB_SIZE; y++) {
    for (let x = 0; x < ORB_SIZE; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (k.hollow && d <= 1.6) c.spark(x, y, k.deep, 0.7);
      else if (d <= 1.6) c.spark(x, y, k.core, 1);
      else if (d <= 2.9) c.spark(x, y, k.hollow ? k.core : k.hot, 1);
      else if (d <= 4.0 + pulse) c.spark(x, y, k.hollow ? k.hot : k.mid, 0.85);
      else if (d <= 5.4 + pulse && hash(x, y, f) > 0.35) c.spark(x, y, k.hollow ? k.mid : k.deep, 0.55);
      else if (d <= 6.6 && hash(x, y, f + 9) > 0.86) c.spark(x, y, k.deep, 0.35);
    }
  }
  for (let m = 0; m < 2; m++) {
    const a = ((f * 45 + m * 180) * Math.PI) / 180;
    c.spark(cx + Math.cos(a) * 5.6, cy + Math.sin(a) * 5.6, k.hollow ? k.accent : k.hot, 1);
    c.spark(cx + Math.cos(a - 0.5) * 5.6, cy + Math.sin(a - 0.5) * 5.6, k.mid, 0.5);
  }
  return c;
}

export const BURST_SIZE = 32;
export const BURST_FRAMES = 7;

/** Impact: a flash, an expanding shock ring and sparks flung outward. */
export function burstFrame(f: number, k: SpellColors = ARCANE_SPELL): PixelCanvas {
  const c = new PixelCanvas(BURST_SIZE, BURST_SIZE);
  const cx = 16;
  const cy = 16;
  const t = f / (BURST_FRAMES - 1);
  const r = 2.5 + f * 2.0;
  const thick = Math.max(0.7, 2.2 - f * 0.3);
  const ringCol: RGB = f < 2 ? k.hot : f < 4 ? k.mid : k.deep;
  for (let y = 0; y < BURST_SIZE; y++) {
    for (let x = 0; x < BURST_SIZE; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (f <= 1 && d <= 3.6 - f * 1.2) c.spark(x, y, k.core, 1);
      else if (f <= 2 && d <= 5 - f) c.spark(x, y, k.hot, 0.7);
      if (Math.abs(d - r) <= thick / 2 && hash(x, y, f) > t * 0.55) c.spark(x, y, ringCol, 1 - t * 0.6);
    }
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + hash(i, 1) * 0.5;
    const dist = r + 1.5 + hash(i, 2) * 3;
    const col = i % 3 === 0 ? k.accent : k.hot;
    if (f < BURST_FRAMES - 1) c.spark(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist, col, 1 - t);
  }
  return c;
}

/** Banded radial halo, drawn additively and tinted at runtime. */
export function glowCanvas(size = 32): Uint8ClampedArray {
  const px = new Uint8ClampedArray(size * size * 4);
  const bands = [
    [0.22, 0.55],
    [0.4, 0.3],
    [0.62, 0.15],
    [0.86, 0.07],
    [1.0, 0.03],
  ];
  const h = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - h, y + 0.5 - h) / h;
      const band = bands.find((b) => d <= b[0]);
      const a = band ? band[1] : 0;
      const i = (y * size + x) * 4;
      // Premultiplied white: brightness carries the falloff for ADD blending.
      px[i] = px[i + 1] = px[i + 2] = Math.round(255 * a);
      px[i + 3] = 255;
    }
  }
  return px;
}

/** Soft two-band contact shadow. */
export function shadowCanvas(w = 16, h = 6): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x + 0.5 - w / 2) / (w / 2);
      const dy = (y + 0.5 - h / 2) / (h / 2);
      const d = dx * dx + dy * dy;
      const i = (y * w + x) * 4;
      px[i] = 8;
      px[i + 1] = 6;
      px[i + 2] = 20;
      px[i + 3] = d <= 0.45 ? 150 : d <= 1 ? 90 : 0;
    }
  }
  return px;
}

// ---------------------------------------------------------------------------
// Sky: cloud shadows, sun shafts, motes and the day/night icons.

/** Tileable value noise: lattice wraps every `period` cells. */
function tileNoise(x: number, y: number, cell: number, period: number, seed: number): number {
  const fx = x / cell;
  const fy = y / cell;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const h = (a: number, b: number) => hash(((a % period) + period) % period, ((b % period) + period) % period, seed);
  const a = h(x0, y0);
  const b = h(x0 + 1, y0);
  const c = h(x0, y0 + 1);
  const d = h(x0 + 1, y0 + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Soft, banded cloud shadows that tile seamlessly (size must divide by 64). */
export function cloudShadowCanvas(size = 256): Uint8ClampedArray {
  const px = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n =
        tileNoise(x, y, 64, size / 64, 1) * 0.6 + tileNoise(x, y, 32, size / 32, 2) * 0.28 + tileNoise(x, y, 16, size / 16, 3) * 0.12;
      const a = n > 0.66 ? 0.26 : n > 0.6 ? 0.17 : n > 0.56 ? 0.08 : 0;
      const i = (y * size + x) * 4;
      px[i] = 18;
      px[i + 1] = 26;
      px[i + 2] = 58;
      px[i + 3] = Math.round(a * 255);
    }
  }
  return px;
}

/** Diagonal shafts of sunlight (drawn additively, very faint). */
export function sunShaftCanvas(w = 256, h = 256): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * h * 4);
  const shafts = [
    { at: 40, width: 18, a: 0.5 },
    { at: 92, width: 9, a: 0.35 },
    { at: 150, width: 26, a: 0.45 },
    { at: 205, width: 12, a: 0.3 },
  ];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Rays run from the top-left toward the bottom-right.
      const u = x - y * 0.55;
      let a = 0;
      for (const s of shafts) {
        const d = Math.abs(u - s.at) / s.width;
        if (d < 1) a = Math.max(a, (d < 0.5 ? 1 : 0.55) * s.a);
      }
      a *= Math.max(0, 1 - y / h) ** 0.7; // fade toward the bottom
      const i = (y * w + x) * 4;
      px[i] = Math.round(255 * a);
      px[i + 1] = Math.round(236 * a);
      px[i + 2] = Math.round(190 * a);
      px[i + 3] = 255;
    }
  }
  return px;
}

/** 12x12 pixel sun and moon icons for the time-of-day toggle. */
export function skyIcon(kind: 'sun' | 'moon'): Uint8ClampedArray {
  const S = 12;
  const px = new Uint8ClampedArray(S * S * 4);
  const put = (x: number, y: number, c: string) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const n = parseInt(c.slice(1), 16);
    const i = (y * S + x) * 4;
    px[i] = n >> 16;
    px[i + 1] = (n >> 8) & 255;
    px[i + 2] = n & 255;
    px[i + 3] = 255;
  };
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - 6;
      const dy = y + 0.5 - 6;
      const d = Math.hypot(dx, dy);
      if (kind === 'sun') {
        if (d <= 2.6) put(x, y, dx + dy < -1.5 ? '#fff6c8' : '#ffd24a');
        else if (d <= 3.4) put(x, y, '#f29a2e');
      } else {
        const cut = Math.hypot(dx - 1.8, dy + 1.4);
        if (d <= 4.4 && cut > 3.4) put(x, y, dx < -2 && dy < 1 ? '#f2f0ff' : '#c9c8f0');
      }
    }
  }
  if (kind === 'sun') {
    for (const [x, y] of [
      [6, 0], [5, 0], [6, 11], [5, 11], [0, 5], [0, 6], [11, 5], [11, 6],
      [2, 2], [9, 2], [2, 9], [9, 9],
    ]) put(x, y, '#ffc23a');
  } else {
    put(9, 2, '#ffffff');
    put(10, 5, '#b8c0ff');
    put(8, 9, '#dfe4ff');
  }
  return px;
}

/** 16x16 icon for the beam button: a ray of light bursting from a star, with a strand of the accent colour, drawn additively. */
export function beamIcon(k: SpellColors = ARCANE_SPELL): Uint8ClampedArray {
  const S = 16;
  const px = new Uint8ClampedArray(S * S * 4);
  const cols: RGB[] = [k.core, k.hot, k.mid, k.deep, k.accent];
  const put = (x: number, y: number, c: RGB) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = (y * S + x) * 4;
    // Keep the brighter colour where shapes overlap.
    if (px[i] + px[i + 1] + px[i + 2] >= c[0] + c[1] + c[2]) return;
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
    px[i + 3] = 255;
  };
  // The ray runs from the lower left to the upper right, widening as it goes.
  const ox = 3.5;
  const oy = 12.5;
  const ux = Math.SQRT1_2;
  const uy = -Math.SQRT1_2;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const rx = x + 0.5 - ox;
      const ry = y + 0.5 - oy;
      const along = rx * ux + ry * uy;
      const side = rx * uy - ry * ux;
      if (along < 0 || along > 14) continue;
      const w = 0.6 + along * 0.14;
      const d = Math.abs(side) / w;
      if (d <= 0.5) put(x, y, cols[0]);
      else if (d <= 1.1) put(x, y, cols[1]);
      else if (d <= 1.7) put(x, y, cols[2]);
      else if (d <= 2.3 && hash(x, y, 4) > 0.3) put(x, y, cols[3]);
      // A violet strand winding round the ray.
      if (Math.abs(side - Math.sin(along * 0.9) * w * 1.9) < 0.5 && d > 1) put(x, y, cols[4]);
    }
  }
  // Star at the source.
  const sx = Math.floor(ox);
  const sy = Math.floor(oy);
  for (let i = -3; i <= 3; i++) {
    const c = Math.abs(i) <= 1 ? cols[0] : cols[1];
    put(sx + i, sy, c);
    put(sx, sy + i, c);
  }
  for (const [dx, dy] of [[-1, -1], [1, 1], [-1, 1], [1, -1]]) put(sx + dx, sy + dy, cols[2]);
  return px;
}

/** Colours for the sword icon: blade (lit, shaded, tip), guard (lit, highlight, dark), grip and outline. */
export interface SwordIconColors {
  blade: string;
  bladeDark: string;
  tip: string;
  guard: string;
  guardLit: string;
  guardDark: string;
  grip: string;
  ink: string;
  /** A short round tsuba and a longer grip. */
  katana?: boolean;
}

const KNIGHT_SWORD_ICON: SwordIconColors = {
  blade: '#dfe8f7',
  bladeDark: '#8d9dbd',
  tip: '#f4f8ff',
  guard: '#f4cf6a',
  guardLit: '#fff4bf',
  guardDark: '#d69a3a',
  grip: '#8f5a36',
  ink: '#0c0f18',
};

/** The jade warrior's katana: pale green-tempered steel, a short gold tsuba, a long jade grip. */
export const JADE_SWORD_ICON: SwordIconColors = {
  blade: '#d6ece5',
  bladeDark: '#82a39b',
  tip: '#f2fffa',
  guard: '#f4cf6a',
  guardLit: '#fff4bf',
  guardDark: '#d69a3a',
  grip: '#22845e',
  ink: '#040907',
  katana: true,
};

/** 16x16 sword for the warrior's attack button: steel blade, gold guard, dark outline (normal blend). */
export function swordIcon(k: SwordIconColors = KNIGHT_SWORD_ICON): Uint8ClampedArray {
  const S = 16;
  const px = new Uint8ClampedArray(S * S * 4);
  const put = (x: number, y: number, c: string) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const n = parseInt(c.slice(1), 16);
    const i = (y * S + x) * 4;
    px[i] = n >> 16;
    px[i + 1] = (n >> 8) & 255;
    px[i + 2] = n & 255;
    px[i + 3] = 255;
  };
  // Blade from the lower left up to the upper right, a lit and a shaded bevel.
  for (let i = 0; i < 9; i++) {
    put(5 + i, 10 - i, i > 6 ? k.tip : k.blade);
    put(6 + i, 10 - i, k.bladeDark);
  }
  put(14, 1, k.tip);
  // Crossguard, grip and pommel.
  if (k.katana) {
    for (const [x, y] of [[3, 10], [4, 11], [5, 12]]) put(x, y, k.guard);
    put(3, 10, k.guardLit);
    for (const [x, y] of [[3, 12], [2, 13], [1, 14]]) put(x, y, k.grip);
    put(0, 15, k.guard);
  } else {
    for (const [x, y] of [[2, 9], [3, 10], [4, 11], [5, 12], [6, 13]]) put(x, y, k.guard);
    put(3, 9, k.guardLit);
    for (const [x, y] of [[3, 12], [2, 13]]) put(x, y, k.grip);
    put(1, 14, k.guardDark);
  }
  // Outline.
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < S && y < S && px[(y * S + x) * 4 + 3] === 255;
  const out: [number, number][] = [];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (filled(x, y)) continue;
      if (filled(x + 1, y) || filled(x - 1, y) || filled(x, y + 1) || filled(x, y - 1)) out.push([x, y]);
    }
  }
  for (const [x, y] of out) put(x, y, k.ink);
  return px;
}

/** 16x16 icon for the whirlwind button: a spiral of golden fire around a bright heart, drawn additively. */
export function whirlIcon(cols: RGB[] = [EMBER_CORE, EMBER_HOT, EMBER_MID, EMBER_DEEP]): Uint8ClampedArray {
  const S = 16;
  const px = new Uint8ClampedArray(S * S * 4);
  const put = (x: number, y: number, c: RGB) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = (y * S + x) * 4;
    if (px[i] + px[i + 1] + px[i + 2] >= c[0] + c[1] + c[2]) return;
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
    px[i + 3] = 255;
  };
  // Two crescents chasing each other round the centre, thick and hot at their heads.
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - 8;
      const dy = y + 0.5 - 8;
      const r = Math.hypot(dx, dy);
      const a = (Math.atan2(dy, dx) / Math.PI + 1) * 180; // 0..360
      for (const head of [40, 220]) {
        const behind = (((head - a) % 360) + 360) % 360;
        if (behind > 170) continue;
        const k = 1 - behind / 170;
        const rr = 3 + 4.3 * (1 - behind / 170) ** 0.6;
        const d = Math.abs(r - rr);
        const th = 0.45 + k * 1.1;
        if (d <= th * 0.45) put(x, y, k > 0.7 ? cols[0] : cols[1]);
        else if (d <= th) put(x, y, k > 0.45 ? cols[1] : cols[2]);
        else if (d <= th + 0.6 && k > 0.2 && hash(x, y, 3) > 0.4) put(x, y, cols[3]);
      }
      if (r <= 1.3) put(x, y, cols[0]);
      else if (r <= 2.1) put(x, y, cols[1]);
    }
  }
  return px;
}

/** 16x16 mace for the paladin's attack button: a flanged steel head with a spike, gold bands, dark outline. */
export function maceIcon(): Uint8ClampedArray {
  const S = 16;
  const px = new Uint8ClampedArray(S * S * 4);
  const put = (x: number, y: number, c: string) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const n = parseInt(c.slice(1), 16);
    const i = (y * S + x) * 4;
    px[i] = n >> 16;
    px[i + 1] = (n >> 8) & 255;
    px[i + 2] = n & 255;
    px[i + 3] = 255;
  };
  // Haft from the lower left up toward the head.
  for (let i = 0; i < 8; i++) put(2 + i, 13 - i, i < 3 ? '#6a3d26' : i === 5 ? '#f4cf6a' : '#a9774c');
  put(1, 14, '#d69a3a');
  // Head: a round steel ball lit from the upper left.
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - 11;
      const dy = y + 0.5 - 5;
      const d = Math.hypot(dx, dy);
      if (d <= 2.9) put(x, y, dx + dy < -2.2 ? '#eef2fb' : dx + dy < 0.6 ? '#bcc6dc' : d > 2.2 ? '#48536f' : '#7f8ba8');
    }
  }
  // Gold flanges across the head and a spike out of the top.
  for (const [x, y] of [[7, 3], [8, 2], [13, 8], [14, 9], [8, 8], [7, 9], [14, 2], [13, 3]]) put(x, y, '#f4cf6a');
  put(12, 1, '#fff4bf');
  put(13, 0, '#fff4bf');
  put(11, 4, '#ffffff');
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < S && y < S && px[(y * S + x) * 4 + 3] === 255;
  const out: [number, number][] = [];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (filled(x, y)) continue;
      if (filled(x + 1, y) || filled(x - 1, y) || filled(x, y + 1) || filled(x, y - 1)) out.push([x, y]);
    }
  }
  for (const [x, y] of out) put(x, y, '#0e1120');
  return px;
}

/** 16x16 icon for the consecration button: a ring of holy light on the ground under a rising sun cross, drawn additively. */
export function sanctuaryIcon(): Uint8ClampedArray {
  const S = 16;
  const px = new Uint8ClampedArray(S * S * 4);
  const cols: RGB[] = [HOLY_CORE, HOLY_HOT, HOLY_MID, HOLY_SKY];
  const put = (x: number, y: number, c: RGB) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = (y * S + x) * 4;
    if (px[i] + px[i + 1] + px[i + 2] >= c[0] + c[1] + c[2]) return;
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
    px[i + 3] = 255;
  };
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // The ring, seen at an angle, low in the icon.
      const q = Math.hypot((x + 0.5 - 8) / 7, (y + 0.5 - 11.5) / 3.6);
      if (Math.abs(q - 0.9) < 0.1) put(x, y, y > 11 ? cols[1] : cols[2]);
      else if (Math.abs(q - 0.72) < 0.08 && hash(x, y, 5) > 0.45) put(x, y, cols[3]);
    }
  }
  // The cross rising from its centre, with a bright heart.
  for (let y = 2; y <= 12; y++) put(8, y, y < 5 || y > 9 ? cols[1] : cols[0]);
  for (let y = 3; y <= 10; y++) put(7, y, cols[2]);
  for (let x = 4; x <= 11; x++) put(x, 5, x > 5 && x < 10 ? cols[0] : cols[1]);
  for (let x = 5; x <= 10; x++) put(x, 6, cols[2]);
  for (const [x, y] of [[3, 2], [12, 3], [5, 9], [11, 8]]) put(x, y, cols[3]);
  return px;
}

/** 16x16 warhammer for the Crusader's attack button: a squared steel head banded in gold, a spike, a long haft. */
export function hammerIcon(): Uint8ClampedArray {
  const S = 16;
  const px = new Uint8ClampedArray(S * S * 4);
  const put = (x: number, y: number, c: string) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const n = parseInt(c.slice(1), 16);
    const i = (y * S + x) * 4;
    px[i] = n >> 16;
    px[i + 1] = (n >> 8) & 255;
    px[i + 2] = n & 255;
    px[i + 3] = 255;
  };
  // Haft from the lower left up to the head.
  for (let i = 0; i < 9; i++) put(2 + i, 13 - i, i < 3 ? '#6a3d26' : '#a9774c');
  put(1, 14, '#d69a3a');
  // The head, square across the haft's end: steel lit from the upper left, gold bands at both faces.
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = (x + 0.5 - 11) * 0.7071 + (y + 0.5 - 5) * 0.7071; // across the haft, along the head
      const v = (x + 0.5 - 11) * 0.7071 - (y + 0.5 - 5) * 0.7071; // up the haft
      if (Math.abs(u) > 4.2 || Math.abs(v) > 2.2) continue;
      const band = Math.abs(u) > 3.0;
      const lit = v > 0.9 || u < -2.2;
      put(x, y, band ? (lit ? '#fff4bf' : '#d69a3a') : lit ? '#d4c8cc' : v < -0.9 ? '#43363f' : '#8a7f8e');
    }
  }
  // A spike off the top of the head, glowing with sunfire.
  put(13, 2, '#ffd070');
  put(14, 1, '#ff9a3a');
  put(15, 0, '#e0602a');
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < S && y < S && px[(y * S + x) * 4 + 3] === 255;
  const out: [number, number][] = [];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (filled(x, y)) continue;
      if (filled(x + 1, y) || filled(x - 1, y) || filled(x, y + 1) || filled(x, y - 1)) out.push([x, y]);
    }
  }
  for (const [x, y] of out) put(x, y, '#0c0a12');
  return px;
}

/** 16x16 icon for the Crusader's Sunfall: a sun high up, its fire pouring down into a blast ring, drawn additively. */
export function sunfallIcon(): Uint8ClampedArray {
  const S = 16;
  const px = new Uint8ClampedArray(S * S * 4);
  const cols: RGB[] = [SUN_CORE, SUN_HOT, SUN_MID, EMBER_DEEP];
  const put = (x: number, y: number, c: RGB) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = (y * S + x) * 4;
    if (px[i] + px[i + 1] + px[i + 2] >= c[0] + c[1] + c[2]) return;
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
    px[i + 3] = 255;
  };
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // The sun.
      const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 3.5);
      if (d < 1.6) put(x, y, cols[0]);
      else if (d < 2.6) put(x, y, cols[1]);
      else if (d < 3.3 && hash(x, y, 7) > 0.35) put(x, y, cols[2]);
      // The blast ring, seen at an angle.
      const q = Math.hypot((x + 0.5 - 8) / 7.2, (y + 0.5 - 12) / 3.4);
      if (Math.abs(q - 0.9) < 0.11) put(x, y, y > 12 ? cols[1] : cols[2]);
      else if (Math.abs(q - 0.66) < 0.09 && hash(x, y, 9) > 0.5) put(x, y, cols[3]);
    }
  }
  // Fire pouring down from the sun into the ring's heart.
  for (let y = 6; y <= 12; y++) {
    put(8, y, y > 10 ? cols[0] : cols[1]);
    put(7, y, cols[2]);
    if (y > 8) put(9, y, cols[2]);
  }
  // Short rays round the sun, and embers.
  for (const [x, y] of [[4, 3], [12, 3], [8, 0], [5, 1], [11, 1], [5, 6], [11, 6]]) put(x, y, cols[2]);
  for (const [x, y] of [[3, 9], [13, 8]]) put(x, y, cols[3]);
  return px;
}

/** Brightest-first colours for a Jedi icon: a white core, then the blade or Force colour. */
export type IconColors = [RGB, RGB, RGB, RGB];

/** 16x16 saber for the Jedi's attack button: a chrome hilt and a glowing blade, drawn additively. */
export function saberIcon(cols: IconColors): Uint8ClampedArray {
  const S = 16;
  const px = new Uint8ClampedArray(S * S * 4);
  const put = (x: number, y: number, c: RGB, a = 1) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = (y * S + x) * 4;
    px[i] = Math.min(255, px[i] + c[0] * a);
    px[i + 1] = Math.min(255, px[i + 1] + c[1] * a);
    px[i + 2] = Math.min(255, px[i + 2] + c[2] * a);
    px[i + 3] = 255;
  };
  // Blade from the hilt at the lower left up to the upper right: a white core, coloured edges, a soft halo.
  for (let i = 0; i < 10; i++) {
    const x = 5 + i;
    const y = 10 - i;
    put(x, y, cols[0]);
    put(x + 1, y, cols[1], 0.9);
    put(x, y - 1, cols[1], 0.9);
    put(x + 1, y + 1, cols[3], 0.35);
    put(x - 1, y - 1, cols[3], 0.35);
  }
  // Hilt: bright chrome caps round a darker grip.
  for (const [x, y, k] of [[4, 11, 0.9], [3, 12, 0.45], [2, 13, 0.45], [1, 14, 0.8]] as const) put(x, y, [200, 208, 224], k);
  put(4, 10, [200, 208, 224], 0.5);
  put(5, 11, [200, 208, 224], 0.5);
  return px;
}

/** 16x16 icon for the Force push button: an open palm of light and waves rolling off it, drawn additively. */
export function forceIcon(cols: IconColors): Uint8ClampedArray {
  const S = 16;
  const px = new Uint8ClampedArray(S * S * 4);
  const put = (x: number, y: number, c: RGB) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = (y * S + x) * 4;
    if (px[i] + px[i + 1] + px[i + 2] >= c[0] + c[1] + c[2]) return;
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
    px[i + 3] = 255;
  };
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - 3;
      const dy = y + 0.5 - 8;
      const r = Math.hypot(dx, dy);
      const a = Math.abs(Math.atan2(dy, dx));
      // Three arcs, widening and fading as they roll out to the right.
      [5.5, 8.8, 12].forEach((R, i) => {
        const spread = 0.75 - i * 0.05;
        if (a > spread || Math.abs(r - R) > 0.55 + i * 0.1) return;
        const edge = a > spread - 0.2;
        put(x, y, cols[Math.min(3, i + (edge ? 1 : 0))]);
      });
      if (r < 1.4) put(x, y, cols[0]);
      else if (r < 2.4) put(x, y, cols[1]);
      else if (r < 3.1 && hash(x, y, 9) > 0.4) put(x, y, cols[2]);
    }
  }
  return px;
}

/** 16x16 red glove for the fighter's attack button: a clenched fist over a taped wrist, speed lines behind it. */
export function fistIcon(): Uint8ClampedArray {
  const S = 16;
  const px = new Uint8ClampedArray(S * S * 4);
  const put = (x: number, y: number, c: string) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const n = parseInt(c.slice(1), 16);
    const i = (y * S + x) * 4;
    px[i] = n >> 16;
    px[i + 1] = (n >> 8) & 255;
    px[i + 2] = n & 255;
    px[i + 3] = 255;
  };
  const glove = (dx: number, dy: number) => (dx + dy < -4.2 ? '#ff8c66' : dx + dy < -1.2 ? '#ea4838' : dx + dy < 2.4 ? '#bd262c' : '#7a1420');
  // Tape round the wrist, lower left.
  for (let y = 10; y <= 14; y++) {
    for (let x = 3; x <= 8; x++) {
      const d = x - 3 + (14 - y);
      if (d < 2 || d > 7) continue;
      put(x, y, (x + y) % 3 === 0 ? '#968fa8' : x < 5 ? '#f2eef4' : '#cfc9d8');
    }
  }
  // The fist: a rounded block of knuckles leaning up to the right.
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (x + 0.5 - 9.5) / 5;
      const dy = (y + 0.5 - 6.5) / 4.6;
      if (dx * dx + dy * dy <= 1) put(x, y, glove(x + 0.5 - 9.5, y + 0.5 - 6.5));
    }
  }
  // Finger creases across the knuckles, and the thumb folded over them.
  for (const x of [8, 10, 12]) for (let y = 3; y <= 6; y++) put(x + (y > 4 ? 1 : 0), y, '#7a1420');
  for (let x = 6; x <= 10; x++) put(x, 8, x < 8 ? '#ff8c66' : '#ea4838');
  for (let x = 6; x <= 10; x++) put(x, 9, '#7a1420');
  put(12, 3, '#ffd6c0');
  put(7, 3, '#ffd6c0');
  // Speed lines behind it.
  for (const [x0, y, n] of [[0, 4, 3], [1, 7, 2], [0, 10, 2]]) for (let i = 0; i < n; i++) put(x0 + i, y, i === n - 1 ? '#fff2dc' : '#ffc49a');
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < S && y < S && px[(y * S + x) * 4 + 3] === 255;
  const out: [number, number][] = [];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (filled(x, y)) continue;
      if (filled(x + 1, y) || filled(x - 1, y) || filled(x, y + 1) || filled(x, y - 1)) out.push([x, y]);
    }
  }
  for (const [x, y] of out) put(x, y, '#0e1120');
  return px;
}

/** 16x16 icon for the fighter's barrage: a volley of burning fists streaking out to the right, drawn additively. */
export function barrageIcon(cols: IconColors): Uint8ClampedArray {
  const S = 16;
  const px = new Uint8ClampedArray(S * S * 4);
  const put = (x: number, y: number, c: RGB) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = (y * S + x) * 4;
    if (px[i] + px[i + 1] + px[i + 2] >= c[0] + c[1] + c[2]) return;
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
    px[i + 3] = 255;
  };
  // Three fists, the nearest largest, each with a tapering streak behind it.
  for (const [fx, fy, r, len] of [[12, 4, 1.9, 7], [9.5, 11, 1.9, 7], [13.5, 9, 2.4, 9]] as const) {
    for (let x = 0; x < S; x++) {
      for (let y = 0; y < S; y++) {
        const dx = x + 0.5 - fx;
        const dy = y + 0.5 - fy;
        const d = Math.hypot(dx, dy);
        if (d <= r) put(x, y, dx > r * 0.3 ? cols[0] : d < r * 0.6 ? cols[1] : cols[2]);
        else if (dx < 0 && -dx < len && Math.abs(dy) < r * (1 + dx / len) + 0.2) put(x, y, -dx < len * 0.4 ? cols[2] : cols[3]);
      }
    }
  }
  return px;
}

/** Paints 16x16 icons from a hex colour per pixel, then rings the shape in a dark outline. */
function iconPainter(): { px: Uint8ClampedArray; put: (x: number, y: number, c: string) => void; outline: (c: string) => void } {
  const S = 16;
  const px = new Uint8ClampedArray(S * S * 4);
  const put = (x: number, y: number, c: string) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const n = parseInt(c.slice(1), 16);
    const i = (y * S + x) * 4;
    px[i] = n >> 16;
    px[i + 1] = (n >> 8) & 255;
    px[i + 2] = n & 255;
    px[i + 3] = 255;
  };
  const outline = (c: string) => {
    const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < S && y < S && px[(y * S + x) * 4 + 3] === 255;
    const out: [number, number][] = [];
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        if (filled(x, y)) continue;
        if (filled(x + 1, y) || filled(x - 1, y) || filled(x, y + 1) || filled(x, y - 1)) out.push([x, y]);
      }
    }
    for (const [x, y] of out) put(x, y, c);
  };
  return { px, put, outline };
}

/** The colours of an alchemist's brew on his icons and fumes. */
export interface BrewColors {
  /** The liquid from lit to shadowed. */
  ramp: [string, string, string, string];
  /** Its surface, and a glint. */
  surface: string;
  glint: string;
  /** The skull in the bog cloud: bone, bone in shadow, sockets. */
  bone: [string, string, string];
  ink: string;
  /** Fumes from lit to shadowed. */
  fume: [string, string, string, string];
}

export const PLAGUE_BREW: BrewColors = {
  ramp: ['#c8ff7a', '#6ee03a', '#3fae2a', '#1e6a1a'],
  surface: '#b8ff5c',
  glint: '#f2ffd2',
  bone: ['#e8f2d8', '#a9b89a', '#10200c'],
  ink: '#0a1410',
  fume: ['#d2ff9a', '#8ee85a', '#4fb83a', '#2a7a34'],
};

export const HEX_BREW_COLORS: BrewColors = {
  ramp: ['#ffb8f8', '#e060ec', '#a834c4', '#5a1878'],
  surface: '#ff9cf2',
  glint: '#fff0fe',
  bone: ['#f4e8f4', '#b8a0bc', '#200c24'],
  ink: '#140a18',
  fume: ['#ffd0fa', '#e880f0', '#b048c8', '#6a2488'],
};

/** 16x16 icon for the alchemist's attack: a round flask of glowing poison, corked, bubbles rising off it. */
export function flaskIcon(b: BrewColors = PLAGUE_BREW): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  const cx = 7.5;
  const cy = 10;
  const r = 4.6;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.hypot(dx, dy);
      if (d > r) continue;
      // Glass above the liquid line, poison below it, shaded from the top left.
      if (dy < -1.6) put(x, y, dx + dy < -4 ? '#d8f6f4' : '#8fc0c8');
      else {
        const k = dx + dy * 0.6;
        put(x, y, d > r - 1 && k > 1 ? b.ramp[3] : k < -2.2 ? b.ramp[0] : k < 0.6 ? b.ramp[1] : b.ramp[2]);
      }
    }
  }
  // The liquid's surface, a glint on the glass and a bubble inside.
  for (let x = 4; x <= 11; x++) if (Math.hypot(x + 0.5 - cx, 8.5 - cy) <= r) put(x, 8, b.surface);
  put(5, 8, b.glint);
  put(5, 7, '#ffffff');
  put(9, 11, b.ramp[0]);
  // Neck and cork.
  for (let y = 3; y <= 5; y++) {
    put(7, y, '#8fc0c8');
    put(8, y, '#4d7886');
  }
  put(6, 2, '#a9774c');
  put(7, 2, '#a9774c');
  put(8, 2, '#7d4f33');
  put(9, 2, '#523023');
  put(7, 1, '#7d4f33');
  put(8, 1, '#523023');
  outline(b.ink);
  // Fumes curling up off the cork, outside the outline.
  put(11, 3, b.surface);
  put(12, 1, b.ramp[1]);
  put(13, 4, b.ramp[1]);
  return px;
}

/** 16x16 icon for the plague bog: a toxic cloud with a skull in it, bubbles popping underneath. */
export function bogIcon(b: BrewColors = PLAGUE_BREW): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  // Three round puffs make the cloud; the lit side is up and to the left.
  const puffs: [number, number, number][] = [
    [5, 8, 4],
    [10.5, 7, 4.6],
    [8, 10.5, 4.4],
  ];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      let inside = false;
      let lit = -Infinity;
      for (const [px0, py0, r] of puffs) {
        const dx = x + 0.5 - px0;
        const dy = y + 0.5 - py0;
        if (Math.hypot(dx, dy) <= r) {
          inside = true;
          lit = Math.max(lit, -(dx + dy) / r);
        }
      }
      if (!inside || y > 14) continue;
      put(x, y, lit > 0.8 ? b.surface : lit > 0.1 ? b.ramp[1] : lit > -0.6 ? b.ramp[2] : b.ramp[3]);
    }
  }
  // The skull.
  const [bone, shade, socket] = b.bone;
  for (const [x, y] of [[7, 5], [8, 5], [9, 5], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6], [6, 7], [8, 7], [10, 7], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [7, 9], [9, 9]] as const) put(x, y, x >= 9 && y >= 7 ? shade : bone);
  put(7, 7, socket);
  put(9, 7, socket);
  put(8, 9, socket);
  put(7, 10, bone);
  put(8, 10, shade);
  put(9, 10, shade);
  outline(b.ink);
  // Bubbles bursting below.
  put(3, 14, b.surface);
  put(12, 13, b.surface);
  put(13, 15, b.ramp[1]);
  return px;
}

/** A soft pixel puff of poison fumes, `size` across, dithered at the edge. Variant `v` shifts the shape. */
export function fumeCanvas(size: number, v: number, b: BrewColors = PLAGUE_BREW): Uint8ClampedArray {
  const px = new Uint8ClampedArray(size * size * 4);
  const m = size / 2;
  const lobes: [number, number, number][] = [
    [m - size * 0.16, m + size * 0.05, size * 0.3],
    [m + size * 0.14, m - size * 0.04, size * 0.33],
    [m + (hash(v, 1) - 0.5) * size * 0.2, m - size * 0.16, size * 0.26],
  ];
  const cols = b.fume.map(hex);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let best = 0;
      let lit = 0;
      for (const [lx, ly, r] of lobes) {
        const dx = x + 0.5 - lx;
        const dy = y + 0.5 - ly;
        const k = 1 - Math.hypot(dx, dy) / r;
        if (k > best) {
          best = k;
          lit = -(dx + dy) / r;
        }
      }
      if (best <= 0) continue;
      // Ragged edge: the outermost ring is only half there.
      if (best < 0.18 && hash(x, y, v) > 0.5) continue;
      const c = cols[lit > 0.45 ? 0 : lit > 0 ? 1 : lit > -0.45 ? 2 : 3];
      const i = (y * size + x) * 4;
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
      px[i + 3] = best < 0.18 ? 150 : 255;
    }
  }
  return px;
}

/** The colours of an archer's icons: bow, string, fletching and the light of the shot. */
export interface QuiverColors {
  /** The bow from lit to shadowed. */
  bow: [string, string, string];
  string: string;
  fletch: [string, string];
  head: [string, string];
  /** Light: streaks, the target ring, the bolt, brightest first. */
  light: [string, string, string];
  ink: string;
}

export const RANGER_QUIVER: QuiverColors = {
  bow: ['#e6b872', '#c28c4a', '#65391c'],
  string: '#d8d0b8',
  fletch: ['#ff8c72', '#bc363a'],
  head: ['#eef4ff', '#8f9db8'],
  light: ['#fffbe8', '#ffe2a0', '#e8a850'],
  ink: '#170c06',
};

export const STORM_QUIVER: QuiverColors = {
  bow: ['#9ca8cc', '#646c8c', '#282c40'],
  string: '#bff0ff',
  fletch: ['#e8faff', '#3e9cff'],
  head: ['#ffffff', '#8ad8ff'],
  light: ['#ffffff', '#bff0ff', '#4ab4ff'],
  ink: '#06070c',
};

/** 16x16 icon for the archer's attack: a recurve bow drawn with an arrow on the string, aimed up and right. */
export function bowIcon(k: QuiverColors = RANGER_QUIVER): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  // The bow's belly arcs round the upper right; its tips at the upper left and lower right.
  for (let i = 0; i <= 40; i++) {
    const t = (i / 40) * 2 - 1;
    const x = 8 + t * 5.6 + (1 - t * t) * 2.3 + 0.5;
    const y = 8 + t * 5.6 - (1 - t * t) * 2.3 + 0.5;
    const lit = t < -0.2 ? 0 : t < 0.5 ? 1 : 2;
    put(Math.floor(x), Math.floor(y), k.bow[lit]);
    if (Math.abs(t) < 0.75) put(Math.floor(x + 0.7), Math.floor(y - 0.7), k.bow[Math.min(2, lit + 1)]);
  }
  outline(k.ink);
  // The string, from each tip back to the nock at the lower left.
  const nock: [number, number] = [4, 11];
  for (const [tx, ty] of [[2.9, 2.9], [13.1, 13.1]] as const) {
    for (let i = 0; i <= 8; i++) {
      const u = i / 8;
      put(Math.round(tx + (nock[0] - tx) * u), Math.round(ty + (nock[1] - ty) * u), k.string);
    }
  }
  // The arrow, nock to head, out past the bow.
  for (let i = 0; i <= 9; i++) put(nock[0] + i, nock[1] - i, i < 2 ? k.fletch[0] : '#c28c4a');
  put(3, 11, k.fletch[1]);
  put(4, 12, k.fletch[1]);
  put(5, 11, k.fletch[0]);
  put(4, 10, k.fletch[0]);
  put(13, 2, k.head[1]);
  put(14, 1, k.head[0]);
  put(13, 1, k.head[0]);
  put(14, 2, k.head[1]);
  return px;
}

/** 16x16 icon for the arrow rain: arrows plunging onto a ring on the ground (with a bolt among them in the storm). */
export function rainIcon(k: QuiverColors = RANGER_QUIVER, bolt = false): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  // Three arrows falling at a slant, heads down.
  const arrows: [number, number, number][] = [
    [3, 1, 8],
    [8, 0, 10],
    [12, 3, 7],
  ];
  for (const [x0, y0, len] of arrows) {
    for (let i = 0; i < len; i++) {
      const x = x0 + Math.floor(i * 0.3);
      const y = y0 + i;
      put(x, y, i < 2 ? k.fletch[i % 2] : i >= len - 2 ? k.head[i === len - 1 ? 0 : 1] : '#c28c4a');
    }
    put(x0 - 1, y0 + 1, k.fletch[1]);
    put(x0 + 1, y0 + 1, k.fletch[0]);
  }
  outline(k.ink);
  // The ring they fall into, seen at an angle.
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const q = Math.hypot((x + 0.5 - 8) / 7, (y + 0.5 - 13) / 2.6);
      if (Math.abs(q - 0.88) < 0.14 && px[(y * 16 + x) * 4 + 3] === 0) put(x, y, y > 12 ? k.light[1] : k.light[2]);
    }
  }
  if (bolt) {
    // A jag of lightning striking down beside the middle arrow.
    for (const [x, y, c] of [[6, 1, 0], [6, 2, 0], [5, 3, 1], [6, 4, 0], [7, 5, 0], [7, 6, 1], [6, 7, 0], [6, 8, 0], [7, 9, 1], [7, 10, 0], [7, 11, 0]] as const) put(x, y, k.light[c]);
  }
  return px;
}
